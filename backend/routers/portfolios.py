"""
routers/portfolios.py — Personal portfolio management: positions, buy/sell, profile test.

Inspired by: mi-dashboard (kept separate — best ideas adapted)
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database.connection import get_db
from database.models import Portfolio, Position, InvestorProfile, Asset, Trade

router = APIRouter(prefix="/api/portfolios", tags=["portfolios"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class BuyRequest(BaseModel):
    ticker: str
    amount: Optional[float] = None   # money amount (amount OR units required)
    units: Optional[float] = None    # direct units
    price: float                     # price per unit
    date: Optional[str] = None
    asset_name: Optional[str] = None

class SellRequest(BaseModel):
    ticker: str
    amount: Optional[float] = None
    units: Optional[float] = None
    price: float
    date: Optional[str] = None

class ProfileTestRequest(BaseModel):
    answers: list[int]      # 15 answers (0-3 each)


# ── Personal Portfolio CRUD ──────────────────────────────────────────────────

def _get_or_create_personal(db: Session) -> Portfolio:
    """Get or create the user's personal portfolio."""
    personal = db.query(Portfolio).filter_by(is_personal=True).first()
    if not personal:
        personal = Portfolio(
            name="Mi Portfolio",
            description="Portfolio personal",
            category="custom",
            is_personal=True,
        )
        db.add(personal)
        db.commit()
        db.refresh(personal)
    return personal


@router.get("/personal")
def get_personal_portfolio(db: Session = Depends(get_db)):
    """Get the user's personal portfolio with all positions."""
    portfolio = _get_or_create_personal(db)
    positions = db.query(Position).filter_by(portfolio_id=portfolio.id).all()

    total = 0
    invested = 0
    position_list = []

    for pos in positions:
        asset = db.query(Asset).filter_by(id=pos.ticker).first()
        current_price = asset.price if asset and asset.price and asset.price > 0 else 0.0
        if current_price == 0.0:
            from database.models import PriceHistory
            hist = db.query(PriceHistory).filter_by(ticker=pos.ticker).order_by(PriceHistory.date.desc()).first()
            if hist and hist.close:
                current_price = hist.close
            else:
                current_price = pos.avg_price
                
        val = pos.units * current_price
        cost = pos.units * pos.avg_price
        total += val
        invested += cost

        position_list.append({
            "ticker": pos.ticker,
            "asset_name": pos.asset_name or (asset.name if asset else pos.ticker),
            "asset_type": asset.asset_type if asset else "stock",
            "units": pos.units,
            "avg_price": pos.avg_price,
            "current_price": current_price,
            "value": round(val, 2),
            "cost": round(cost, 2),
            "pl": round(val - cost, 2),
            "pl_pct": round(((val - cost) / cost) * 100, 2) if cost > 0 else 0,
            "last_buy_date": pos.last_buy_date,
        })

    pl = total - invested
    pl_pct = (pl / invested) * 100 if invested > 0 else 0

    return {
        "id": portfolio.id,
        "name": portfolio.name,
        "total": round(total, 2),
        "invested": round(invested, 2),
        "pl": round(pl, 2),
        "pl_pct": round(pl_pct, 2),
        "positions": position_list,
    }


