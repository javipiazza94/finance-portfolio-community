"""
routers/stream.py — Server-Sent Events (SSE) endpoint for real-time price updates.

Migrated from: portfolio-unified-api/app.py
"""
import asyncio
import json
from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import Asset

router = APIRouter(prefix="/api/stream", tags=["stream"])


@router.get("/prices")
async def stream_prices(db: Session = Depends(get_db)):
    """SSE endpoint for real-time asset price updates."""
    async def event_generator():
        while True:
            try:
                assets = db.query(Asset).limit(20).all()
                for asset in assets:
                    data = {
                        "event": "price_update",
                        "ticker": asset.id,
                        "name": asset.name,
                        "price": asset.price,
                        "change_1d": asset.change_1d,
                        "timestamp": datetime.utcnow().isoformat(),
                    }
                    yield f"data: {json.dumps(data)}\n\n"
                await asyncio.sleep(5)
            except Exception as e:
                print(f"SSE error: {e}")
                await asyncio.sleep(10)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
