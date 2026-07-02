"""
services/analytics.py — Technical indicators: MA, RSI, MACD, Bollinger Bands, signal detection.

Migrated from: stock-dashboard/analytics.py
"""
import pandas as pd
import numpy as np
import logging

logger = logging.getLogger(__name__)


def compute_ma(series: pd.Series, window: int) -> pd.Series:
    """Simple Moving Average."""
    return series.rolling(window=window).mean()


def compute_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    """Relative Strength Index (exponential)."""
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=period - 1, min_periods=period).mean()
    avg_loss = loss.ewm(com=period - 1, min_periods=period).mean()
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def compute_macd(series: pd.Series, fast=12, slow=26, signal=9):
    """MACD line, signal line, and histogram."""
    ema_fast = series.ewm(span=fast, adjust=False).mean()
    ema_slow = series.ewm(span=slow, adjust=False).mean()
    macd = ema_fast - ema_slow
    signal_line = macd.ewm(span=signal, adjust=False).mean()
    return macd, signal_line, macd - signal_line


def compute_bollinger(series: pd.Series, window=20, num_std=2):
    """Bollinger Bands: upper, middle, lower."""
    mid = series.rolling(window=window).mean()
    std = series.rolling(window=window).std()
    return mid + num_std * std, mid, mid - num_std * std


def detect_signal(df: pd.DataFrame) -> str | None:
    """
    Detect signal from DataFrame with columns: ma20, ma50, rsi, close, support, resistance.
    Requires at least 2 rows. Returns signal name or None.
    """
    if len(df) < 2:
        return None
    today = df.iloc[-1]
    yesterday = df.iloc[-2]

    ma20_t, ma50_t = today.get("ma20"), today.get("ma50")
    ma20_y, ma50_y = yesterday.get("ma20"), yesterday.get("ma50")

    # MA crossovers (priority 1)
    if all(pd.notna(v) for v in [ma20_t, ma50_t, ma20_y, ma50_y]):
        if ma20_t > ma50_t and ma20_y <= ma50_y:
            return "golden_cross"
        if ma20_t < ma50_t and ma20_y >= ma50_y:
            return "death_cross"

    # RSI extremes
    rsi = today.get("rsi")
    if pd.notna(rsi):
        if rsi > 70:
            return "overbought"
        if rsi < 30:
            return "oversold"

    # Price breakouts
    close_t = today.get("close")
    resistance = today.get("resistance")
    support = today.get("support")
    if pd.notna(close_t) and pd.notna(resistance) and close_t > resistance:
        return "breakout_up"
    if pd.notna(close_t) and pd.notna(support) and close_t < support:
        return "breakout_down"

    # Surge / drop
    close_y = yesterday.get("close")
    if pd.notna(close_t) and pd.notna(close_y) and close_y > 0:
        pct = (close_t - close_y) / close_y * 100
        if pct > 5:
            return "surge"
        if pct < -5:
            return "drop"

    return None


def _safe_float(val) -> float | None:
    """Convert value to float, returning None for NaN/invalid."""
    try:
        f = float(val)
        return None if np.isnan(f) else round(f, 4)
    except (TypeError, ValueError):
        return None


def compute_all_indicators(rows: list[dict]) -> dict | None:
    """
    Compute all indicators from OHLCV rows.
    Returns dict with indicator values and detected signal, or None if insufficient data.
    """
    if len(rows) < 20:
        return None

    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)
    close = df["close"]

    df["ma20"] = compute_ma(close, 20)
    df["ma50"] = compute_ma(close, 50)
    df["ma200"] = compute_ma(close, 200)
    df["rsi"] = compute_rsi(close)
    df["macd"], df["macd_signal"], df["macd_hist"] = compute_macd(close)
    df["bb_upper"], df["bb_mid"], df["bb_lower"] = compute_bollinger(close)

    window = min(60, len(df))
    df["support"] = df["low"].rolling(window).min()
    df["resistance"] = df["high"].rolling(window).max()

    signal = detect_signal(df[["ma20", "ma50", "rsi", "close", "support", "resistance"]])

    latest = df.iloc[-1]
    date_str = latest["date"].strftime("%Y-%m-%d")

    return {
        "date": date_str,
        "ma20": _safe_float(latest["ma20"]),
        "ma50": _safe_float(latest["ma50"]),
        "ma200": _safe_float(latest["ma200"]),
        "rsi": _safe_float(latest["rsi"]),
        "macd": _safe_float(latest["macd"]),
        "macd_signal": _safe_float(latest["macd_signal"]),
        "macd_hist": _safe_float(latest["macd_hist"]),
        "bb_upper": _safe_float(latest["bb_upper"]),
        "bb_mid": _safe_float(latest["bb_mid"]),
        "bb_lower": _safe_float(latest["bb_lower"]),
        "support": _safe_float(latest["support"]),
        "resistance": _safe_float(latest["resistance"]),
        "signal_type": signal,
    }


PERIOD_DAYS = {"1w": 7, "1m": 30, "3m": 90, "1y": 365, "3y": 1095, "5y": 1825, "10y": 3650, "30y": 10950, "max": 20000}


def get_chart_data(rows: list[dict], period: str = "1y") -> list[dict]:
    """
    Return OHLCV + MA + BB overlays for charts.
    Computed on-the-fly from price_history rows.
    """
    if not rows:
        return []

    days = PERIOD_DAYS.get(period, 365)

    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)
    close = df["close"]

    df["ma20"] = compute_ma(close, 20)
    df["ma50"] = compute_ma(close, 50)
    df["ma200"] = compute_ma(close, 200)
    df["bb_upper"], df["bb_mid"], df["bb_lower"] = compute_bollinger(close)

    df = df.tail(days).reset_index(drop=True)

    return [
        {
            "date": row["date"].strftime("%Y-%m-%d"),
            "open": _safe_float(row["open"]),
            "high": _safe_float(row["high"]),
            "low": _safe_float(row["low"]),
            "close": _safe_float(row["close"]),
            "volume": int(row["volume"]) if pd.notna(row.get("volume")) else None,
            "ma20": _safe_float(row["ma20"]),
            "ma50": _safe_float(row["ma50"]),
            "ma200": _safe_float(row["ma200"]),
            "bb_upper": _safe_float(row["bb_upper"]),
            "bb_mid": _safe_float(row["bb_mid"]),
            "bb_lower": _safe_float(row["bb_lower"]),
        }
        for _, row in df.iterrows()
    ]
