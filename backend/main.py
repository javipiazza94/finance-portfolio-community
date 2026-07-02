"""
main.py — FastAPI application factory.

Unified API for Finance-Portfolio:
  - Market data (quotes, history, search, browse)
  - Personal portfolio (buy/sell, positions, MiFID test)
  - Model portfolios (overview, NAV, compare, recommendations)
  - Technical analysis (indicators, trends, signals)
  - Alerts & push notifications
  - News
  - SSE streaming

Run:
  uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
"""
import logging
import atexit
from contextlib import asynccontextmanager

# pyrefly: ignore [missing-import]
from fastapi import FastAPI
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware

from config import CORS_ORIGINS, SCHEDULER_ENABLED
from database.connection import init_db
from database.seed import run_seed

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    # Startup
    logger.info("🚀 Initializing database...")
    init_db()

    logger.info("🌱 Running seed...")
    run_seed()

    if SCHEDULER_ENABLED:
        logger.info("⏰ Starting scheduler...")
        from services.scheduler import start_scheduler, stop_scheduler
        start_scheduler()
        atexit.register(stop_scheduler)

    logger.info("✅ Finance-Portfolio API ready")
    yield
    # Shutdown
    logger.info("👋 Shutting down...")


app = FastAPI(
    title="Finance-Portfolio API",
    description="Unified platform for real-time international market monitoring and personal investment portfolio management",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register routers ─────────────────────────────────────────────────────────

from routers.market import router as market_router
from routers.portfolios import router as portfolios_router
from routers.model_portfolios import router as model_portfolios_router
from routers.analysis import router as analysis_router
from routers.alerts import router as alerts_router
from routers.news import router as news_router
from routers.stream import router as stream_router
app.include_router(market_router)
app.include_router(portfolios_router)
app.include_router(model_portfolios_router)
app.include_router(analysis_router)
app.include_router(alerts_router)
app.include_router(news_router)
app.include_router(stream_router)


@app.get("/health")
def health_check():
    from datetime import datetime
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat(), "version": "1.0.0"}


@app.get("/")
def root():
    return {
        "name": "Finance-Portfolio API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }


if __name__ == "__main__":
    # pyrefly: ignore [missing-import]
    import uvicorn
    from config import API_HOST, API_PORT
    uvicorn.run(app, host=API_HOST, port=API_PORT)
