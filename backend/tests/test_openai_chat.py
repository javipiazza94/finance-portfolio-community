"""backend/tests/test_openai_chat.py — shared OpenAI-style chat helper tests."""
import asyncio
import json

import httpx

from services.llm.providers._openai_chat import call_openai_chat


def test_call_openai_chat_sends_expected_payload_and_parses_content(monkeypatch):
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["auth"] = request.headers.get("authorization")
        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json={"choices": [{"message": {"content": "hello"}}]})

    transport = httpx.MockTransport(handler)
    real_async_client = httpx.AsyncClient

    def fake_async_client(*args, **kwargs):
        kwargs["transport"] = transport
        return real_async_client(*args, **kwargs)

    monkeypatch.setattr(
        "services.llm.providers._openai_chat.httpx.AsyncClient", fake_async_client
    )

    result = asyncio.run(
        call_openai_chat(
            base_url="http://localhost:1234/v1",
            model="local-model",
            system="sys",
            user="usr",
            api_key="secret",
        )
    )

    assert result == "hello"
    assert captured["url"] == "http://localhost:1234/v1/chat/completions"
    assert captured["auth"] == "Bearer secret"
    assert captured["body"]["model"] == "local-model"
    assert captured["body"]["messages"][0] == {"role": "system", "content": "sys"}


def test_call_openai_chat_falls_back_to_reasoning_content(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": "", "reasoning_content": "reasoned answer"}}]},
        )

    transport = httpx.MockTransport(handler)
    real_async_client = httpx.AsyncClient

    def fake_async_client(*args, **kwargs):
        kwargs["transport"] = transport
        return real_async_client(*args, **kwargs)

    monkeypatch.setattr(
        "services.llm.providers._openai_chat.httpx.AsyncClient", fake_async_client
    )

    result = asyncio.run(
        call_openai_chat(base_url="http://localhost:1234/v1", model="local-model", system="sys", user="usr")
    )

    assert result == "reasoned answer"
