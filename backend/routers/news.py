"""
routers/news.py — News endpoint for fetching news by ticker.

Migrated from: stock-dashboard/app.py
"""
from fastapi import APIRouter, Query

from services.news import fetch_news
from services.companies import get_all_index_companies

router = APIRouter(prefix="/api/news", tags=["news"])


@router.get("/{ticker}")
def get_news(ticker: str, limit: int = Query(10, ge=1, le=50)):
    """News for a ticker: NewsAPI → yfinance fallback."""
    all_companies = get_all_index_companies()
    asset_name = next(
        (c["name"] for c in all_companies if c["ticker"] == ticker.upper()),
        ticker,
    )
    return fetch_news(ticker.upper(), asset_name, limit=limit)