@router.post("/personal/buy")
def buy_asset(req: BuyRequest, db: Session = Depends(get_db)):
    """Buy (add) units to the personal portfolio and record the trade."""
    portfolio = _get_or_create_personal(db)

    # Support either amount (money) or direct units
    if req.units is not None:
        units = req.units
    elif req.amount is not None:
        units = req.amount / req.price
    else:
        raise HTTPException(status_code=400, detail="Provide amount or units")

    existing = db.query(Position).filter_by(
        portfolio_id=portfolio.id, ticker=req.ticker.upper()
    ).first()

    if existing:
        new_units = existing.units + units
        new_avg = ((existing.units * existing.avg_price) + (units * req.price)) / new_units
        existing.units = new_units
        existing.avg_price = new_avg
        if req.date:
            existing.last_buy_date = req.date
    else:
        asset = db.query(Asset).filter_by(id=req.ticker.upper()).first()
        db.add(Position(
            portfolio_id=portfolio.id,
            ticker=req.ticker.upper(),
            asset_name=req.asset_name or (asset.name if asset else req.ticker.upper()),
            units=units,
            avg_price=req.price,
            last_buy_date=req.date or "",
        ))

    # Record trade
    asset = db.query(Asset).filter_by(id=req.ticker.upper()).first()
    db.add(Trade(
        portfolio_id=portfolio.id,
        ticker=req.ticker.upper(),
        asset_name=req.asset_name or (asset.name if asset else req.ticker.upper()),
        trade_type="buy",
        units=round(units, 6),
        price=req.price,
        total=round(units * req.price, 2),
        date=req.date or "",
    ))

    db.commit()
    return {"success": True, "ticker": req.ticker.upper(), "units": round(units, 6)}


@router.post("/personal/sell")
def sell_asset(req: SellRequest, db: Session = Depends(get_db)):
    """Sell (remove) units from the personal portfolio and record the trade."""
    portfolio = _get_or_create_personal(db)

    if req.units is not None:
        units = req.units
    elif req.amount is not None:
        units = req.amount / req.price
    else:
        raise HTTPException(status_code=400, detail="Provide amount or units")

    existing = db.query(Position).filter_by(
        portfolio_id=portfolio.id, ticker=req.ticker.upper()
    ).first()

    if not existing:
        raise HTTPException(status_code=404, detail="Position not found")

    # Calculate realized P/L
    realized_pl = round((req.price - existing.avg_price) * units, 2)

    new_units = max(0, existing.units - units)
    if new_units < 0.0001:
        db.delete(existing)
    else:
        existing.units = new_units

    # Record trade
    asset = db.query(Asset).filter_by(id=req.ticker.upper()).first()
    db.add(Trade(
        portfolio_id=portfolio.id,
        ticker=req.ticker.upper(),
        asset_name=asset.name if asset else req.ticker.upper(),
        trade_type="sell",
        units=round(units, 6),
        price=req.price,
        total=round(units * req.price, 2),
        realized_pl=realized_pl,
        date=req.date or "",
    ))

    db.commit()
    return {
        "success": True,
        "ticker": req.ticker.upper(),
        "remaining_units": round(new_units, 6),
        "realized_pl": realized_pl,
    }


@router.delete("/personal/position/{ticker}")
def delete_position(ticker: str, db: Session = Depends(get_db)):
    """Completely remove a position from the personal portfolio."""
    portfolio = _get_or_create_personal(db)
    pos = db.query(Position).filter_by(
        portfolio_id=portfolio.id, ticker=ticker.upper()
    ).first()
    if not pos:
        raise HTTPException(status_code=404, detail="Position not found")
    db.delete(pos)
    db.commit()
    return {"success": True, "ticker": ticker.upper(), "message": "Position deleted"}


class AvgPriceUpdate(BaseModel):
    avg_price: float

class UnitsUpdate(BaseModel):
    units: float

@router.patch("/personal/position/{ticker}/units")
def update_units(ticker: str, req: UnitsUpdate, db: Session = Depends(get_db)):
    """Manually correct the number of units of a position."""
    if req.units <= 0:
        raise HTTPException(status_code=422, detail="units must be > 0")
    portfolio = _get_or_create_personal(db)
    pos = db.query(Position).filter_by(portfolio_id=portfolio.id, ticker=ticker.upper()).first()
    if not pos:
        raise HTTPException(status_code=404, detail="Position not found")
    pos.units = req.units
    db.commit()
    return {"ticker": ticker.upper(), "units": req.units}


@router.patch("/personal/position/{ticker}/avg-price")
def update_avg_price(ticker: str, req: AvgPriceUpdate, db: Session = Depends(get_db)):
    """Manually correct the average buy price of a position."""
    if req.avg_price <= 0:
        raise HTTPException(status_code=422, detail="avg_price must be > 0")
    portfolio = _get_or_create_personal(db)
    pos = db.query(Position).filter_by(portfolio_id=portfolio.id, ticker=ticker.upper()).first()
    if not pos:
        raise HTTPException(status_code=404, detail="Position not found")
    pos.avg_price = req.avg_price
    db.commit()
    return {"ticker": ticker.upper(), "avg_price": req.avg_price}


