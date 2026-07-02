import httpx
import json
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Default LM Studio local API URL
LM_STUDIO_API_URL = "http://localhost:1234/v1/chat/completions"

# You can adapt the model name to whichever is currently loaded in LM Studio
# But most local setups ignore it and just use the loaded model.
DEFAULT_MODEL = "local-model"

async def generate_company_analysis(ticker: str, company_name: str, financial_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Generates a company analysis scorecard using a local LLM via LM Studio.
    """
    
    # We can pass some basic financial context if available
    context_str = ""
    if financial_data:
        context_str = f"""
Financial Context:
- Current Price: {financial_data.get('current_price', 'N/A')}
- Market Cap: {financial_data.get('market_cap', 'N/A')}
- PE Ratio: {financial_data.get('pe_ratio', 'N/A')}
- Revenue Growth: {financial_data.get('revenue_growth', 'N/A')}
"""

    prompt = f"""You are a rigorous sell-side equity analyst. Analyze {company_name} ({ticker}) and produce a differentiated scorecard.
{context_str}

## SCORING RULES — read carefully before assigning any number

### Overall score (0-100) — USE THE FULL RANGE. Do NOT cluster around 65-75.
| Score range | What it means | gauge_color | recommendation example |
|-------------|---------------|-------------|------------------------|
| 85-100 | Exceptional: dominant moat, strong growth, cheap valuation | green | STRONG BUY - Aggressive Accumulate |
| 70-84  | Above-average: solid fundamentals, minor concerns | green | BUY - Accumulate on Weakness |
| 55-69  | Mixed: some positives offset by real risks | yellow | HOLD - Monitor Closely |
| 40-54  | Below-average: meaningful headwinds outweigh strengths | orange | REDUCE - Trim on Rallies |
| 0-39   | Poor: structural decline, overvalued, or serious risk | red | AVOID - Exit Position |

**Calibration examples:**
- NVDA at peak AI cycle: ~90
- MSFT cloud era (stable compounder): ~78
- Meta post-2022 turnaround: ~72
- legacy auto (Ford/GM): ~45
- Bed Bath & Beyond pre-bankruptcy: ~18

### Pillar scores — each pillar is independent, scale 0-10
| Pillar | 0-3 | 4-6 | 7-10 |
|--------|-----|-----|------|
| quality | weak margins, high debt | adequate, industry-average | strong FCF, clean balance sheet |
| growth | declining revenues | low single-digit growth | double-digit revenue/EPS growth |
| dividend | no dividend or cut | modest, stable payout | high yield, growing, well-covered |
| valuation | severely overvalued vs peers | fairly valued | meaningfully undervalued |
| momentum | strong downtrend, negative catalysts | neutral/sideways | positive catalysts, upward revision cycle |

The overall score is NOT a simple average of pillars — weight based on company type (growth companies: weight quality+growth; income companies: weight dividend+quality).

Respond STRICTLY with a valid JSON object — no markdown, no extra text:

{{
  "score": <float 0-100, use full range based on calibration above>,
  "recommendation": "<text matching the table above>",
  "gauge_color": "<red | orange | yellow | green>",
  "pillars": {{
    "quality": <int 0-10>,
    "growth": <int 0-10>,
    "dividend": <int 0-10>,
    "valuation": <int 0-10>,
    "momentum": <int 0-10>
  }},
  "key_stats": [
    {{ "label": "<period + metric, e.g. 'Q3 FY25 Revenue'>", "value": "<value, e.g. '$82.9B'>", "note": "<YoY change or context>" }},
    {{ "label": "<metric>", "value": "<value>", "note": "<context>" }},
    {{ "label": "<metric>", "value": "<value>", "note": "<context>" }},
    {{ "label": "<metric>", "value": "<value>", "note": "<context>" }},
    {{ "label": "<TTM P/E or EV/EBITDA>", "value": "<value>", "note": "<vs sector avg>" }},
    {{ "label": "Analyst Target", "value": "<price range>", "note": "<buy/hold/sell consensus>" }}
  ],
  "bull_case": ["<specific catalyst 1>","<specific catalyst 2>","<specific catalyst 3>","<specific catalyst 4>","<specific catalyst 5>"],
  "bear_case": ["<specific risk 1>","<specific risk 2>","<specific risk 3>","<specific risk 4>","<specific risk 5>"],
  "thesis": "<one sentence: core reason to own or avoid, with a specific number or fact>"
}}
"""

    payload = {
        "model": DEFAULT_MODEL,
        "messages": [
            {"role": "system", "content": "You are a helpful financial assistant that outputs only valid JSON."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2,
        "max_tokens": 2000,
        "stream": False
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(LM_STUDIO_API_URL, json=payload)
            response.raise_for_status()

            data = response.json()
            message = data["choices"][0]["message"]
            # DeepSeek R1 and similar reasoning models put the actual output in
            # `content`; when content is empty they use `reasoning_content` only.
            content = message.get("content") or message.get("reasoning_content") or ""

            # Clean up the response in case the LLM wrapped it in markdown code blocks
            content = content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
                
            parsed_json = json.loads(content)
            return parsed_json
            
    except Exception as e:
        logger.error(f"Error generating LLM analysis for {ticker}: {e}")
        # Return a fallback/mock payload in case LM Studio is not running or errors out
        return get_mock_analysis(ticker, company_name)

def get_mock_analysis(ticker: str, company_name: str) -> Dict[str, Any]:
    """Fallback mock analysis if the LLM is unavailable, with pseudo-random but deterministic values."""
    import hashlib
    # Simple deterministic pseudo-random number based on ticker
    h = int(hashlib.md5(ticker.encode()).hexdigest(), 16)
    
    score = 40 + (h % 55) + ((h % 100) / 100.0) # Score between 40 and 95
    
    if score >= 80:
        recommendation = "ATTRACTIVE - Buy"
        color = "green"
    elif score >= 60:
        recommendation = "NEUTRAL - Hold Position"
        color = "yellow"
    elif score >= 45:
        recommendation = "CAUTION - Reduce Exposure"
        color = "orange"
    else:
        recommendation = "AVOID - Sell"
        color = "red"

    return {
        "score": round(score, 1),
        "recommendation": recommendation,
        "gauge_color": color,
        "pillars": {
            "quality": 3 + (h % 7),
            "growth": 2 + ((h >> 4) % 8),
            "dividend": (h >> 8) % 10,
            "valuation": 3 + ((h >> 12) % 7),
            "momentum": 2 + ((h >> 16) % 8),
        },
        "key_stats": [
            {"label": "Revenue (TTM)", "value": "N/A", "note": "LLM offline"},
            {"label": "Net Income", "value": "N/A", "note": "LLM offline"},
            {"label": "Revenue Growth", "value": "N/A", "note": "YoY"},
            {"label": "Free Cash Flow", "value": "N/A", "note": "TTM"},
            {"label": "TTM P/E", "value": "N/A", "note": "vs sector avg"},
            {"label": "Analyst Target", "value": "N/A", "note": "consensus"},
        ],
        "bull_case": [
            f"{company_name} shows strong fundamentals in key segments.",
            "Consistent revenue growth outperforming sector averages.",
            "Healthy balance sheet with low debt and high cash reserves.",
            "Expanding margins driven by operational efficiency.",
            "Strong brand and competitive moat in core markets.",
        ],
        "bear_case": [
            "Current valuation appears slightly stretched.",
            "Potential macroeconomic headwinds could impact margins.",
            "Increasing competition in the primary market.",
            "Execution risk in new growth initiatives.",
            "Currency exposure may weigh on reported earnings.",
        ],
        "thesis": f"While {company_name} faces some macro challenges, its core business remains robust."
    }
