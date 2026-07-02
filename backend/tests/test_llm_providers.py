"""backend/tests/test_llm_providers.py — LLM provider factory tests."""
import pytest

from services.llm.providers import get_provider
from services.llm.providers.lmstudio import LMStudioProvider


def test_get_provider_returns_lmstudio_by_name():
    provider = get_provider("lmstudio")
    assert isinstance(provider, LMStudioProvider)


def test_get_provider_is_case_insensitive():
    provider = get_provider("LMStudio")
    assert isinstance(provider, LMStudioProvider)


def test_get_provider_rejects_unknown_name():
    with pytest.raises(ValueError, match="Unknown LLM_PROVIDER"):
        get_provider("does-not-exist")
