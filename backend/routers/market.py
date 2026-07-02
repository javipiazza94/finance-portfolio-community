"""
routers/market.py — Market data endpoints: quotes, refresh, history, search, browse.

Migrated from: stock-dashboard/app.py
"""
import time
import threading
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import Asset, Quote, PriceHistory
from services.fetcher import fetch_single_ticker, search_yahoo_finance
from services.companies import (
    get_all_index_companies, search_companies, search_by_isin, INDEX_CURRENCY,
)

# ── Price cache: { index_name: {"ts": datetime, "prices": {ticker: {price, change_1d}}} }
_browse_cache: dict[str, dict] = {}
_browse_cache_lock = threading.Lock()
_CACHE_TTL = timedelta(minutes=10)

# ── Market-cap cache: populated once in background, valid 24h ────────────────
_mcap_cache: dict[str, int | None] = {}   # ticker → market_cap
_mcap_cache_ts: datetime | None = None
_mcap_cache_lock = threading.Lock()
_mcap_fetching = False
_MCAP_TTL = timedelta(hours=24)


def _fetch_market_caps_background(tickers: list[str]) -> None:
    """Fetch market caps for all tickers in a background thread (50 workers)."""
    global _mcap_fetching, _mcap_cache_ts
    import yfinance as yf, math
    from concurrent.futures import ThreadPoolExecutor

    def _get_mc(t: str):
        try:
            ticker = yf.Ticker(t)
            mc = ticker.fast_info.market_cap
            if mc and not math.isnan(float(mc)):
                return t, int(mc)
            # fast_info returns None for crypto — fallback to full info
            mc2 = ticker.info.get("marketCap")
            if mc2 and not math.isnan(float(mc2)):
                return t, int(mc2)
        except Exception:
            pass
        return t, None

    with ThreadPoolExecutor(max_workers=50) as ex:
        for t, mc in ex.map(_get_mc, tickers):
            with _mcap_cache_lock:
                _mcap_cache[t] = mc

    with _mcap_cache_lock:
        _mcap_cache_ts = datetime.utcnow()
        _mcap_fetching = False


def _ensure_mcap_cache(all_tickers: list[str]) -> None:
    """Start a background market-cap fetch if the cache is stale or has missing tickers."""
    global _mcap_fetching
    with _mcap_cache_lock:
        if _mcap_fetching:
            return
        stale = _mcap_cache_ts is None or (datetime.utcnow() - _mcap_cache_ts) > _MCAP_TTL
        missing = [t for t in all_tickers if t not in _mcap_cache]
        if not stale and not missing:
            return
        tickers_to_fetch = all_tickers if stale else missing
        _mcap_fetching = True

    t = threading.Thread(
        target=_fetch_market_caps_background,
        args=(tickers_to_fetch,),
        daemon=True,
    )
    t.start()


def _batch_fetch_prices(tickers: list[str]) -> dict[str, dict]:
    """Batch-fetch latest price + daily change for a list of tickers via yf.download."""
    if not tickers:
        return {}
    import yfinance as yf, math, pandas as pd

    results: dict[str, dict] = {}
    try:
        raw = yf.download(
            tickers,
            period="5d",
            auto_adjust=True,
            progress=False,
            group_by="ticker",
            threads=True,
        )
        is_multi = isinstance(raw.columns, pd.MultiIndex)
        for t in tickers:
            try:
                closes = raw[t]["Close"] if is_multi else raw["Close"]
                valid = closes.dropna()
                if len(valid) >= 1:
                    price = float(valid.iloc[-1])
                    prev = float(valid.iloc[-2]) if len(valid) >= 2 else price
                    change = ((price - prev) / prev * 100) if prev else 0.0
                    if not math.isnan(price) and price > 0:
                        decimals = 8 if price < 0.01 else 4
                        results[t] = {"price": round(price, decimals), "change_1d": round(change, 2)}
            except (KeyError, IndexError, TypeError):
                pass
    except Exception:
        pass
    return results

router = APIRouter(prefix="/api/market", tags=["market"])


