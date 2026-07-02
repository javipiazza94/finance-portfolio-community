"""backend/tests/test_analysis_ai_summary.py — /api/analysis/{ticker}/ai-summary provider routing.

Covers Important #1 of the final review: this endpoint used to talk directly
to LM Studio regardless of LLM_PROVIDER. It must now route through
services.llm.providers.get_provider like the rest of the app, and a provider
failure must surface as a generic 502 (not the old Spanish LM-Studio-specific
error).
"""
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database.connection import Base
from database.models import Asset, Indicator
import routers.analysis as analysis_router


class _StubProvider:
    def __init__(self, content: str):
        self._content = content

    async def complete(self, system: str, user: str) -> str:
        return self._content


class _FailingProvider:
    async def complete(self, system: str, user: str) -> str:
        raise RuntimeError("provider unreachable")


def _build_test_app(session_factory):
    """Minimal FastAPI app wrapping only the analysis router, DB-overridden.

    Avoids main.py's lifespan (init_db/seed/scheduler) entirely — this test
    only needs the router under test wired to an isolated in-memory DB.
    """
    app = FastAPI()
    app.include_router(analysis_router.router)

    def _override_get_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[analysis_router.get_db] = _override_get_db
    return app


def _seed_ticker(session_factory, ticker="AAPL"):
    db = session_factory()
    db.add(Asset(id=ticker, symbol=ticker, name="Apple Inc.", currency="USD", price=150.0, change_1d=1.2))
    db.add(Indicator(ticker=ticker, date="2026-07-01", rsi=55.0, ma20=148.0, ma50=145.0))
    db.commit()
    db.close()


def _make_session_factory(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'test_ai_summary.db'}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


def test_ai_summary_uses_configured_provider(tmp_path, monkeypatch):
    session_factory = _make_session_factory(tmp_path)
    _seed_ticker(session_factory)

    monkeypatch.setattr(analysis_router, "get_provider", lambda name: _StubProvider("Momentum is bullish."))
    monkeypatch.setattr(analysis_router.config, "LLM_PROVIDER", "ollama")

    app = _build_test_app(session_factory)
    client = TestClient(app)

    resp = client.get("/api/analysis/AAPL/ai-summary")

    assert resp.status_code == 200
    body = resp.json()
    assert body["analysis"] == "Momentum is bullish."
    assert body["model"] == "ollama"
    assert body["ticker"] == "AAPL"


def test_ai_summary_provider_error_maps_to_502_generic_message(tmp_path, monkeypatch):
    session_factory = _make_session_factory(tmp_path)
    _seed_ticker(session_factory)

    monkeypatch.setattr(analysis_router, "get_provider", lambda name: _FailingProvider())
    monkeypatch.setattr(analysis_router.config, "LLM_PROVIDER", "ollama")

    app = _build_test_app(session_factory)
    client = TestClient(app)

    resp = client.get("/api/analysis/AAPL/ai-summary")

    assert resp.status_code == 502
    detail = resp.json()["detail"]
    assert "ollama" in detail
    assert "LM Studio" not in detail
    assert "localhost:1234" not in detail
