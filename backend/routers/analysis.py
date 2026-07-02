"""
routers/analysis.py — Technical analysis endpoints: indicators, trends, signals, AI summary.

Migrated from: stock-dashboard/app.py (indicator endpoints)
"""
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from config import LM_STUDIO_URL
from database.connection import get_db
from database.models import Indicator, Quote

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


@router.get("/indicators/{ticker}")
def get_indicators(ticker: str, db: Session = Depends(get_db)):
    """Latest pre-computed indicators for a ticker."""
    result = (
        db.query(Indicator)
        .filter_by(ticker=ticker.upper())
        .order_by(Indicator.date.desc())
        .first()
    )
    if not result:
        from services.fetcher import fetch_ohlcv
        from services.analytics import compute_all_indicators
        from database.models import PriceHistory
        import time

        hist = fetch_ohlcv(ticker.upper(), period="5y")
        if hist:
            from sqlalchemy.exc import IntegrityError

            # Cache price history — skip rows with NaN close (nullable=False constraint)
            import math
            valid_hist = [
                r for r in hist
                if r.get("close") is not None and not (isinstance(r["close"], float) and math.isnan(r["close"]))
            ]
            for row in valid_hist:
                db.add(PriceHistory(
                    ticker=ticker.upper(),
                    date=row["date"],
                    open=row.get("open"),
                    high=row.get("high"),
                    low=row.get("low"),
                    close=row["close"],
                    volume=row.get("volume"),
                ))
            try:
                db.commit()
            except IntegrityError:
                db.rollback()
            hist = valid_hist  # use filtered list for indicator computation below

            # Compute and persist indicators in a separate transaction
            if len(hist) >= 20:
                inds = compute_all_indicators(hist)
                if inds:
                    db.merge(Indicator(ticker=ticker.upper(), **inds))
                    try:
                        db.commit()
                    except IntegrityError:
                        db.rollback()

            result = (
                db.query(Indicator)
                .filter_by(ticker=ticker.upper())
                .order_by(Indicator.date.desc())
                .first()
            )

    if not result:
        return None

    from database.models import Asset
    asset = db.query(Asset).filter_by(id=result.ticker).first()
    asset_name = asset.name if asset else result.ticker
    currency = asset.currency if asset else "USD"

    return {
        "ticker": result.ticker,
        "name": asset_name,
        "currency": currency,
        "date": result.date,
        "ma20": result.ma20,
        "ma50": result.ma50,
        "ma200": result.ma200,
        "rsi": result.rsi,
        "macd": result.macd,
        "macd_signal": result.macd_signal,
        "macd_hist": result.macd_hist,
        "bb_upper": result.bb_upper,
        "bb_mid": result.bb_mid,
        "bb_lower": result.bb_lower,
        "support": result.support,
        "resistance": result.resistance,
        "signal_type": result.signal_type,
    }


@router.get("/trends")
def get_trends(db: Session = Depends(get_db)):
    """Tickers with active signals in the latest compute cycle."""
    from sqlalchemy import func

    # Get latest indicator date per ticker where signal exists
    subq = (
        db.query(
            Indicator.ticker,
            func.max(Indicator.date).label("max_date"),
        )
        .filter(Indicator.signal_type.isnot(None))
        .group_by(Indicator.ticker)
        .subquery()
    )

    results = (
        db.query(Indicator)
        .join(subq, (Indicator.ticker == subq.c.ticker) & (Indicator.date == subq.c.max_date))
        .all()
    )

    return [
        {
            "ticker": r.ticker,
            "signal_type": r.signal_type,
            "rsi": r.rsi,
            "ma20": r.ma20,
            "ma50": r.ma50,
            "date": r.date,
        }
        for r in results
    ]


@router.get("/signals")
def get_active_signals(db: Session = Depends(get_db)):
    """All active signals with asset info."""
    from sqlalchemy import func

    subq = (
        db.query(
            Indicator.ticker,
            func.max(Indicator.date).label("max_date"),
        )
        .filter(Indicator.signal_type.isnot(None))
        .group_by(Indicator.ticker)
        .subquery()
    )

    indicators = (
        db.query(Indicator)
        .join(subq, (Indicator.ticker == subq.c.ticker) & (Indicator.date == subq.c.max_date))
        .all()
    )

    from database.models import Asset
    result = []
    for ind in indicators:
        asset = db.query(Asset).filter_by(id=ind.ticker).first()
        result.append({
            "ticker": ind.ticker,
            "asset_name": asset.name if asset else ind.ticker,
            "price": asset.price if asset else None,
            "change_1d": asset.change_1d if asset else None,
            "signal_type": ind.signal_type,
            "rsi": ind.rsi,
            "ma20": ind.ma20,
            "ma50": ind.ma50,
            "date": ind.date,
        })

    return result


@router.get("/{ticker}/ai-summary")
async def get_ai_summary(ticker: str, db: Session = Depends(get_db)):
    """LM Studio AI analysis for a ticker based on its latest technical indicators."""
    ind = (
        db.query(Indicator)
        .filter_by(ticker=ticker.upper())
        .order_by(Indicator.date.desc())
        .first()
    )
    if not ind:
        raise HTTPException(
            status_code=404,
            detail=f"No hay indicadores para {ticker}. Carga primero /analysis/indicators/{ticker}",
        )

    from database.models import Asset
    asset = db.query(Asset).filter_by(id=ind.ticker).first()
    name = asset.name if asset else ticker
    currency = asset.currency if asset else "USD"
    price = asset.price if asset else None
    change_1d = asset.change_1d if asset else None

    def _fmt(v, d=2):
        return f"{v:.{d}f}" if v is not None else "N/D"

    prompt = (
        f"Eres un analista financiero experto. Analiza brevemente el activo {ticker} ({name}) "
        f"con los siguientes indicadores técnicos:\n\n"
        f"- Precio actual: {_fmt(price)} {currency}\n"
        f"- Variación diaria: {f'{change_1d:+.2f}%' if change_1d is not None else 'N/D'}\n"
        f"- RSI(14): {_fmt(ind.rsi, 1)}\n"
        f"- MACD: {_fmt(ind.macd, 4)} | Señal MACD: {_fmt(ind.macd_signal, 4)}\n"
        f"- MA20: {_fmt(ind.ma20)} | MA50: {_fmt(ind.ma50)} | MA200: {_fmt(ind.ma200)}\n"
        f"- Bollinger: {_fmt(ind.bb_upper)} / {_fmt(ind.bb_mid)} / {_fmt(ind.bb_lower)}\n"
        f"- Soporte: {_fmt(ind.support)} | Resistencia: {_fmt(ind.resistance)}\n"
        f"- Señal técnica: {ind.signal_type or 'Ninguna'}\n\n"
        "Proporciona un análisis técnico conciso en 3-4 frases en español. "
        "Sé directo sobre la situación actual, el momentum y los niveles clave."
    )

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(
                f"{LM_STUDIO_URL}/v1/chat/completions",
                json={
                    "model": "local-model",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.4,
                    "max_tokens": 300,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            analysis = data["choices"][0]["message"]["content"].strip()
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="LM Studio no está disponible en localhost:1234. Ábrelo y carga un modelo.",
        )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="LM Studio tardó demasiado en responder.")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Error en LM Studio: {exc}")

    return {
        "ticker": ticker.upper(),
        "analysis": analysis,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model": data.get("model", "local-model"),
    }
