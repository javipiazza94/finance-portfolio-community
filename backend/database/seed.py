"""
database/seed.py — Seed the database with initial data.

Seeds:
  1. Assets from all index registries (S&P 500, DAX, IBEX 35, Crypto, Commodities, ETFs)
  2. Market indices
  3. Model portfolios (UCITS/ETF based)
"""
import logging
from database.connection import get_db_session
from database.models import Asset, MarketIndex, Portfolio, PortfolioHolding, index_assets

logger = logging.getLogger(__name__)


def seed_assets():
    """Seed assets from all index registries."""
    from services.companies import get_all_index_companies, INDEX_REGISTRY

    with get_db_session() as db:
        # Seed indices
        for idx_id, info in INDEX_REGISTRY.items():
            existing = db.query(MarketIndex).filter_by(id=idx_id).first()
            if not existing:
                db.add(MarketIndex(
                    id=idx_id,
                    name=info["name"],
                    symbol=info["symbol"],
                ))

        # Seed assets
        all_companies = get_all_index_companies()
        added = 0
        for c in all_companies:
            ticker = c["ticker"]
            existing = db.query(Asset).filter_by(id=ticker).first()
            if not existing:
                asset = Asset(
                    id=ticker,
                    symbol=ticker,
                    name=c["name"],
                    asset_type=c.get("asset_type", "stock"),
                    isin=c.get("isin", ""),
                )
                db.add(asset)
                added += 1

                # Link to index
                index = db.query(MarketIndex).filter_by(id=c.get("index_id", "")).first()
                if index:
                    db.execute(index_assets.insert().values(
                        index_id=index.id, asset_id=ticker
                    ))

        logger.info(f"[seed] assets: {added} new, {len(all_companies) - added} existing")


