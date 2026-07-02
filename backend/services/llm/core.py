"""backend/services/llm/core.py — Provider-agnostic orchestration for company analysis."""
import json
import logging
from typing import Any, Dict, Optional

from config import LLM_PROVIDER

from .prompts import SYSTEM_PROMPT, build_analysis_prompt, get_mock_analysis
from .providers import get_provider

logger = logging.getLogger(__name__)


def _strip_markdown_fences(content: str) -> str:
    content = content.strip()
    if content.startswith("```json"):
        content = content[7:]
    if content.startswith("```"):
        content = content[3:]
    if content.endswith("```"):
        content = content[:-3]
    return content.strip()


async def generate_company_analysis(
    ticker: str,
    company_name: str,
    financial_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Generate a company analysis scorecard using the configured LLM provider.

    Falls back to a deterministic mock payload if the provider is
    unreachable, misconfigured, or returns something that isn't valid JSON.
    """
    prompt = build_analysis_prompt(ticker, company_name, financial_data)

    try:
        provider = get_provider(LLM_PROVIDER)
        content = await provider.complete(SYSTEM_PROMPT, prompt)
        return json.loads(_strip_markdown_fences(content))
    except Exception as e:
        logger.error(f"Error generating LLM analysis for {ticker} via '{LLM_PROVIDER}': {e}")
        return get_mock_analysis(ticker, company_name)
