"""backend/services/llm/providers/__init__.py — Provider factory/registry."""
from typing import Dict, Type

from ..base import LLMProvider
from .lmstudio import LMStudioProvider
from .ollama import OllamaProvider
from .openai_compatible import OpenAICompatibleProvider

_REGISTRY: Dict[str, Type[LLMProvider]] = {
    "lmstudio": LMStudioProvider,
    "ollama": OllamaProvider,
    "openai_compatible": OpenAICompatibleProvider,
}


def get_provider(name: str) -> LLMProvider:
    """Instantiate the LLM provider registered under `name`.

    Raises ValueError for anything not in the registry — `core.py` catches
    this (and any other provider error) and falls back to the mock payload.
    """
    key = (name or "ollama").strip().lower()
    provider_cls = _REGISTRY.get(key)
    if provider_cls is None:
        raise ValueError(
            f"Unknown LLM_PROVIDER '{name}'. Valid options: {', '.join(_REGISTRY)}"
        )
    return provider_cls()