@router.post("/personal/refresh-prices")
def refresh_portfolio_prices(db: Session = Depends(get_db)):
    """Fetch and update current prices for all positions in the personal portfolio."""
    from services.fetcher import fetch_single_ticker
    portfolio = _get_or_create_personal(db)
    positions = db.query(Position).filter_by(portfolio_id=portfolio.id).all()

    updated = []
    errors = []
    for pos in positions:
        try:
            result = fetch_single_ticker(pos.ticker)
            if result and result.get("price") and result["price"] > 0:
                asset = db.query(Asset).filter_by(id=pos.ticker).first()
                if asset:
                    asset.price = result["price"]
                    asset.change_1d = result.get("change_percent", 0)
                else:
                    asset = Asset(
                        id=pos.ticker,
                        symbol=pos.ticker,
                        name=pos.asset_name or pos.ticker,
                        asset_type="etf",
                        currency=result.get("currency") or "EUR",
                        price=result["price"],
                        change_1d=result.get("change_percent", 0),
                    )
                    db.add(asset)
                updated.append({"ticker": pos.ticker, "price": result["price"]})
            else:
                errors.append({"ticker": pos.ticker, "reason": "No data"})
        except Exception as e:
            errors.append({"ticker": pos.ticker, "reason": str(e)})

    db.commit()
    return {"updated": updated, "errors": errors}


@router.post("/personal/export")
def export_portfolio(db: Session = Depends(get_db)):
    """Export portfolio data as JSON."""
    portfolio = _get_or_create_personal(db)
    positions = db.query(Position).filter_by(portfolio_id=portfolio.id).all()
    profile = db.query(InvestorProfile).order_by(InvestorProfile.created_at.desc()).first()

    return {
        "positions": [
            {
                "ticker": p.ticker,
                "asset_name": p.asset_name,
                "units": p.units,
                "avg_price": p.avg_price,
                "last_buy_date": p.last_buy_date,
            }
            for p in positions
        ],
        "profile": {
            "profile_type": profile.profile_type,
            "scores": {
                "capacity": profile.score_capacity,
                "tolerance": profile.score_tolerance,
                "knowledge": profile.score_knowledge,
                "objective": profile.score_objective,
            },
            "allocation": {
                "cash": profile.allocation_cash,
                "bonds": profile.allocation_bonds,
                "stocks": profile.allocation_stocks,
                "crypto": profile.allocation_crypto,
                "gold": profile.allocation_gold,
            },
        } if profile else None,
    }


