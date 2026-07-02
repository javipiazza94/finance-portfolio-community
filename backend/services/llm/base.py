"""backend/services/llm/base.py — Provider protocol shared by all LLM backends."""
from typing import Protocol


class LLMProvider(Protocol):
    """Every provider implements this single method."""

    async def complete(self, system: str, user: str) -> str:
        """Send a chat completion request and return the raw text content."""
        ...
