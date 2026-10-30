# Finance Portfolio (community)

Versión abierta de Finance Portfolio: seguimiento de mercados, gestión de carteras personales, perfil de inversor MiFID, alertas técnicas y análisis de empresas con IA que puede ejecutarse 100 % en local. Repo público: nada personal ni privado entra aquí.

## Stack
- **Backend**: Python 3.11, FastAPI, SQLAlchemy + SQLite (`finance_portfolio.db`, se crea y siembra al arrancar), yfinance, APScheduler, Web Push (VAPID).
- **Frontend**: Next.js 16 (App Router), React 19, TailwindCSS 4, Framer Motion, Recharts, Axios. Gestor: **pnpm**.
- **IA**: proveedor seleccionable con `LLM_PROVIDER` (`ollama` por defecto, `lmstudio`, `openai_compatible`, `anthropic`); modelo y URL por variable de entorno.
- API en `:8000` (`/docs`) y web en `:3000`.

## Comandos
```bash
docker compose up --build                    # todo el stack (requiere Ollama en el host)

# Backend (desde backend/)
pip install -r requirements.txt              # instalar
uvicorn main:app --reload --port 8000        # dev
python -m pytest                             # tests

# Frontend (desde frontend/)
pnpm install --frozen-lockfile               # instalar (igual que el CI)
pnpm run dev                                 # dev (:3000)
pnpm exec tsc --noEmit                       # typecheck (bloqueante en CI)
pnpm run lint                                # eslint (no bloqueante en CI: ~90 errores previos)
pnpm run build                               # build de producción
```

## Estructura
- `backend/routers/` — endpoints por dominio; `backend/services/` — lógica y proveedores LLM; `backend/database/` — modelos, conexión y seed.
- `backend/config.py` — **única** fuente de configuración (todo viene del entorno).
- `backend/tests/` — pytest (LLM core/providers, resumen con IA, seed).
- `frontend/src/` — app, componentes y lib del cliente.
- `.github/workflows/ci.yml` — build del frontend + instalación y compilación del backend.
- `docs/design/` — notas de diseño; `img/` — capturas del README.

## Convenciones
- Clean Code (reglas globales en `~/.claude/rules/clean-code.md`): código e identificadores en inglés; README en español (hay `README.en.md` para búsqueda), commits en español.
- Commits Conventional Commits; ramas por feature; PR pequeñas (ver `CONTRIBUTING.md`).
- Un proveedor LLM nuevo = una clase en `backend/services` registrada en el enrutado; no hardcodear modelos ni URLs: variable en `config.py` y en `.env.example`.
- Todo bug corregido añade un test que lo reproduce.

## Límites
- **Repo público**: nunca commitear `.env`, `*.db`, `*.pem`, `backend/vapid_private.pem` ni datos reales (cifras, nóminas, Excel). Plantilla en `.env.example`.
- Este repo no recibe código del repo privado `Finance-Portfolio` sin revisar antes que no arrastra datos o rutas personales.
- Next.js 16 no es el que conoces: lee `frontend/node_modules/next/dist/docs/` antes de escribir frontend.
- Moneda base EUR; no añadir librerías de gráficos o estado sin justificación.

## Definición de «hecho»
`python -m pytest`, `pnpm exec tsc --noEmit` y `pnpm run build` en verde, `pnpm run lint` sin errores nuevos en lo tocado, y AGENTS.md actualizado si cambian comandos o estructura.
