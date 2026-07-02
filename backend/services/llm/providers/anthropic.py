"""backend/services/llm/providers/anthropic.py — Anthropic Claude cloud provider (optional).

Requires ANTHROPIC_API_KEY in .env. Uses the Messages API, which has a
different request/response shape than the OpenAI-style providers.
"""
import httpx

import config

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"


class AnthropicProvider:
    async def complete(self, system: str, user: str) -> str:
        if not config.ANTHROPIC_API_KEY:
            raise RuntimeError("ANTHROPIC_API_KEY is not set")

        headers = {
            "x-api-key": config.ANTHROPIC_API_KEY,
            "anthropic-version": ANTHROPIC_VERSION,
            "content-type": "application/json",
        }
        payload = {
            "model": config.ANTHROPIC_MODEL,
            "max_tokens": 2000,
            "system": system,
            "messages": [{"role": "user", "content": user}],
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(ANTHROPIC_API_URL, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data["content"][0]["text"]