@router.post("/refresh")
def refresh_quotes(db: Session = Depends(get_db)):
    """Fetch current quotes from Yahoo Finance and save to database."""
    assets = db.query(Asset).all()
    if not assets:
        return {"success": True, "count": 0, "quotes": [], "errors": []}

    quotes_saved = []
    errors = []

    for asset in assets:
        ticker = asset.id
        try:
            result = fetch_single_ticker(ticker)
            if result:
                import math as _math
                price = result["price"]
                if price is None or (isinstance(price, float) and _math.isnan(price)):
                    errors.append({"ticker": ticker, "error": "NaN price skipped"})
                    continue
                currency = result["currency"] or asset.currency or "USD"

                # Save quote
                change = result["change_percent"] or 0.0
                db.add(Quote(
                    ticker=ticker,
                    asset_name=asset.name,
                    index_name="",
                    price=price,
                    currency=currency,
                    change_percent=change,
                ))

                # Update asset
                asset.price = price
                asset.change_1d = change
                asset.currency = currency

                quotes_saved.append({
                    "ticker": ticker,
                    "asset_name": asset.name,
                    "price": price,
                    "currency": currency,
                    "change_percent": change,
                })
            else:
                errors.append({"ticker": ticker, "error": "No data available"})
        except Exception as e:
            errors.append({"ticker": ticker, "error": str(e)})

        time.sleep(0.1)

    db.commit()
    return {"success": True, "count": len(quotes_saved), "quotes": quotes_saved, "errors": errors}


@router.get("/quotes")
def get_quotes(db: Session = Depends(get_db)):
    """Get latest stored quotes for all assets."""
    assets = db.query(Asset).all()
    return [
        {
            "ticker": a.id,
            "name": a.name,
            "asset_type": a.asset_type,
            "price": a.price,
            "change_1d": a.change_1d,
            "currency": a.currency,
            "last_updated": a.last_updated.isoformat() if a.last_updated else None,
        }
        for a in assets
    ]


@router.get("/history/{ticker}")
def get_history(
    ticker: str,
    period: str = Query("1y", description="1w|1m|3m|1y|3y|5y|10y|30y|max"),
    db: Session = Depends(get_db),
):
    """OHLCV + MA/BB overlays for charts."""
    from services.analytics import get_chart_data, PERIOD_DAYS
    from services.fetcher import fetch_ohlcv
    from services.analytics import compute_all_indicators
    from database.models import Indicator
    from datetime import date as date_cls, timedelta
    import math
    from sqlalchemy.exc import IntegrityError

    ticker_upper = ticker.upper()
    days = PERIOD_DAYS.get(period, 365)
    limit = max(days + 200, 460)

    rows = (
        db.query(PriceHistory)
        .filter_by(ticker=ticker_upper)
        .order_by(PriceHistory.date.desc())
        .limit(limit)
        .all()
    )

    # Check staleness: if most recent row is older than 2 days, backfill from YF
    needs_backfill = False
    if not rows:
        needs_backfill = True
        fetch_period = "max"
    else:
        latest_date_str = rows[0].date  # desc order → rows[0] is newest
        try:
            latest_date = date_cls.fromisoformat(latest_date_str)
        except (ValueError, TypeError):
            latest_date = date_cls.today() - timedelta(days=30)
        gap_days = (date_cls.today() - latest_date).days
        if gap_days > 2:
            needs_backfill = True
            # Only fetch the missing window to avoid re-inserting all history
            fetch_period = "1y" if gap_days < 365 else "max"

    if needs_backfill:
        hist = fetch_ohlcv(ticker_upper, period=fetch_period)
        if hist:
            valid_hist = [
                r for r in hist
                if r.get("close") is not None
                and not (isinstance(r["close"], float) and math.isnan(r["close"]))
            ]
            # Get existing dates to avoid unique-constraint errors
            existing_dates = {
                r.date for r in db.query(PriceHistory.date).filter_by(ticker=ticker_upper).all()
            }
            new_rows = [r for r in valid_hist if r["date"] not in existing_dates]
            for row in new_rows:
                db.add(PriceHistory(
                    ticker=ticker_upper,
                    date=row["date"],
                    open=row.get("open"),
                    high=row.get("high"),
                    low=row.get("low"),
                    close=row["close"],
                    volume=row.get("volume"),
                ))
            if new_rows:
                try:
                    db.commit()
                except IntegrityError:
                    db.rollback()

                # Recompute indicators with all available history
                all_rows = (
                    db.query(PriceHistory)
                    .filter_by(ticker=ticker_upper)
                    .order_by(PriceHistory.date.asc())
                    .limit(400)
                    .all()
                )
                if len(all_rows) >= 20:
                    rows_for_ind = [
                        {"date": r.date, "open": r.open, "high": r.high,
                         "low": r.low, "close": r.close, "volume": r.volume}
                        for r in all_rows
                    ]
                    inds = compute_all_indicators(rows_for_ind)
                    if inds:
                        db.merge(Indicator(ticker=ticker_upper, **inds))
                        try:
                            db.commit()
                        except IntegrityError:
                            db.rollback()

            # Re-query with fresh data
            rows = (
                db.query(PriceHistory)
                .filter_by(ticker=ticker_upper)
                .order_by(PriceHistory.date.desc())
                .limit(limit)
                .all()
            )

    if not rows:
        return []

    rows_data = [
        {
            "date": r.date,
            "open": r.open,
            "high": r.high,
            "low": r.low,
            "close": r.close,
            "volume": r.volume,
        }
        for r in reversed(rows)
    ]
    return get_chart_data(rows_data, period)


