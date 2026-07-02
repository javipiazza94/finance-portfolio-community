"""
database/models.py — Unified SQLAlchemy ORM models.

Merges schemas from:
  - stock-dashboard (quotes, price_history, indicators, alerts, custom_assets, push_subscriptions)
  - portfolio-unified-api (assets, indices, index_assets, portfolios, portfolio_assets, asset_index_rankings)
  - portfolio-analyzer (portfolios, portfolio_holdings, alerts, alert_history)
"""
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey, Table,
    UniqueConstraint, Index as SQLIndex,
)
from sqlalchemy.orm import relationship
from datetime import datetime

from database.connection import Base


# ══════════════════════════════════════════════════════════════════════════════
# Association Tables
# ══════════════════════════════════════════════════════════════════════════════

index_assets = Table(
    "index_assets",
    Base.metadata,
    Column("index_id", String, ForeignKey("indices.id"), primary_key=True),
    Column("asset_id", String, ForeignKey("assets.id"), primary_key=True),
)


# ══════════════════════════════════════════════════════════════════════════════
# Core Market Data
# ══════════════════════════════════════════════════════════════════════════════

class Asset(Base):
    """A tradeable instrument (stock, ETF, commodity, crypto)."""
    __tablename__ = "assets"

    id = Column(String, primary_key=True)           # = symbol (e.g. "AAPL", "BTC-USD")
    symbol = Column(String, unique=True, index=True)
    name = Column(String, nullable=False)
    asset_type = Column(String, default="stock")     # stock, etf, commodity, crypto
    isin = Column(String, default="")
    sector = Column(String, default="")
    exchange = Column(String, default="")
    currency = Column(String, default="USD")

    # Latest price snapshot
    price = Column(Float, default=0.0)
    change_1d = Column(Float, default=0.0)
    change_1w = Column(Float, default=0.0)
    change_1m = Column(Float, default=0.0)
    change_1y = Column(Float, default=0.0)
    volatility = Column(Float, default=0.0)
    sharpe_ratio = Column(Float, default=0.0)

    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    indices = relationship("MarketIndex", secondary=index_assets, back_populates="assets")
    rankings = relationship("AssetIndexRanking", back_populates="asset")
    quotes = relationship("Quote", back_populates="asset", cascade="all, delete-orphan")
    price_history = relationship("PriceHistory", back_populates="asset", cascade="all, delete-orphan")
    indicators = relationship("Indicator", back_populates="asset", cascade="all, delete-orphan")


class MarketIndex(Base):
    """A market index (S&P 500, DAX, IBEX 35, etc.)."""
    __tablename__ = "indices"

    id = Column(String, primary_key=True)            # e.g. "sp500", "dax", "ibex35"
    name = Column(String, nullable=False)
    symbol = Column(String, index=True, default="") # e.g. "^GSPC"
    return_1y = Column(Float, default=0.0)
    volatility = Column(Float, default=0.0)
    sharpe_ratio = Column(Float, default=0.0)
    last_updated = Column(DateTime, default=datetime.utcnow)

    # Relationships
    assets = relationship("Asset", secondary=index_assets, back_populates="indices")
    rankings = relationship("AssetIndexRanking", back_populates="index")


class AssetIndexRanking(Base):
    """Ranking of an asset within a specific index."""
    __tablename__ = "asset_index_rankings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    asset_id = Column(String, ForeignKey("assets.id"), nullable=False)
    index_id = Column(String, ForeignKey("indices.id"), nullable=False)
    rank = Column(Integer)
    return_1y = Column(Float)
    sharpe_ratio = Column(Float)
    volatility = Column(Float)
    last_updated = Column(DateTime, default=datetime.utcnow)

    asset = relationship("Asset", back_populates="rankings")
    index = relationship("MarketIndex", back_populates="rankings")


# ══════════════════════════════════════════════════════════════════════════════
# Price Data & Technical Analysis
# ══════════════════════════════════════════════════════════════════════════════

class Quote(Base):
    """Real-time price snapshot for an asset."""
    __tablename__ = "quotes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String, ForeignKey("assets.id"), nullable=False, index=True)
    asset_name = Column(String, nullable=False)
    index_name = Column(String, default="")
    price = Column(Float, nullable=False)
    currency = Column(String, default="USD")
    change_percent = Column(Float, default=0.0)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    asset = relationship("Asset", back_populates="quotes")


class PriceHistory(Base):
    """Daily OHLCV candle data."""
    __tablename__ = "price_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String, ForeignKey("assets.id"), nullable=False)
    date = Column(String, nullable=False)
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float, nullable=False)
    volume = Column(Integer)

    asset = relationship("Asset", back_populates="price_history")

    __table_args__ = (
        UniqueConstraint("ticker", "date", name="uq_price_history_ticker_date"),
        SQLIndex("idx_ph_ticker_date", "ticker", "date"),
    )


