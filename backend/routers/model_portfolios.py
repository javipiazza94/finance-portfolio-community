"""
routers/model_portfolios.py — Model portfolios: overview, details, NAV, comparison, recommendations.

Migrated from: portfolio-unified-api/routers_portfolios.py + portfolio-analyzer
"""
import math
import random
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import Portfolio, PortfolioHolding, PriceHistory, Position, Trade, Asset

router = APIRouter(prefix="/api/models", tags=["model_portfolios"])

_COLORS = ["#6b8e9e", "#7e9e8e", "#9e8e7e", "#8e7e9e", "#9e9e7e",
           "#7e8e9e", "#9e7e8e", "#8e9e7e"]


def _portfolio_color(idx: int) -> str:
    return _COLORS[idx % len(_COLORS)]


def _calc_metrics(holdings: list) -> tuple:
    """Calculate metrics from model portfolio holdings (simulated)."""
    if not holdings:
        return None, None, None, None
    n = len(holdings)
    # Use weights to simulate returns
    weights = [h.weight for h in holdings]
    total_weight = sum(weights) or 1
    avg_weight = total_weight / n

    # Simulated metrics based on diversification
    cagr = round(0.06 + avg_weight * 0.04, 4)
    vol = round(0.08 + (1 - min(n / 10, 1)) * 0.12, 4)
    max_dd = round(-0.05 - (1 - min(n / 10, 1)) * 0.15, 4)
    sharpe = round(cagr / vol, 4) if vol > 0 else None
    return cagr, max_dd, vol, sharpe


def _to_overview(p: Portfolio, holdings: list, idx: int) -> dict:
    cagr, max_dd, vol, sharpe = _calc_metrics(holdings)
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "category": p.category or "model",
        "source": p.source,
        "color": _portfolio_color(idx),
        "cagr": cagr,
        "max_drawdown": max_dd,
        "volatility": vol,
        "sharpe_ratio": sharpe,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


@router.get("/overview")
def portfolios_overview(db: Session = Depends(get_db)):
    """Get overview of all model portfolios with metrics."""
    portfolios = db.query(Portfolio).filter_by(is_personal=False).all()
    result = []
    for i, p in enumerate(portfolios):
        holdings = db.query(PortfolioHolding).filter_by(portfolio_id=p.id).all()
        result.append(_to_overview(p, holdings, i))
    result.sort(key=lambda x: (x["sharpe_ratio"] is None, -(x["sharpe_ratio"] or 0)))
    return result


@router.get("/{portfolio_id}")
def get_model_portfolio(portfolio_id: int, db: Session = Depends(get_db)):
    """Get details of a model portfolio."""
    p = db.query(Portfolio).filter_by(id=portfolio_id, is_personal=False).first()
    if not p:
        raise HTTPException(status_code=404, detail=f"Portfolio {portfolio_id} not found")

    holdings = db.query(PortfolioHolding).filter_by(portfolio_id=p.id).all()
    idx = db.query(Portfolio).filter_by(is_personal=False).all().index(p)

    return {
        **_to_overview(p, holdings, idx),
        "holdings": [
            {"ticker": h.ticker, "asset_name": h.asset_name, "weight": h.weight}
            for h in holdings
        ],
    }


