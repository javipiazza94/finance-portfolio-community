"""backend/services/llm/providers/_openai_chat.py — Shared OpenAI-style chat completion caller.

Used by any provider that speaks the OpenAI `/v1/chat/completions` wire
format: LM Studio, Ollama (native OpenAI-compat endpoint), and the generic
openai_compatible provider (OpenAI itself, OpenRouter, Groq, Together,
vLLM, LocalAI, ...).
"""
import httpx


async def call_openai_chat(
    base_url: str,
    model: str,
    system: str,
    user: str,
    api_key: str = "",
    timeout: float = 120.0,
) -> str:
    url = f"{base_url.rstrip('/')}/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.2,
        "max_tokens": 2000,
        "stream": False,
    }

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()
        message = data["choices"][0]["message"]
        # Reasoning models (DeepSeek R1 etc.) sometimes leave `content` empty
        # and put the answer in `reasoning_content` instead.
        return message.get("content") or message.get("reasoning_content") or ""
