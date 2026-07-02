"""
services/alerts.py — Alert evaluation, storage, and Web Push notifications.

Migrated from: stock-dashboard/alerts.py + portfolio-analyzer/database.py (alert functions)
"""
import os
import json
import logging

logger = logging.getLogger(__name__)

SIGNAL_DETAILS = {
    "golden_cross": "Golden Cross: MA20 cruzó MA50 al alza",
    "death_cross": "Death Cross: MA20 cruzó MA50 a la baja",
    "overbought": "RSI > 70: zona de sobrecompra",
    "oversold": "RSI < 30: zona de sobreventa",
    "breakout_up": "Ruptura de resistencia al alza",
    "breakout_down": "Ruptura de soporte a la baja",
    "surge": "Subida > +5% en la sesión",
    "drop": "Caída > -5% en la sesión",
}


def build_alert_detail(signal_type: str, price: float) -> str:
    """Build human-readable alert detail string."""
    base = SIGNAL_DETAILS.get(signal_type, signal_type)
    return f"{base} · ${price:.2f}"


def send_push_notifications(
    ticker: str,
    asset_name: str,
    signal_type: str,
    price: float,
    subscriptions: list[dict],
):
    """Send Web Push to all registered subscriptions."""
    if not subscriptions:
        return

    vapid_private = _load_vapid_private()
    vapid_email = os.environ.get("VAPID_EMAIL", "mailto:admin@finance-portfolio.local")
    if not vapid_private:
        return

    payload = json.dumps({
        "ticker": ticker,
        "name": asset_name,
        "signal": signal_type,
        "detail": SIGNAL_DETAILS.get(signal_type, signal_type),
        "price": price,
    })

    try:
        from pywebpush import webpush
    except ImportError:
        logger.warning("[alerts] pywebpush not installed — skipping push")
        return

    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
                },
                data=payload,
                vapid_private_key=vapid_private,
                vapid_claims={"sub": vapid_email},
            )
        except Exception as e:
            logger.debug(f"[alerts] push failed for {sub['endpoint'][:50]}…: {e}")


def _load_vapid_private() -> str | None:
    """Load VAPID private key from file."""
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "vapid_private.pem")
    if os.path.exists(path):
        with open(path) as f:
            return f.read().strip()
    return None


def get_vapid_public_key() -> str | None:
    """Return base64url-encoded VAPID public key for the frontend."""
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "vapid_public.txt")
    if os.path.exists(path):
        with open(path) as f:
            return f.read().strip()
    return None


def generate_vapid_keys():
    """Generate VAPID key pair and save to vapid_private.pem + vapid_public.txt."""
    try:
        from py_vapid import Vapid
        import base64
        from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

        vapid = Vapid()
        vapid.generate_keys()
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        priv_path = os.path.join(base_dir, "vapid_private.pem")
        pub_path = os.path.join(base_dir, "vapid_public.txt")
        vapid.save_key(priv_path)
        raw_pub = vapid.public_key.public_bytes(
            encoding=Encoding.X962,
            format=PublicFormat.UncompressedPoint,
        )
        with open(pub_path, "w") as f:
            f.write(base64.urlsafe_b64encode(raw_pub).decode().rstrip("="))
        print(f"VAPID keys generated: {priv_path}, {pub_path}")
    except Exception as e:
        print(f"Could not generate VAPID keys: {e}")