@router.get("/personal/trades")
def get_trades(
    db: Session = Depends(get_db),
    limit: int = 50,
    offset: int = 0,
):
    """Return the trade history for the personal portfolio, newest first."""
    portfolio = _get_or_create_personal(db)
    trades = (
        db.query(Trade)
        .filter_by(portfolio_id=portfolio.id)
        .order_by(Trade.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    total_count = db.query(Trade).filter_by(portfolio_id=portfolio.id).count()
    return {
        "total": total_count,
        "trades": [
            {
                "id": t.id,
                "ticker": t.ticker,
                "asset_name": t.asset_name,
                "trade_type": t.trade_type,
                "units": t.units,
                "price": t.price,
                "total": t.total,
                "realized_pl": t.realized_pl,
                "date": t.date,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in trades
        ],
    }


# ── MiFID Profile Test ───────────────────────────────────────────────────────

QUESTIONS = [
    {
        "q": "¿Cuál es tu situación laboral actual?",
        "options": ["Desempleado o estudiante", "Trabajo temporal o freelance irregular", "Trabajo estable con ingresos medios", "Empleo muy sólido con ingresos altos"],
        "w": [0, 1, 3, 2], "cat": "cap"
    },
    {
        "q": "¿Cuáles son tus ingresos netos mensuales?",
        "options": ["Menos de 1.000€", "1.000€ - 2.500€", "2.500€ - 5.000€", "Más de 5.000€"],
        "w": [0, 1, 2, 3], "cat": "cap"
    },
    {
        "q": "¿Cuánto podrías ahorrar al mes para invertir?",
        "options": ["Menos del 5% de mis ingresos", "Entre 5% y 15%", "Entre 15% y 30%", "Más del 30%"],
        "w": [0, 1, 2, 3], "cat": "cap"
    },
    {
        "q": "¿Tienes un fondo de emergencia (3–6 meses de gastos)?",
        "options": ["No, no tengo ahorros", "Tengo para 1-2 meses", "Sí, tengo para 3-6 meses", "Tengo ahorros para más de 6 meses"],
        "w": [0, 1, 2, 3], "cat": "cap"
    },
    {
        "q": "¿Tienes deudas significativas?",
        "options": ["Sí, deudas con alto interés (tarjetas, etc.)", "Préstamo personal o coche", "Solo hipoteca (deuda buena)", "No tengo deudas"],
        "w": [0, 1, 2, 3], "cat": "cap"
    },
    {
        "q": "Si tu inversión baja un 20% en un mes, ¿qué haces?",
        "options": ["Vendería todo inmediatamente por pánico", "Vendería una parte para limitar más pérdidas", "Mantendría y esperaría que se recupere", "Compraría más aprovechando que está barato"],
        "w": [0, 1, 2, 3], "cat": "tol"
    },
    {
        "q": "¿Cómo te sentirías si pierdes 500€ de tu inversión?",
        "options": ["Me quitaría el sueño y me estresaría mucho", "Me molestaría, pero lo toleraría", "Lo vería como parte normal de invertir", "Ni me inmutaría, miro el largo plazo"],
        "w": [0, 1, 2, 3], "cat": "tol"
    },
    {
        "q": "¿Qué volatilidad aceptas?",
        "options": ["Mínima: prefiero no ganar nada antes que perder", "Baja: acepto pequeñas caídas por ganar algo", "Media: acepto subidas y bajadas moderadas", "Alta: acepto fuertes caídas si el potencial es alto"],
        "w": [0, 1, 2, 3], "cat": "tol"
    },
    {
        "q": "¿Cuánto sabes sobre mercados financieros?",
        "options": ["Nada, soy totalmente principiante", "Conceptos básicos (acciones, bonos, inflación)", "Entiendo bien fondos, ETFs y bolsa", "Nivel experto, leo balances y opero activamente"],
        "w": [0, 1, 2, 3], "cat": "con"
    },
    {
        "q": "¿Has invertido antes?",
        "options": ["No, nunca", "Solo depósitos o letras del tesoro", "Fondos de inversión o roboadvisors", "Sí, compro acciones individuales o derivados"],
        "w": [0, 1, 2, 3], "cat": "con"
    },
    {
        "q": "¿Sabes qué es un ETF indexado?",
        "options": ["No tengo ni idea", "Me suena, pero no sabría explicarlo", "Fondo que replica un índice con bajas comisiones", "Sí, es la base de mi filosofía de inversión"],
        "w": [0, 1, 2, 3], "cat": "con"
    },
    {
        "q": "¿Cuál es tu horizonte temporal?",
        "options": ["Menos de 1 año (Corto plazo)", "1 a 3 años (Medio plazo)", "3 a 10 años (Largo plazo)", "Más de 10 años (Muy largo plazo)"],
        "w": [0, 1, 2, 3], "cat": "obj"
    },
    {
        "q": "¿Cuál es tu objetivo principal?",
        "options": ["Proteger el dinero sin riesgo", "Ahorrar para una compra importante (coche, casa)", "Crecer patrimonio poco a poco a lo largo de los años", "Lograr la independencia financiera"],
        "w": [0, 1, 2, 3], "cat": "obj"
    },
    {
        "q": "¿Para qué necesitarás este dinero?",
        "options": ["Para gastos diarios o imprevistos a corto plazo", "Para proyectos personales a unos años vista", "Jubilación o dejar herencia", "No lo voy a necesitar, es 100% dinero que me sobra"],
        "w": [0, 1, 2, 3], "cat": "obj"
    },
    {
        "q": "¿Qué importancia tiene la liquidez inmediata?",
        "options": ["Vital, necesito poder sacarlo mañana sin penalización", "Alta, me gustaría poder disponer de ello en semanas", "Moderada, puedo esperar meses si es necesario", "Muy baja, puede estar bloqueado años sin problema"],
        "w": [0, 1, 2, 3], "cat": "obj"
    },
]


def _compute_profile(answers: list[int]) -> dict | None:
    if len(answers) < 15:
        return None

    cap = tol = con = obj = 0
    for i, q in enumerate(QUESTIONS):
        s = q["w"][answers[i]] if answers[i] < len(q["w"]) else 0
        if q["cat"] == "cap":
            cap += s
        elif q["cat"] == "tol":
            tol += s
        elif q["cat"] == "con":
            con += s
        elif q["cat"] == "obj":
            obj += s

    total = cap + tol + con + obj
    max_total = 15 * 3
    pct = total / max_total

    if pct < 0.3:
        profile = "Conservador"
        alloc = {"cash": 30, "bonds": 40, "stocks": 20, "crypto": 5, "gold": 5}
    elif pct < 0.5:
        profile = "Moderado"
        alloc = {"cash": 15, "bonds": 30, "stocks": 40, "crypto": 8, "gold": 7}
    elif pct < 0.7:
        profile = "Equilibrado"
        alloc = {"cash": 10, "bonds": 15, "stocks": 55, "crypto": 12, "gold": 8}
    elif pct < 0.85:
        profile = "Dinámico"
        alloc = {"cash": 5, "bonds": 10, "stocks": 60, "crypto": 18, "gold": 7}
    else:
        profile = "Agresivo"
        alloc = {"cash": 3, "bonds": 5, "stocks": 55, "crypto": 30, "gold": 7}

    return {
        "profile": profile,
        "alloc": alloc,
        "scores": {"cap": cap, "tol": tol, "con": con, "obj": obj},
        "total": total,
        "pct": round(pct * 100),
    }


@router.get("/test/questions")
def get_test_questions():
    """Get the MiFID test questions."""
    return QUESTIONS


@router.post("/test/submit")
def submit_test(req: ProfileTestRequest, db: Session = Depends(get_db)):
    """Submit test answers and get investor profile."""
    result = _compute_profile(req.answers)
    if not result:
        raise HTTPException(status_code=400, detail="Need 15 answers")

    # Save to DB
    profile = InvestorProfile(
        profile_type=result["profile"],
        score_capacity=result["scores"]["cap"],
        score_tolerance=result["scores"]["tol"],
        score_knowledge=result["scores"]["con"],
        score_objective=result["scores"]["obj"],
        total_score=result["total"],
        percentage=result["pct"],
        allocation_cash=result["alloc"]["cash"],
        allocation_bonds=result["alloc"]["bonds"],
        allocation_stocks=result["alloc"]["stocks"],
        allocation_crypto=result["alloc"]["crypto"],
        allocation_gold=result["alloc"]["gold"],
    )
    db.add(profile)
    db.commit()

    return result


@router.get("/test/profile")
def get_latest_profile(db: Session = Depends(get_db)):
    """Get the latest investor profile."""
    profile = db.query(InvestorProfile).order_by(InvestorProfile.created_at.desc()).first()
    if not profile:
        return None
    return {
        "profile": profile.profile_type,
        "alloc": {
            "cash": profile.allocation_cash,
            "bonds": profile.allocation_bonds,
            "stocks": profile.allocation_stocks,
            "crypto": profile.allocation_crypto,
            "gold": profile.allocation_gold,
        },
        "scores": {
            "cap": profile.score_capacity,
            "tol": profile.score_tolerance,
            "con": profile.score_knowledge,
            "obj": profile.score_objective,
        },
        "total": profile.total_score,
        "pct": profile.percentage,
    }
