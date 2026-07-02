"""
config.py — Application settings loaded from environment / .env file.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# Database
DB_PATH = os.environ.get(
    "DB_PATH",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "finance_portfolio.db"),
)

# News
NEWSAPI_KEY = os.environ.get("NEWSAPI_KEY", "")

# VAPID (Web Push)
VAPID_EMAIL = os.environ.get("VAPID_EMAIL", "mailto:admin@finance-portfolio.local")

# Scheduler
SCHEDULER_ENABLED = os.environ.get("SCHEDULER_ENABLED", "true").lower() == "true"

# API
API_HOST = os.environ.get("API_HOST", "0.0.0.0")
API_PORT = int(os.environ.get("API_PORT", "8000"))
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://localhost:3005,http://localhost:3001").split(",")

# AI provider routing (company analysis)
# One of: lmstudio | ollama | openai_compatible | anthropic
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "ollama")

# LM Studio (local LLM, OpenAI-compatible API)
LM_STUDIO_URL = os.environ.get("LM_STUDIO_URL", "http://localhost:1234")
LM_STUDIO_MODEL = os.environ.get("LM_STUDIO_MODEL", "local-model")

# Ollama (local, OpenAI-compatible endpoint) — recommended default
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.1")
