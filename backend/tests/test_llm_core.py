"""backend/tests/test_llm_core.py — generate_company_analysis orchestration tests."""
import asyncio
import json

import services.llm.core as core


class _StubProvider:
    def __init__(self, content: str):
        self._content = content

    async def complete(self, system: str, user: str) -> str:
        return self._content


class _FailingProvider:
    async def complete(self, system: str, user: str) -> str:
        raise RuntimeError("provider unreachable")


def test_generate_company_analysis_parses_json_response(monkeypatch):
    payload = {"score": 77.5, "recommendation": "BUY"}
    monkeypatch.setattr(core, "get_provider", lambda name: _StubProvider(json.dumps(payload)))

    result = asyncio.run(core.generate_company_analysis("AAPL", "Apple Inc."))

    assert result == payload


def test_generate_company_analysis_strips_markdown_fences(monkeypatch):
    payload = {"score": 42}
    fenced = "```json\n" + json.dumps(payload) + "\n```"
    monkeypatch.setattr(core, "get_provider", lambda name: _StubProvider(fenced))

    result = asyncio.run(core.generate_company_analysis("AAPL", "Apple Inc."))

    assert result == payload


def test_generate_company_analysis_falls_back_to_mock_on_provider_error(monkeypatch):
    monkeypatch.setattr(core, "get_provider", lambda name: _FailingProvider())

    result = asyncio.run(core.generate_company_analysis("AAPL", "Apple Inc."))

    assert "score" in result
    assert "recommendation" in result


def test_generate_company_analysis_falls_back_to_mock_on_invalid_json(monkeypatch):
    monkeypatch.setattr(core, "get_provider", lambda name: _StubProvider("not json"))

    result = asyncio.run(core.generate_company_analysis("AAPL", "Apple Inc."))

    assert "score" in result
