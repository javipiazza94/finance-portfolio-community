"""backend/tests/test_seed.py — seed_assets must not crash on duplicate tickers across index registries."""
from unittest.mock import patch

from database.connection import Base, get_db_session
from database.seed import seed_assets
from database.models import Asset
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def test_seed_assets_handles_duplicate_tickers_across_registries(monkeypatch, tmp_path):
    db_path = tmp_path / "test_seed.db"
    engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine)

    import database.connection as connection_mod

    monkeypatch.setattr(connection_mod, "engine", engine)
    monkeypatch.setattr(connection_mod, "SessionLocal", TestSession)

    duplicate_companies = [
        {"ticker": "DUP", "name": "Duplicate Co (Registry A)", "asset_type": "stock", "index_id": "sp500"},
        {"ticker": "DUP", "name": "Duplicate Co (Registry B)", "asset_type": "stock", "index_id": "custom"},
        {"ticker": "UNIQ", "name": "Unique Co", "asset_type": "stock", "index_id": "sp500"},
    ]

    with patch("services.companies.get_all_index_companies", return_value=duplicate_companies), \
         patch("services.companies.INDEX_REGISTRY", {}):
        seed_assets()  # must not raise

    with get_db_session() as db:
        tickers = [a.id for a in db.query(Asset).all()]

    assert tickers.count("DUP") == 1
    assert "UNIQ" in tickers
