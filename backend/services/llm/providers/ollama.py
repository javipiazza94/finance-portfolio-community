"""backend/services/llm/providers/ollama.py — Ollama local provider.

Uses Ollama's OpenAI-compatible endpoint (`/v1/chat/completions`), available
since Ollama 0.1.26+. Pull a model first, e.g. `ollama pull llama3.1`.
"""
import config

from ._openai_chat import call_openai_chat


class OllamaProvider:
    async def complete(self, system: str, user: str) -> str:
        return await call_openai_chat(
            base_url=f"{config.OLLAMA_URL.rstrip('/')}/v1",
            model=config.OLLAMA_MODEL,
            system=system,
            user=user,
        )