@router.get("/assets")
def list_assets(db: Session = Depends(get_db)):
    """Get all assets in the database."""
    assets = db.query(Asset).all()
    return [
        {
            "ticker": a.id,
            "name": a.name,
            "asset_type": a.asset_type,
            "isin": a.isin,
            "sector": a.sector,
            "price": a.price,
            "change_1d": a.change_1d,
            "currency": a.currency,
        }
        for a in assets
    ]


@router.post("/assets")
def add_asset(data: dict, db: Session = Depends(get_db)):
    """Add a custom asset to track."""
    ticker = data.get("ticker", "").upper().strip()
    name = data.get("name", "").strip()
    asset_type = data.get("asset_type", "stock")

    if not ticker or not name:
        raise HTTPException(status_code=400, detail="ticker and name are required")

    # Validate on Yahoo Finance
    from services.fetcher import validate_ticker
    if not validate_ticker(ticker):
        raise HTTPException(status_code=404, detail=f"Ticker '{ticker}' not found on Yahoo Finance")

    existing = db.query(Asset).filter_by(id=ticker).first()
    if existing:
        return {"success": True, "ticker": ticker, "name": name, "message": "Already exists"}

    db.add(Asset(
        id=ticker,
        symbol=ticker,
        name=name,
        asset_type=asset_type,
        isin=data.get("isin", ""),
        sector=data.get("sector", ""),
    ))
    db.commit()
    return {"success": True, "ticker": ticker, "name": name}


@router.delete("/assets/{ticker}")
def remove_asset(ticker: str, db: Session = Depends(get_db)):
    """Remove a custom asset."""
    asset = db.query(Asset).filter_by(id=ticker.upper()).first()
    if asset:
        db.delete(asset)
        db.commit()
    return {"success": True}


# ── Search & Browse ──────────────────────────────────────────────────────────

@router.get("/search")
def search(
    q: str = Query(""),
    index: str | None = Query(None),
):
    """Search companies by name, ticker or ISIN across all indices."""
    return search_companies(q, index)


@router.get("/search/isin/{isin}")
def search_isin(isin: str):
    """Search for a company by ISIN code."""
    company = search_by_isin(isin)
    if company:
        return {"found": True, "source": "index", **company}
    return {"found": False, "error": f"ISIN '{isin}' not found in registry."}


@router.get("/search/yf")
def search_yf(q: str = Query("")):
    """Search Yahoo Finance for any ticker/ETF not in local registry."""
    if not q.strip():
        raise HTTPException(status_code=400, detail="q parameter required")
    return search_yahoo_finance(q.strip())


