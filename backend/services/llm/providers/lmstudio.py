"""backend/services/llm/providers/lmstudio.py — LM Studio local provider."""
import config

from ._openai_chat import call_openai_chat


class LMStudioProvider:
    async def complete(self, system: str, user: str) -> str:
        return await call_openai_chat(
            base_url=f"{config.LM_STUDIO_URL.rstrip('/')}/v1",
            model=config.LM_STUDIO_MODEL,
            system=system,
            user=user,
        )