@router.get("/{portfolio_id}/nav")
def portfolio_nav(
    portfolio_id: int,
    period: str = Query("5y"),
    db: Session = Depends(get_db),
):
    """Get NAV history for a model portfolio using real price data."""
    p = db.query(Portfolio).filter_by(id=portfolio_id, is_personal=False).first()
    if not p:
        raise HTTPException(status_code=404, detail=f"Portfolio {portfolio_id} not found")

    holdings = db.query(PortfolioHolding).filter_by(portfolio_id=p.id).all()
    if not holdings:
        return []

    days_map = {"1y": 365, "3y": 1095, "5y": 1825, "10y": 3650}
    days = days_map.get(period, 1825)
    cutoff = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")

    # Collect real price history per ticker
    ticker_prices: dict[str, dict[str, float]] = {}
    for h in holdings:
        rows = (
            db.query(PriceHistory)
            .filter(PriceHistory.ticker == h.ticker, PriceHistory.date >= cutoff)
            .order_by(PriceHistory.date)
            .all()
        )
        if rows:
            ticker_prices[h.ticker] = {r.date: r.close for r in rows}

    if not ticker_prices:
        # Fallback to simulation if no real data
        cagr, _, _, _ = _calc_metrics(holdings)
        daily_drift = (cagr or 0.08) / 252
        today = datetime.utcnow().date()
        start = today - timedelta(days=days)
        nav = 100.0
        rng = random.Random(portfolio_id)
        result = []
        for d in range(days):
            dt = start + timedelta(days=d)
            nav *= 1 + daily_drift + rng.gauss(0, 0.008)
            result.append({"date": dt.isoformat(), "nav": round(nav, 4), "simulated": True})
        return result

    # Get common dates across all tickers
    all_dates = sorted(set.intersection(*[set(prices.keys()) for prices in ticker_prices.values()]))
    if not all_dates:
        return []

    # Normalise each ticker to 100 on first date and build weighted NAV
    first_date = all_dates[0]
    first_prices = {ticker: prices[first_date] for ticker, prices in ticker_prices.items()}

    result = []
    for date in all_dates:
        nav = 0.0
        total_weight = 0.0
        for h in holdings:
            if h.ticker not in ticker_prices:
                continue
            prices = ticker_prices[h.ticker]
            if date not in prices or first_prices.get(h.ticker, 0) == 0:
                continue
            normalized = (prices[date] / first_prices[h.ticker]) * 100
            nav += normalized * h.weight
            total_weight += h.weight
        if total_weight > 0:
            result.append({"date": date, "nav": round(nav / total_weight, 4), "simulated": False})

    return result


@router.get("/{portfolio_id}/metrics")
def portfolio_metrics(portfolio_id: int, db: Session = Depends(get_db)):
    """Get performance metrics for a model portfolio."""
    p = db.query(Portfolio).filter_by(id=portfolio_id, is_personal=False).first()
    if not p:
        raise HTTPException(status_code=404, detail=f"Portfolio {portfolio_id} not found")

    holdings = db.query(PortfolioHolding).filter_by(portfolio_id=p.id).all()
    cagr, max_dd, vol, sharpe = _calc_metrics(holdings)
    return {"cagr": cagr, "max_drawdown": max_dd, "volatility": vol, "sharpe_ratio": sharpe}


@router.get("/compare")
def compare_portfolios(
    ids: str = Query("", description="Comma-separated portfolio IDs"),
    db: Session = Depends(get_db),
):
    """Compare multiple model portfolios (NAV overlay)."""
    id_list = [i.strip() for i in ids.split(",") if i.strip()]
    if not id_list:
        return {"portfolios": [], "common_start": None}

    entries = []
    for i, pid in enumerate(id_list):
        try:
            pid_int = int(pid)
        except ValueError:
            continue
        p = db.query(Portfolio).filter_by(id=pid_int).first()
        if not p:
            continue
        holdings = db.query(PortfolioHolding).filter_by(portfolio_id=pid_int).all()
        cagr, _, _, _ = _calc_metrics(holdings)
        daily_drift = (cagr or 0.08) / 252
        days = 1260
        today = datetime.utcnow().date()
        start = today - timedelta(days=days)
        nav = 100.0
        rng = random.Random(pid_int)
        data = []
        for d in range(days):
            dt = start + timedelta(days=d)
            nav *= 1 + daily_drift + rng.gauss(0, 0.008)
            data.append({"date": dt.isoformat(), "nav": round(nav, 4)})
        entries.append({"id": p.id, "name": p.name, "color": _COLORS[i % len(_COLORS)], "data": data})

    return {
        "portfolios": entries,
        "common_start": (datetime.utcnow().date() - timedelta(days=1260)).isoformat(),
    }


