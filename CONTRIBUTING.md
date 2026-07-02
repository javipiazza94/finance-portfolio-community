# Contributing

Thanks for considering a contribution.

## Local setup

```bash
# Backend
cd backend
python3 -m venv ../.venv
source ../.venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
pnpm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api" > .env.local
pnpm dev
```

Or with Docker: `docker compose up --build`.

## Running tests

```bash
cd backend
python -m pytest tests/ -v
```

## Adding a new AI provider

1. Add `backend/services/llm/providers/<name>.py` implementing
   `async def complete(self, system: str, user: str) -> str`.
2. Register it in `_REGISTRY` in `backend/services/llm/providers/__init__.py`.
3. Add its config vars to `backend/config.py` and `backend/.env.example`.
4. Add tests in `backend/tests/test_llm_providers.py` following the pattern
   used by the existing providers.

## Pull requests

- Keep PRs focused on one change.
- Include or update tests for behavior changes.
- Run `python -m pytest tests/ -v` before opening the PR.
