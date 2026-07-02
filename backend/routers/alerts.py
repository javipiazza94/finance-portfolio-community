"""
routers/alerts.py — Alert management and push notification endpoints.

Migrated from: stock-dashboard/app.py (alert/push endpoints)
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import MarketAlert, PushSubscription
from services.alerts import get_vapid_public_key

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("")
def get_alerts(limit: int = 50, db: Session = Depends(get_db)):
    """Last N triggered market alerts."""
    alerts = (
        db.query(MarketAlert)
        .order_by(MarketAlert.triggered_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": a.id,
            "ticker": a.ticker,
            "asset_name": a.asset_name,
            "alert_type": a.alert_type,
            "price": a.price,
            "detail": a.detail,
            "triggered_at": a.triggered_at.isoformat() if a.triggered_at else None,
            "notified": a.notified,
        }
        for a in alerts
    ]


@router.post("/push/subscribe")
def push_subscribe(data: dict, db: Session = Depends(get_db)):
    """Subscribe to push notifications."""
    if not all(k in data for k in ("endpoint", "p256dh", "auth")):
        raise HTTPException(status_code=400, detail="endpoint, p256dh and auth are required")

    existing = db.query(PushSubscription).filter_by(endpoint=data["endpoint"]).first()
    if existing:
        existing.p256dh = data["p256dh"]
        existing.auth = data["auth"]
    else:
        db.add(PushSubscription(
            endpoint=data["endpoint"],
            p256dh=data["p256dh"],
            auth=data["auth"],
        ))
    db.commit()
    return {"success": True}


@router.delete("/push/subscribe")
def push_unsubscribe(data: dict, db: Session = Depends(get_db)):
    """Unsubscribe from push notifications."""
    if "endpoint" not in data:
        raise HTTPException(status_code=400, detail="endpoint required")

    sub = db.query(PushSubscription).filter_by(endpoint=data["endpoint"]).first()
    if sub:
        db.delete(sub)
        db.commit()
    return {"success": True}


@router.get("/push/vapid-public-key")
def vapid_public_key():
    """Get the VAPID public key for frontend push registration."""
    key = get_vapid_public_key()
    if not key:
        raise HTTPException(status_code=503, detail="VAPID keys not generated")
    return {"key": key}