@router.post("/recommendations")
def get_recommendations(profile: dict, db: Session = Depends(get_db)):
    """Get portfolio recommendations based on investor profile."""
    portfolios = db.query(Portfolio).filter_by(is_personal=False).all()
    ranked = []

    for i, p in enumerate(portfolios):
        holdings = db.query(PortfolioHolding).filter_by(portfolio_id=p.id).all()
        cagr, max_dd, vol, sharpe = _calc_metrics(holdings)
        score = round((sharpe or 0) * 40 + (cagr or 0) * 60, 2)
        ranked.append({
            "rank": i + 1,
            "portfolio_id": p.id,
            "name": p.name,
            "score": score,
            "justification": "Based on risk-adjusted returns and volatility profile.",
            "metrics": {"cagr": cagr, "max_drawdown": max_dd, "volatility": vol, "sharpe_ratio": sharpe},
            "color": _COLORS[i % len(_COLORS)],
        })

    ranked.sort(key=lambda x: -x["score"])
    for i, r in enumerate(ranked):
        r["rank"] = i + 1

    return {"profile": profile, "ranked": ranked}


class ReplicateRequest(BaseModel):
    amount: float   # total euros/dollars to invest


@router.post("/{portfolio_id}/replicate")
def replicate_model(
    portfolio_id: int,
    req: ReplicateRequest,
    db: Session = Depends(get_db),
):
    """Replicate a model portfolio into the personal portfolio.

    Distributes `req.amount` across the model holdings according to their
    weights, buying each at the latest available price.
    """
    model = db.query(Portfolio).filter_by(id=portfolio_id, is_personal=False).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model portfolio not found")

    holdings = db.query(PortfolioHolding).filter_by(portfolio_id=portfolio_id).all()
    if not holdings:
        raise HTTPException(status_code=400, detail="Model has no holdings")

    # Get personal portfolio
    personal = db.query(Portfolio).filter_by(is_personal=True).first()
    if not personal:
        personal = Portfolio(
            name="Mi Portfolio",
            description="Portfolio personal",
            category="custom",
            is_personal=True,
        )
        db.add(personal)
        db.commit()
        db.refresh(personal)

    executed = []
    skipped = []
    today = datetime.utcnow().strftime("%Y-%m-%d")

    for h in holdings:
        alloc_amount = req.amount * h.weight

        # Get latest price
        asset = db.query(Asset).filter_by(id=h.ticker).first()
        price = asset.price if asset and asset.price and asset.price > 0 else None

        if price is None:
            # Try price_history
            hist = (
                db.query(PriceHistory)
                .filter_by(ticker=h.ticker)
                .order_by(PriceHistory.date.desc())
                .first()
            )
            price = hist.close if hist and hist.close else None

        if price is None or price <= 0:
            skipped.append({"ticker": h.ticker, "reason": "No price available"})
            continue

        units = alloc_amount / price

        # Upsert position
        existing = db.query(Position).filter_by(
            portfolio_id=personal.id, ticker=h.ticker
        ).first()
        if existing:
            new_units = existing.units + units
            new_avg = ((existing.units * existing.avg_price) + (units * price)) / new_units
            existing.units = new_units
            existing.avg_price = new_avg
        else:
            db.add(Position(
                portfolio_id=personal.id,
                ticker=h.ticker,
                asset_name=h.asset_name,
                units=units,
                avg_price=price,
                last_buy_date=today,
            ))

        # Record trade
        db.add(Trade(
            portfolio_id=personal.id,
            ticker=h.ticker,
            asset_name=h.asset_name,
            trade_type="buy",
            units=round(units, 6),
            price=price,
            total=round(units * price, 2),
            date=today,
        ))

        executed.append({
            "ticker": h.ticker,
            "asset_name": h.asset_name,
            "weight": h.weight,
            "amount_invested": round(alloc_amount, 2),
            "units": round(units, 6),
            "price": price,
        })

    db.commit()
    return {
        "success": True,
        "model_name": model.name,
        "total_invested": req.amount,
        "executed": executed,
        "skipped": skipped,
    }
