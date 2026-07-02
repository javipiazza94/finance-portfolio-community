"""
services/news.py — Fetch news for a ticker via NewsAPI with yfinance fallback.

Migrated from: stock-dashboard/news.py
"""
import os
import time
import logging
from datetime import datetime, timezone

import requests
import yfinance as yf

logger = logging.getLogger(__name__)

NEWSAPI_URL = "https://newsapi.org/v2/everything"
CACHE_TTL = 900  # 15 min — avoids burning NewsAPI free-tier rate limit

_news_cache: dict = {}


def _normalize_newsapi(article: dict) -> dict:
    return {
        "title": article.get("title", ""),
        "url": article.get("url", ""),
        "source": article.get("source", {}).get("name", ""),
        "published_at": article.get("publishedAt", ""),
        "image_url": article.get("urlToImage") or "",
    }


def _normalize_yfinance(item: dict) -> dict:
    # yfinance ≥0.2.x wraps all data inside item["content"]
    content = item.get("content") or item
    pub_raw = content.get("pubDate") or ""
    # Legacy format had providerPublishTime as unix timestamp
    if not pub_raw:
        ts = item.get("providerPublishTime", 0)
        try:
            pub_raw = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        except Exception:
            pub_raw = ""
    # URL: prefer canonicalUrl, fall back to clickThroughUrl, then link
    url = (
        (content.get("canonicalUrl") or {}).get("url")
        or (content.get("clickThroughUrl") or {}).get("url")
        or content.get("link", "")
        or item.get("link", "")
    )
    # Image: thumbnail.originalUrl
    thumbnail = content.get("thumbnail") or {}
    image_url = thumbnail.get("originalUrl") or ""
    return {
        "title": content.get("title") or item.get("title", ""),
        "url": url,
        "source": (content.get("provider") or {}).get("displayName") or item.get("publisher", ""),
        "published_at": pub_raw,
        "image_url": image_url,
    }


def fetch_news(ticker: str, asset_name: str, limit: int = 10) -> list[dict]:
    """Fetch news for an asset. Tries NewsAPI first, falls back to yfinance.
    Results are cached for 15 min per (ticker, limit) pair."""
    cache_key = f"{ticker}:{limit}"
    entry = _news_cache.get(cache_key)
    if entry and time.time() - entry["ts"] < CACHE_TTL:
        return entry["data"]

    api_key = os.environ.get("NEWSAPI_KEY", "")

    if api_key:
        try:
            resp = requests.get(
                NEWSAPI_URL,
                params={
                    "q": asset_name,
                    "apiKey": api_key,
                    "pageSize": limit,
                    "sortBy": "publishedAt",
                    "language": "en",
                },
                timeout=5,
            )
            if resp.status_code == 200:
                articles = resp.json().get("articles", [])
                result = [_normalize_newsapi(a) for a in articles[:limit]]
                _news_cache[cache_key] = {"data": result, "ts": time.time()}
                return result
        except Exception as e:
            logger.debug(f"[news] NewsAPI error: {e}")

    # Fallback: yfinance news
    try:
        t = yf.Ticker(ticker)
        items = t.news or []
        result = [_normalize_yfinance(i) for i in items[:limit]]
        _news_cache[cache_key] = {"data": result, "ts": time.time()}
        return result
    except Exception:
        return []
