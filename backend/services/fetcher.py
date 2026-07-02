"""
services/fetcher.py — Yahoo Finance data fetching with fallback strategies.

Migrated from: stock-dashboard/app.py (fetch_single_ticker)
"""
import yfinance as yf
import logging

logger = logging.getLogger(__name__)

# Mutual fund tickers not available on Yahoo Finance → mapped to equivalent working ticker.
# Prices will be fetched from the alias but stored under the original ticker ID.
TICKER_ALIASES: dict[str, str] = {
    "0P00017JAF.F": "0P0001CLDM.F",   # Fidelity S&P 500 Index Fund P-ACC-EUR
    "0P0000YB58.F": "0P0000CV2T.F",   # Vanguard 20+ Year Euro Treasury Index Fund
    "0P0001OD7O.F": "0P0001LKD2",     # iShares ESG Screened Global Corporate Bond
    "0P0001AYEF.F": "0P00011WU8",     # Vanguard Global Short-Term Corporate Bond
    "0P0001C2N5.F": "0P0000N5GE",     # iShares Emerging Markets Index Fund (old ticker)
    "0P00017JAG.F": "0P0001CJGR.F",   # Fidelity MSCI Japan Index Fund
    "0P00017JAH.F": "0P0001CJGN.F",   # Fidelity MSCI Europe Index Fund
    # Price corrections: wrong YF ticker → correct equivalent
    "EUNM.DE":      "0P0001XF3Z.F",   # iShares Emerging Markets Idx (IE) S Acc EUR — EUNM.DE returns wrong fund price
    "0P00017J9C.F": "0P00017J98.F",   # Jupiter Gold & Silver I→L class (same fund, correct NAV ~24 EUR)
    "B02.F":        "NXT.MC",          # Nueva Expresión Textil — Frankfurt vs Madrid price (BME matches broker)
}


def fetch_single_ticker(ticker: str) -> dict | None:
    """
    Fetch price data for a single ticker using yf.Ticker.
    Returns {price, change_percent, currency} or None.
    """
    fetch_ticker = TICKER_ALIASES.get(ticker, ticker)
    try:
        t = yf.Ticker(fetch_ticker)

        # Method 1: history for last 5 days (handles weekends/holidays)
        # Use dropna() because mutual funds may have NaN for the current day (NAV not published yet)
        hist = t.history(period="5d")
        if hist is not None and not hist.empty:
            valid_close = hist["Close"][hist["Close"] != 0.0].dropna()
            if valid_close.empty:
                return None
            price = float(valid_close.iloc[-1])
            # Get corresponding open for same date (may differ from last row)
            last_valid_idx = valid_close.index[-1]
            open_price_val = hist.loc[last_valid_idx, "Open"]
            open_price = float(open_price_val) if open_price_val == open_price_val else price
            change = ((price - open_price) / open_price) * 100 if open_price > 0 else 0.0

            currency = None
            try:
                info = t.fast_info
                currency = getattr(info, "currency", None)
            except Exception:
                pass

            return {
                "price": round(price, 2),
                "change_percent": round(change, 2),
                "currency": currency,
            }

        # Method 2: Fallback to fast_info
        try:
            info = t.fast_info
            price = getattr(info, "last_price", 0) or getattr(info, "previous_close", 0)
            prev_close = getattr(info, "previous_close", 0)
            currency = getattr(info, "currency", None)
            change = 0
            if prev_close and prev_close > 0 and price:
                change = ((price - prev_close) / prev_close) * 100

            if price and price > 0:
                return {
                    "price": round(price, 2),
                    "change_percent": round(change, 2),
                    "currency": currency,
                }
        except Exception:
            pass

    except Exception as e:
        logger.warning(f"[fetcher] error fetching {ticker} (alias={fetch_ticker}): {e}")

    return None


def fetch_ohlcv(ticker: str, period: str = "5d") -> list[dict]:
    """
    Fetch OHLCV history for a ticker.
    Returns list of {date, open, high, low, close, volume}.
    """
    try:
        fetch_ticker = TICKER_ALIASES.get(ticker, ticker)
        t = yf.Ticker(fetch_ticker)
        hist = t.history(period=period)
        if hist is None or hist.empty:
            return []

        rows = []
        for idx, row in hist.iterrows():
            if not row["Close"] or row["Close"] == 0.0:
                continue
            rows.append({
                "date": idx.strftime("%Y-%m-%d"),
                "open": round(float(row["Open"]), 4) if row["Open"] else None,
                "high": round(float(row["High"]), 4) if row["High"] else None,
                "low": round(float(row["Low"]), 4) if row["Low"] else None,
                "close": round(float(row["Close"]), 4),
                "volume": int(row["Volume"]) if row["Volume"] else None,
            })
        return rows
    except Exception as e:
        logger.warning(f"[fetcher] error fetching OHLCV for {ticker}: {e}")
        return []


def search_yahoo_finance(query: str, max_results: int = 10) -> list[dict]:
    """
    Search Yahoo Finance for any ticker/ETF not in local registry.
    Returns list of {ticker, name, exchange, type}.
    """
    try:
        results = yf.Search(query, max_results=max_results)
        quotes = results.quotes if hasattr(results, "quotes") else []
        return [
            {
                "ticker": r.get("symbol", ""),
                "name": r.get("longname") or r.get("shortname", ""),
                "exchange": r.get("exchange", ""),
                "type": r.get("quoteType", ""),
            }
            for r in quotes
            if r.get("symbol")
        ]
    except AttributeError:
        return []
    except Exception as e:
        logger.warning(f"[fetcher] Yahoo search error: {e}")
        return []


MANUAL_TICKERS = {"0P0000KZUT.F", "OTROS.F"}

def validate_ticker(ticker: str) -> bool:
    """Check if a ticker is valid on Yahoo Finance."""
    if ticker in MANUAL_TICKERS:
        return True
    try:
        fetch_ticker = TICKER_ALIASES.get(ticker, ticker)
        t = yf.Ticker(fetch_ticker)
        hist = t.history(period="5d")
        if not hist.empty:
            return True
        info = t.fast_info
        return bool(getattr(info, "last_price", 0))
    except Exception:
        return False