@router.get("/browse/{index_name}")
def browse_index(index_name: str, db: Session = Depends(get_db)):
    """Browse all companies in a given index, with live prices for non-tracked tickers."""
    from services.companies import get_all_index_companies, INDEX_REGISTRY, INDEX_CURRENCY

    tracked_assets = {
        a.id: {
            "price": a.price,
            "change_1d": a.change_1d,
            "name": a.name,
            "asset_type": a.asset_type,
            "currency": a.currency or "USD",
        }
        for a in db.query(Asset).all()
    }

    if index_name == "custom":
        registry_tickers = {c["ticker"] for c in get_all_index_companies()}
        custom = []
        for t, data in tracked_assets.items():
            if t not in registry_tickers:
                custom.append({
                    "ticker": t,
                    "name": data["name"],
                    "asset_type": data["asset_type"],
                    "index": "Mis Activos",
                    "index_id": "custom",
                    "tracked": True,
                    "price": data["price"],
                    "change_1d": data["change_1d"],
                    "market_cap": None,
                    "currency": data["currency"],
                })
        return custom

    index_info = INDEX_REGISTRY.get(index_name, {})
    default_currency = INDEX_CURRENCY.get(index_info.get("name", ""), "USD")

    all_companies = get_all_index_companies()
    index_companies = [c for c in all_companies if c.get("index_id") == index_name]
    all_tickers = [c["ticker"] for c in index_companies]

    # Kick off background market-cap fetch (no-op if already running or fresh)
    _ensure_mcap_cache(all_tickers)

    # Collect tickers needing a live fetch: no price in DB, OR price but change_1d=0
    missing_tickers = [
        c["ticker"] for c in index_companies
        if not (tracked_assets.get(c["ticker"]) or {}).get("price")
        or not (tracked_assets.get(c["ticker"]) or {}).get("change_1d")
    ]

    # Serve prices from cache when fresh
    cached_prices: dict[str, dict] = {}
    with _browse_cache_lock:
        entry = _browse_cache.get(index_name)
        if entry and (datetime.utcnow() - entry["ts"]) < _CACHE_TTL:
            cached_prices = entry["prices"]

    # Batch-fetch prices for missing tickers if cache is cold
    if missing_tickers and not cached_prices:
        fetched = _batch_fetch_prices(missing_tickers)
        with _browse_cache_lock:
            _browse_cache[index_name] = {"ts": datetime.utcnow(), "prices": fetched}
        cached_prices = fetched

    # Snapshot market-cap cache (populated by background thread)
    with _mcap_cache_lock:
        mcap_snapshot = dict(_mcap_cache)

    companies = []
    for c in index_companies:
        t = c["ticker"]
        tracked = tracked_assets.get(t)
        live = cached_prices.get(t)

        tracked_price = tracked["price"] if tracked else None
        if tracked_price:
            price = tracked_price
            # Prefer live change_1d; None means "no data" (shown as — in UI)
            live_chg = live["change_1d"] if live else None
            db_chg = tracked["change_1d"] if tracked["change_1d"] else None
            change = live_chg if live_chg is not None else db_chg
            currency = tracked["currency"]
        elif live:
            price = live["price"]
            change = live["change_1d"]
            currency = default_currency
        else:
            price = 0.0
            change = 0.0
            currency = tracked["currency"] if tracked else default_currency

        companies.append({
            **c,
            "tracked": tracked is not None,
            "price": price,
            "change_1d": change,
            "market_cap": mcap_snapshot.get(t),
            "currency": currency,
        })
    return companies


@router.get("/indices")
def list_indices(db: Session = Depends(get_db)):
    """List available market indices."""
    from services.companies import INDEX_REGISTRY, get_all_index_companies
    
    registry_tickers = {c["ticker"] for c in get_all_index_companies()}
    custom_count = db.query(Asset).filter(Asset.id.not_in(registry_tickers)).count() if registry_tickers else db.query(Asset).count()
    
    return [
        {"id": k, "name": v["name"], "symbol": v["symbol"], "count": custom_count if k == "custom" else len(v["companies"])}
        for k, v in INDEX_REGISTRY.items()
    ]

@router.get("/{ticker}/analysis")
async def get_company_analysis(ticker: str, db: Session = Depends(get_db)):
    """Generate an AI company analysis scorecard using a local LLM."""
    from services.llm import generate_company_analysis
    
    asset = db.query(Asset).filter_by(id=ticker.upper()).first()
    company_name = asset.name if asset else ticker.upper()

    # Use database quote to avoid blocking the async event loop with yfinance
    quote = db.query(Quote).filter_by(ticker=ticker.upper()).first()
    financial_data = None
    if quote:
        financial_data = {
            "current_price": quote.price
        }

    analysis = await generate_company_analysis(ticker.upper(), company_name, financial_data)
    return analysis