class Indicator(Base):
    """Pre-computed technical indicators for a ticker on a date."""
    __tablename__ = "indicators"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String, ForeignKey("assets.id"), nullable=False)
    date = Column(String, nullable=False)

    # Moving averages
    ma20 = Column(Float)
    ma50 = Column(Float)
    ma200 = Column(Float)

    # RSI
    rsi = Column(Float)

    # MACD
    macd = Column(Float)
    macd_signal = Column(Float)
    macd_hist = Column(Float)

    # Bollinger Bands
    bb_upper = Column(Float)
    bb_mid = Column(Float)
    bb_lower = Column(Float)

    # Support / Resistance
    support = Column(Float)
    resistance = Column(Float)

    # Signal detection result
    signal_type = Column(String)

    asset = relationship("Asset", back_populates="indicators")

    __table_args__ = (
        UniqueConstraint("ticker", "date", name="uq_indicators_ticker_date"),
        SQLIndex("idx_ind_ticker_date", "ticker", "date"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# Portfolio Management
# ══════════════════════════════════════════════════════════════════════════════

class Portfolio(Base):
    """A portfolio — either a user-managed personal portfolio or a model portfolio."""
    __tablename__ = "portfolios"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    category = Column(String, default="custom")   # "custom", "model", "classic", "broker"
    source = Column(String, nullable=True)         # e.g. "Bogleheads", "Ray Dalio"
    is_personal = Column(Boolean, default=False)   # True = user's own portfolio
    total_value = Column(Float, default=0.0)
    cost_basis = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    holdings = relationship("PortfolioHolding", back_populates="portfolio", cascade="all, delete-orphan")
    positions = relationship("Position", back_populates="portfolio", cascade="all, delete-orphan")
    alerts = relationship("PortfolioAlert", back_populates="portfolio", cascade="all, delete-orphan")
    trades = relationship("Trade", back_populates="portfolio", cascade="all, delete-orphan")


class PortfolioHolding(Base):
    """Target allocation for a model portfolio (weight-based)."""
    __tablename__ = "portfolio_holdings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), nullable=False)
    ticker = Column(String, nullable=False)
    asset_name = Column(String, default="")
    weight = Column(Float, default=0.0)           # 0.0 – 1.0

    portfolio = relationship("Portfolio", back_populates="holdings")


class Position(Base):
    """Actual position in a personal portfolio (units + cost basis)."""
    __tablename__ = "positions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), nullable=False)
    ticker = Column(String, nullable=False)
    asset_name = Column(String, default="")
    units = Column(Float, default=0.0)
    avg_price = Column(Float, default=0.0)
    last_buy_date = Column(String, default="")

    portfolio = relationship("Portfolio", back_populates="positions")

    __table_args__ = (
        UniqueConstraint("portfolio_id", "ticker", name="uq_position_portfolio_ticker"),
    )


class Trade(Base):
    """Individual buy/sell operation record — full trade history."""
    __tablename__ = "trades"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), nullable=False)
    ticker       = Column(String, nullable=False, index=True)
    asset_name   = Column(String, default="")
    trade_type   = Column(String, nullable=False)   # "buy" | "sell"
    units        = Column(Float, nullable=False)
    price        = Column(Float, nullable=False)
    total        = Column(Float, nullable=False)     # units * price
    realized_pl  = Column(Float, default=0.0)        # filled on sell
    date         = Column(String, default="")        # user-supplied date (YYYY-MM-DD)
    created_at   = Column(DateTime, default=datetime.utcnow, index=True)

    portfolio = relationship("Portfolio", back_populates="trades")


# ══════════════════════════════════════════════════════════════════════════════
# Alerts & Notifications
# ══════════════════════════════════════════════════════════════════════════════

class MarketAlert(Base):
    """Alert triggered by a technical signal on a ticker."""
    __tablename__ = "market_alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String, nullable=False)
    asset_name = Column(String, nullable=False)
    alert_type = Column(String, nullable=False)     # golden_cross, death_cross, overbought, etc.
    price = Column(Float)
    detail = Column(Text)
    triggered_at = Column(DateTime, default=datetime.utcnow, index=True)
    notified = Column(Boolean, default=False)


class PortfolioAlert(Base):
    """Alert rule for a portfolio (e.g. drawdown threshold)."""
    __tablename__ = "portfolio_alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), nullable=False)
    alert_type = Column(String, nullable=False, default="drawdown")
    threshold_value = Column(Float, default=-0.10)
    is_active = Column(Boolean, default=True)
    last_triggered = Column(DateTime, nullable=True)

    portfolio = relationship("Portfolio", back_populates="alerts")


class AlertHistory(Base):
    """Log of triggered portfolio alerts."""
    __tablename__ = "alert_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    alert_id = Column(Integer, ForeignKey("portfolio_alerts.id"), nullable=False)
    value_at_trigger = Column(Float)
    message = Column(Text)
    triggered_at = Column(DateTime, default=datetime.utcnow)


class PushSubscription(Base):
    """Web Push subscription endpoint."""
    __tablename__ = "push_subscriptions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    endpoint = Column(String, unique=True, nullable=False)
    p256dh = Column(String, nullable=False)
    auth = Column(String, nullable=False)
    user_agent = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ══════════════════════════════════════════════════════════════════════════════
# User Profile (MiFID Test)
# ══════════════════════════════════════════════════════════════════════════════

class InvestorProfile(Base):
    """Result of the MiFID suitability test."""
    __tablename__ = "investor_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    profile_type = Column(String, nullable=False)  # Conservador, Moderado, Equilibrado, Dinámico, Agresivo
    score_capacity = Column(Integer, default=0)
    score_tolerance = Column(Integer, default=0)
    score_knowledge = Column(Integer, default=0)
    score_objective = Column(Integer, default=0)
    total_score = Column(Integer, default=0)
    percentage = Column(Integer, default=0)
    allocation_cash = Column(Float, default=0)
    allocation_bonds = Column(Float, default=0)
    allocation_stocks = Column(Float, default=0)
    allocation_crypto = Column(Float, default=0)
    allocation_gold = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