def seed_model_portfolios():
    """Seed model portfolios (UCITS/ETF based)."""
    PORTFOLIOS = [
        {
            "name": "Bogleheads 3-Fund",
            "description": "Cartera clásica Bogleheads: mercado total, internacional y bonos.",
            "category": "classic",
            "source": "Bogleheads",
            "holdings": [
                {"ticker": "VTI", "asset_name": "Vanguard Total Market", "weight": 0.40},
                {"ticker": "URTH", "asset_name": "iShares MSCI World", "weight": 0.30},
                {"ticker": "EEM", "asset_name": "iShares MSCI Emerging", "weight": 0.15},
                {"ticker": "GLD", "asset_name": "SPDR Gold Shares", "weight": 0.15},
            ],
        },
        {
            "name": "All Weather",
            "description": "Inspirada en Ray Dalio: diseñada para cualquier entorno de mercado.",
            "category": "classic",
            "source": "Ray Dalio",
            "holdings": [
                {"ticker": "SPY", "asset_name": "SPDR S&P 500", "weight": 0.30},
                {"ticker": "GLD", "asset_name": "SPDR Gold Shares", "weight": 0.15},
                {"ticker": "VNQ", "asset_name": "Vanguard Real Estate", "weight": 0.15},
                {"ticker": "URTH", "asset_name": "iShares MSCI World", "weight": 0.25},
                {"ticker": "EEM", "asset_name": "iShares MSCI Emerging", "weight": 0.15},
            ],
        },
        {
            "name": "Tech Growth",
            "description": "Concentrada en tecnología y semiconductores para máximo crecimiento.",
            "category": "model",
            "source": "Finance-Portfolio",
            "holdings": [
                {"ticker": "QQQ", "asset_name": "Invesco QQQ (Nasdaq 100)", "weight": 0.40},
                {"ticker": "SMH", "asset_name": "VanEck Semiconductor", "weight": 0.25},
                {"ticker": "ARKK", "asset_name": "ARK Innovation ETF", "weight": 0.15},
                {"ticker": "IBIT", "asset_name": "iShares Bitcoin Trust", "weight": 0.10},
                {"ticker": "SPY", "asset_name": "SPDR S&P 500", "weight": 0.10},
            ],
        },
        {
            "name": "UCITS Europa",
            "description": "Cartera 100% UCITS accesible desde cualquier broker europeo.",
            "category": "model",
            "source": "Finance-Portfolio",
            "holdings": [
                {"ticker": "VWCE.DE", "asset_name": "Vanguard FTSE All-World (EUR)", "weight": 0.35},
                {"ticker": "IWDA.AS", "asset_name": "iShares Core MSCI World (EUR)", "weight": 0.25},
                {"ticker": "SXR8.DE", "asset_name": "iShares Core S&P 500 (EUR)", "weight": 0.20},
                {"ticker": "EIMI.L", "asset_name": "iShares Core MSCI EM (GBP)", "weight": 0.10},
                {"ticker": "VUAA.DE", "asset_name": "Vanguard S&P 500 (EUR)", "weight": 0.10},
            ],
        },
        {
            "name": "Dividendos España",
            "description": "Cartera de dividendos centrada en el IBEX 35 y empresas españolas.",
            "category": "model",
            "source": "Finance-Portfolio",
            "holdings": [
                {"ticker": "SAN.MC", "asset_name": "Banco Santander", "weight": 0.20},
                {"ticker": "IBE.MC", "asset_name": "Iberdrola", "weight": 0.20},
                {"ticker": "TEF.MC", "asset_name": "Telefónica", "weight": 0.15},
                {"ticker": "REP.MC", "asset_name": "Repsol", "weight": 0.15},
                {"ticker": "CABK.MC", "asset_name": "CaixaBank", "weight": 0.15},
                {"ticker": "ENG.MC", "asset_name": "Enagás", "weight": 0.15},
            ],
        },
        {
            "name": "Crypto + DeFi",
            "description": "Exposición diversificada al ecosistema cripto.",
            "category": "model",
            "source": "Finance-Portfolio",
            "holdings": [
                {"ticker": "BTC-USD", "asset_name": "Bitcoin", "weight": 0.40},
                {"ticker": "ETH-USD", "asset_name": "Ethereum", "weight": 0.25},
                {"ticker": "SOL-USD", "asset_name": "Solana", "weight": 0.15},
                {"ticker": "LINK-USD", "asset_name": "Chainlink", "weight": 0.10},
                {"ticker": "AVAX-USD", "asset_name": "Avalanche", "weight": 0.10},
            ],
        },
        {
            "name": "DAX Industrials",
            "description": "Lo mejor de la industria alemana: auto, defensa, tech y seguros.",
            "category": "model",
            "source": "Finance-Portfolio",
            "holdings": [
                {"ticker": "SAP.DE", "asset_name": "SAP", "weight": 0.20},
                {"ticker": "SIE.DE", "asset_name": "Siemens", "weight": 0.15},
                {"ticker": "ALV.DE", "asset_name": "Allianz", "weight": 0.15},
                {"ticker": "RHM.DE", "asset_name": "Rheinmetall", "weight": 0.15},
                {"ticker": "BMW.DE", "asset_name": "BMW", "weight": 0.10},
                {"ticker": "ADS.DE", "asset_name": "Adidas", "weight": 0.10},
                {"ticker": "IFX.DE", "asset_name": "Infineon Technologies", "weight": 0.15},
            ],
        },
        {
            "name": "Commodities Shield",
            "description": "Protección contra inflación con materias primas.",
            "category": "model",
            "source": "Finance-Portfolio",
            "holdings": [
                {"ticker": "GC=F", "asset_name": "Oro", "weight": 0.30},
                {"ticker": "SI=F", "asset_name": "Plata", "weight": 0.15},
                {"ticker": "CL=F", "asset_name": "Petróleo WTI", "weight": 0.20},
                {"ticker": "HG=F", "asset_name": "Cobre", "weight": 0.15},
                {"ticker": "URA", "asset_name": "Uranio (ETF URA)", "weight": 0.20},
            ],
        },
    ]

    with get_db_session() as db:
        existing_count = db.query(Portfolio).filter_by(is_personal=False).count()
        if existing_count > 0:
            logger.info(f"[seed] model portfolios already present ({existing_count}), skipping")
            return

        for p_data in PORTFOLIOS:
            portfolio = Portfolio(
                name=p_data["name"],
                description=p_data["description"],
                category=p_data["category"],
                source=p_data["source"],
                is_personal=False,
            )
            db.add(portfolio)
            db.flush()  # Get ID

            for h in p_data["holdings"]:
                db.add(PortfolioHolding(
                    portfolio_id=portfolio.id,
                    ticker=h["ticker"],
                    asset_name=h["asset_name"],
                    weight=h["weight"],
                ))

        logger.info(f"[seed] inserted {len(PORTFOLIOS)} model portfolios")


def run_seed():
    """Run all seed operations."""
    seed_assets()
    seed_model_portfolios()
    logger.info("[seed] complete")
