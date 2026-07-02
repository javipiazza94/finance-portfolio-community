# Finance-Portfolio

Plataforma FullStack unificada para el seguimiento de mercados internacionales en tiempo real y la gestión de carteras de inversión personales.

- **Backend**: Python · FastAPI · SQLAlchemy (SQLite) · yfinance · APScheduler · Web Push (VAPID)
- **Frontend**: Next.js 16 (App Router) · React 19 · TailwindCSS 4 · Framer Motion · Recharts · Axios

> Detalle completo de la arquitectura y funcionalidades en [`CONTEXT.md`](./CONTEXT.md).

---

## 📋 Requisitos

| Herramienta | Versión mínima |
|-------------|----------------|
| Python      | 3.11+          |
| Node.js     | 20+            |
| npm / pnpm / bun | cualquiera |

---

## 🚀 Puesta en marcha

El proyecto son **dos servicios** que corren a la vez:

| Servicio | Puerto | URL |
|----------|--------|-----|
| Backend (FastAPI) | `8000` | http://localhost:8000 — docs en `/docs` |
| Frontend (Next.js) | `3000` | http://localhost:3000 |

### 1. Backend

```bash
cd backend

# Crear entorno virtual e instalar dependencias
python3 -m venv ../.venv
source ../.venv/bin/activate          # Windows: ..\.venv\Scripts\activate
pip install -r requirements.txt

# (Opcional) Variables de entorno — hay valores por defecto sensatos
cp .env.example .env                  # edita si lo necesitas

# (Opcional) Generar claves VAPID para las notificaciones Web Push
python -c "from services.alerts import generate_vapid_keys; generate_vapid_keys()"

# Arrancar la API (la BD SQLite se crea y se siembra sola al iniciar)
uvicorn main:app --reload --port 8000
```

Comprueba que responde: http://localhost:8000/health → `{"status":"ok",...}`

### 2. Frontend

En **otra terminal**:

```bash
cd frontend

# Instalar dependencias (elige tu gestor)
npm install        # o: pnpm install   /   bun install

# (Opcional) Apuntar a otro backend — por defecto usa http://localhost:8000/api
echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api" > .env.local

# Arrancar en modo desarrollo
npm run dev        # o: pnpm dev   /   bun run dev
```

Abre **http://localhost:3000** 🎉

> ⚠️ Arranca **primero el backend**. Si el frontend hace peticiones con la API caída, axios devuelve `Network Error`; basta con recargar la página una vez el backend esté arriba.

---

## 🏭 Build de producción (frontend)

```bash
cd frontend
npm run build
npm run start      # sirve la build en el puerto 3000
```

---

## 🔧 Notas

- **Base de datos**: `backend/finance_portfolio.db` se genera y siembra automáticamente (≈211 activos + 8 carteras modelo). No está versionada; bórrala para empezar de cero.
- **Secretos**: nunca subas `.env`, `.env.local` ni `vapid_private.pem` (ya están en `.gitignore`). Usa `.env.example` como plantilla.
- **Puerto 3001 ocupado**: en algunos entornos lo usa Open WebUI; por eso el frontend va al `3000`.

---

## 📂 Estructura

```
Finance-Portfolio/
├── backend/              # API FastAPI
│   ├── main.py           # app factory + arranque
│   ├── config.py         # configuración / entorno
│   ├── database/         # modelos, conexión, seed
│   ├── routers/          # market, portfolios, models, analysis, alerts, news, stream
│   ├── services/         # lógica: fetcher, analytics, alerts, news, scheduler...
│   └── requirements.txt
└── frontend/             # App Next.js 16
    └── src/
        ├── app/          # rutas: market, portfolio, models, alerts, profile
        ├── components/
        └── lib/api.ts    # cliente axios + hook SSE
```
