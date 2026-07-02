"""backend/tests/test_llm_providers.py — LLM provider factory tests."""
import asyncio
import pytest

from services.llm.providers import get_provider
from services.llm.providers.lmstudio import LMStudioProvider
from services.llm.providers.ollama import OllamaProvider
import services.llm.providers.ollama as ollama_mod


def test_get_provider_returns_lmstudio_by_name():
    provider = get_provider("lmstudio")
    assert isinstance(provider, LMStudioProvider)


def test_get_provider_is_case_insensitive():
    provider = get_provider("LMStudio")
    assert isinstance(provider, LMStudioProvider)


def test_get_provider_rejects_unknown_name():
    with pytest.raises(ValueError, match="Unknown LLM_PROVIDER"):
        get_provider("does-not-exist")


def test_get_provider_returns_ollama_by_name():
    provider = get_provider("ollama")
    assert isinstance(provider, OllamaProvider)


def test_ollama_provider_uses_configured_url_and_model(monkeypatch):
    monkeypatch.setattr(ollama_mod.config, "OLLAMA_URL", "http://localhost:11434")
    monkeypatch.setattr(ollama_mod.config, "OLLAMA_MODEL", "llama3.1")

    captured = {}

    async def fake_call_openai_chat(**kwargs):
        captured.update(kwargs)
        return "ok"

    monkeypatch.setattr(ollama_mod, "call_openai_chat", fake_call_openai_chat)

    result = asyncio.run(OllamaProvider().complete("sys", "usr"))

    assert result == "ok"
    assert captured["base_url"] == "http://localhost:11434/v1"
    assert captured["model"] == "llama3.1"
