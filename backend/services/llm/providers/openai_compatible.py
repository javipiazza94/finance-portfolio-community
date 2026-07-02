"""backend/services/llm/providers/openai_compatible.py — Generic OpenAI-compatible provider.

Points at any endpoint that speaks the OpenAI chat-completions wire format:
OpenAI itself, OpenRouter, Groq, Together, vLLM, LocalAI, etc. Configure
`OPENAI_COMPATIBLE_BASE_URL`, `OPENAI_COMPATIBLE_API_KEY` and
`OPENAI_COMPATIBLE_MODEL` in `.env`.
"""
import config

from ._openai_chat import call_openai_chat


class OpenAICompatibleProvider:
    async def complete(self, system: str, user: str) -> str:
        return await call_openai_chat(
            base_url=config.OPENAI_COMPATIBLE_BASE_URL,
            model=config.OPENAI_COMPATIBLE_MODEL,
            system=system,
            user=user,
            api_key=config.OPENAI_COMPATIBLE_API_KEY,
        )
