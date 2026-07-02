"""
services/scheduler.py — Background scheduler for the data pipeline.

Runs hourly on weekdays during market hours:
  fetch quotes → save OHLCV → compute indicators → evaluate alerts → push notifications

Migrated from: stock-dashboard/scheduler.py
"""
import time
import logging
from datetime import date

from apscheduler.schedulers.background import BackgroundScheduler

logger = logging.getLogger(__name__)
_scheduler = None


def _run_pipeline():
    """Full hourly pipeline: fetch quotes → OHLCV → indicators → alerts."""
    try:
        from database.connection import get_db_session
        from database.models import (
            Asset, Quote, PriceHistory, Indicator, MarketAlert, PushSubscription,
        )
        from services.fetcher import fetch_single_ticker, fetch_ohlcv
        from services.analytics import compute_all_indicators
        from services.alerts import build_alert_detail, send_push_notifications
        from services.companies import get_all_index_companies, INDEX_CURRENCY

        today_str = date.today().strftime("%Y-%m-%d")

        with get_db_session() as db:
            # Get all tracked assets
            assets = db.query(Asset).all()
            if not assets:
                logger.info("[scheduler] no assets in DB — skipping pipeline")
                return

            for asset in assets:
                ticker = asset.id
                try:
                    result = fetch_single_ticker(ticker)
                    if not result:
                        continue

                    # Save quote snapshot
                    currency = result.get("currency") or asset.currency or "USD"
                    db.add(Quote(
                        ticker=ticker,
                        asset_name=asset.name,
                        index_name="",
                        price=result["price"],
                        currency=currency,
                        change_percent=result["change_percent"],
                    ))

                    # Update asset price
                    asset.price = result["price"]
                    asset.change_1d = result["change_percent"]

                    # Save daily OHLCV
                    ohlcv = fetch_ohlcv(ticker, period="5d")
                    if ohlcv:
                        last = ohlcv[-1]
                        existing = db.query(PriceHistory).filter_by(
                            ticker=ticker, date=last["date"]
                        ).first()
                        if not existing:
                            db.add(PriceHistory(
                                ticker=ticker,
                                date=last["date"],
                                open=last.get("open"),
                                high=last.get("high"),
                                low=last.get("low"),
                                close=last["close"],
                                volume=last.get("volume"),
                            ))

                    # Compute indicators
                    history_rows = (
                        db.query(PriceHistory)
                        .filter_by(ticker=ticker)
                        .order_by(PriceHistory.date.desc())
                        .limit(260)
                        .all()
                    )
                    if len(history_rows) >= 20:
                        rows_data = [
                            {
                                "date": r.date, "open": r.open, "high": r.high,
                                "low": r.low, "close": r.close, "volume": r.volume,
                            }
                            for r in reversed(history_rows)
                        ]
                        indicators = compute_all_indicators(rows_data)
                        if indicators:
                            existing_ind = db.query(Indicator).filter_by(
                                ticker=ticker, date=indicators["date"]
                            ).first()
                            if existing_ind:
                                for k, v in indicators.items():
                                    if k != "date":
                                        setattr(existing_ind, k, v)
                            else:
                                db.add(Indicator(ticker=ticker, **indicators))

                            # Check for signals → create alert
                            signal = indicators.get("signal_type")
                            if signal:
                                recent = db.query(MarketAlert).filter(
                                    MarketAlert.ticker == ticker,
                                    MarketAlert.alert_type == signal,
                                ).order_by(MarketAlert.triggered_at.desc()).first()

                                is_new = True
                                if recent and recent.triggered_at:
                                    from datetime import datetime, timedelta
                                    if datetime.utcnow() - recent.triggered_at < timedelta(hours=24):
                                        is_new = False

                                if is_new:
                                    detail = build_alert_detail(signal, result["price"])
                                    alert = MarketAlert(
                                        ticker=ticker,
                                        asset_name=asset.name,
                                        alert_type=signal,
                                        price=result["price"],
                                        detail=detail,
                                    )
                                    db.add(alert)
                                    db.flush()

                                    # Push notifications
                                    subs = db.query(PushSubscription).all()
                                    sub_list = [
                                        {"endpoint": s.endpoint, "p256dh": s.p256dh, "auth": s.auth}
                                        for s in subs
                                    ]
                                    send_push_notifications(
                                        ticker, asset.name, signal,
                                        result["price"], sub_list,
                                    )

                    time.sleep(0.1)  # Rate limiting
                except Exception as e:
                    logger.warning(f"[scheduler] error processing {ticker}: {e}")

        logger.info("[scheduler] pipeline completed")

    except Exception as e:
        logger.error(f"[scheduler] pipeline error: {e}")


def start_scheduler():
    """Start the background scheduler."""
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler()
    _scheduler.add_job(
        _run_pipeline,
        "cron",
        day_of_week="mon-fri",
        hour="9-17",
        minute=0,
        id="hourly_pipeline",
    )
    _scheduler.start()
    logger.info("[scheduler] started — hourly pipeline active (mon-fri 9:00-17:00)")


def stop_scheduler():
    """Stop the background scheduler."""
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("[scheduler] stopped")
