*[English version](./README.en.md)*

# Finance Portfolio

Plataforma FullStack para el seguimiento de mercados internacionales en tiempo
real y la gestión de carteras de inversión personales — con análisis de
empresas generado por IA que puede ejecutarse íntegramente en tu propio
hardware.

- **Backend**: Python · FastAPI · SQLAlchemy (SQLite) · yfinance · APScheduler · Web Push (VAPID)
- **Frontend**: Next.js 16 (App Router) · React 19 · TailwindCSS 4 · Framer Motion · Recharts · Axios
- **Análisis con IA**: enrutado a distintos proveedores — ejecútalo 100% en local (Ollama, LM Studio) o apunta a una API en la nube

---

## Funcionalidades

- Dashboard de mercado en vivo (SSE) con los principales índices y los activos que más se mueven
- Buscador global de activos (acciones, ETFs, cripto, materias primas, fondos de inversión) vía Yahoo Finance
- Seguimiento de cartera en EUR con conversión automática de divisa, operaciones de compra/venta y P&L
- Test de perfil de inversor estilo MIFID que define la asignación de activos objetivo
- Alertas técnicas (Golden Cross, RSI, MACD, ...) con notificaciones Web Push
- Scorecards de empresas con IA (score 0-100, tesis alcista/bajista, métricas clave) generadas por el LLM local o en la nube que elijas

## Puesta en marcha (Docker)

```bash
docker compose up --build
```

Backend: http://localhost:8000/docs · Frontend: http://localhost:3000

Por defecto el backend espera una instancia de [Ollama](https://ollama.com)
accesible en `http://localhost:11434` en el host (`OLLAMA_URL` en
`docker-compose.yml`). Instala Ollama, ejecuta `ollama pull llama3.1`, y el
análisis con IA funciona sin ninguna API key y sin que salgan datos de tu
máquina.

## Puesta en marcha (manual)

### Requisitos

| Herramienta | Versión mínima |
|-------------|-----------------|
| Python | 3.11+ |
| Node.js | 20+ |

### Backend

```bash
cd backend
python3 -m venv ../.venv
source ../.venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # edita si lo necesitas
uvicorn main:app --reload --port 8000
```

Comprueba que responde: http://localhost:8000/health → `{"status":"ok",...}`

### Frontend

```bash
cd frontend
pnpm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api" > .env.local
pnpm dev
```

Abre http://localhost:3000

## Configuración del proveedor de IA

Define `LLM_PROVIDER` en `backend/.env` con cualquiera de estos valores:

| Proveedor | `LLM_PROVIDER` | Dónde se ejecuta | ¿Requiere API key? |
|---|---|---|---|
| **Ollama** (por defecto) | `ollama` | 100% local | No |
| LM Studio | `lmstudio` | 100% local | No |
| OpenAI-compatible genérico | `openai_compatible` | Local (vLLM, LocalAI) o nube (OpenAI, OpenRouter, Groq, Together) | Depende del endpoint |
| Anthropic Claude | `anthropic` | Nube | Sí |

Cada proveedor lee su propia configuración desde `.env` (URL, nombre del
modelo, API key cuando aplique) — consulta `backend/.env.example` para ver el
listado completo. Si el proveedor configurado no está disponible o está mal
configurado, el endpoint de análisis cae automáticamente a un scorecard
determinista sin conexión en vez de fallar.

Añadir un proveedor nuevo es un único archivo — consulta `CONTRIBUTING.md`.

## Estructura del proyecto

```
.
├── backend/               # API FastAPI
│   ├── main.py             # app factory + arranque
│   ├── config.py           # configuración / entorno
│   ├── database/           # modelos, conexión, seed
│   ├── routers/             # market, portfolios, models, analysis, alerts, news, stream
│   ├── services/
│   │   ├── llm/              # enrutado de proveedores de IA (ver arriba)
│   │   └── ...                # fetcher, analytics, alerts, news, scheduler
│   └── tests/
└── frontend/              # App Next.js 16
    └── src/
        ├── app/             # rutas: market, portfolio, models, alerts, profile
        ├── components/
        └── lib/api.ts       # cliente axios + hook SSE
```

## Notas

- La base de datos SQLite se crea y se siembra automáticamente en el primer
  arranque (~660 activos + 8 carteras modelo). No está versionada; borra
  `backend/finance_portfolio.db` para empezar de cero.
- Nunca subas `.env`, `.env.local` ni `vapid_private.pem` — ya están cubiertos
  por `.gitignore`. Usa `.env.example` como plantilla.

## Contribuir

Consulta [CONTRIBUTING.md](./CONTRIBUTING.md).

## Licencia

[MIT](./LICENSE)
