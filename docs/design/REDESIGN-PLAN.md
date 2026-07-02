# REDESIGN-PLAN — Rediseño visual "Terminal Financiero"

> **Plan de ejecución para el agente implementador (Sonnet).** El contrato de diseño con todos los valores exactos está en `UI-SPEC.md` (mismo directorio) — léelo entero antes de empezar. Referencias visuales en `img/` (raíz del proyecto).

## Regla de oro

**CERO cambios funcionales.** Solo se tocan: clases CSS/Tailwind, tokens de `globals.css`, metadata, assets SVG/manifest y un componente presentacional nuevo (`Logo.tsx`). Prohibido modificar `src/lib/api.ts`, hooks, estado, props de datos, handlers o cualquier archivo del backend.

## Avisos previos obligatorios

1. **Leer `frontend/AGENTS.md`**: este proyecto usa Next.js 16 con breaking changes respecto a tu training data. Consulta `frontend/node_modules/next/dist/docs/` ante cualquier duda de API (metadata, `next/font`, convención `icon.svg`).
2. **Tailwind v4**: los tokens viven en el bloque `@theme` de `frontend/src/app/globals.css`. NO existe `tailwind.config.*` y no hay que crearlo. Un token `--color-primary` genera automáticamente las clases `bg-primary`, `text-primary`, etc.
3. Trabaja fase a fase, con un commit por fase (mensajes en español, formato `feat:`/`refactor:`). Verifica `npm run build` antes de cada commit.

---

## Fase 1 — Design tokens (re-tematiza ~80% de la app)

**Archivo:** `frontend/src/app/globals.css`

1. Sustituir los valores del bloque `@theme` por la paleta de UI-SPEC §2.1–2.3 (fondo navy `#0a0e14`, primary oro `#e6b345`, success/danger intensos, warning nuevo, text-gold nuevo).
2. Añadir los 6 tokens categóricos `--color-chart-1..6` (UI-SPEC §2.4).
3. Añadir `--font-mono` (UI-SPEC §2.5).
4. Añadir las utilidades nuevas `.score-bar-gradient`, `.card-accent-*`, `.label-terminal` y re-mapear `.text-gradient` a oro (UI-SPEC §3).

**Verificación:** `npm run dev` → toda la app cambia a navy+oro sin tocar ningún componente. Nada roto en consola.

## Fase 2 — Branding (título, logo, favicon, manifest)

**Archivos:** `frontend/src/app/layout.tsx`, `frontend/src/components/layout/Logo.tsx` (nuevo), `frontend/src/app/icon.svg` (nuevo), `frontend/public/logo.svg` (nuevo), `frontend/public/manifest.json` (nuevo), `frontend/public/sw.js`, `frontend/src/components/layout/Sidebar.tsx`

1. `layout.tsx`: metadata con `title.default = "Finance Portfolio · Terminal de Inversión"` y `title.template = "%s · Finance Portfolio"` + nueva description + `manifest: "/manifest.json"` (UI-SPEC §4.1).
2. Crear `Logo.tsx` según UI-SPEC §4.2 (SVG monograma candlestick oro, wordmark bicolor). Componente presentacional puro.
3. `Sidebar.tsx:29-34`: sustituir `<Briefcase>` + `<h1 class="text-gradient">Finance-Portfolio</h1>` por `<Logo withWordmark />`.
4. Crear `src/app/icon.svg` (favicon por convención Next) y **eliminar** `src/app/favicon.ico`.
5. Crear `public/logo.svg` y en `public/sw.js` cambiar `icon`/`badge` de `/window.svg` a `/logo.svg`.
6. Crear `public/manifest.json` (UI-SPEC §4.3).
7. Opcional no bloqueante: `layout.tsx` mínimo por ruta con `metadata.title` por sección (las páginas son client components).

**Verificación:** pestaña muestra `Finance Portfolio · Terminal de Inversión` con favicon nuevo; logo nuevo en sidebar.

## Fase 3 — Tipografía mono

**Archivo:** `frontend/src/app/layout.tsx` (+ `globals.css` si hace falta)

1. Cargar JetBrains Mono con `next/font/google`, `variable: '--font-mono'`, y añadir la variable al `<body>` junto a `inter.variable`.
2. Añadir `font-variant-numeric: tabular-nums` a las cifras (utilidad o en body).

Los ~10 usos existentes de `font-mono` (CategoryBrowse, AssetQuickModal, alerts, market/[ticker], models) heredan la fuente automáticamente.

**Verificación:** precios y KPIs se renderizan en JetBrains Mono con dígitos tabulares.

## Fase 4 — Tokenizar colores hardcodeados

Sustituciones puntuales (diffs mínimos, sin refactor). Mapeos exactos en UI-SPEC §2.4 y §5:

| Archivo:línea | Cambio |
|---|---|
| `src/app/portfolio/page.tsx:14-19` | Mapa `typeColors` → `var(--color-chart-*)` según mapeo de tipos de activo |
| `src/app/portfolio/page.tsx:345` | Tooltip `#facc15` → `var(--color-chart-6)` |
| `src/app/portfolio/page.tsx:278` | Clases emerald → tokens success |
| `src/app/portfolio/page.tsx:412` | `text-yellow-500` → oro (chart-6) |
| `src/components/market/PillarScores.tsx:19-23` | Barras → chart-1..5 |
| `src/components/market/RecommendationGauge.tsx:15-16,30,34,37` | Barra → `.score-bar-gradient`; indicador `bg-white border-gray-300` → `bg-text-main border-border` |
| `src/components/market/CompanyScorecard.tsx:99` | `from-white to-gray-400` → tokens (ver UI-SPEC §5) |
| `src/components/LiquidityModal.tsx:135` | `bg-emerald-500 hover:bg-emerald-600` → `bg-success hover:bg-success/80` |
| `src/app/profile/page.tsx:19-23,68-72` | Chips y perfiles de riesgo → tokens chart/danger |
| `src/components/TradeModal.tsx:273` | `hover:bg-green-400/red-400` → `hover:bg-success/80` / `hover:bg-danger/80` |
| `src/app/market/[ticker]/page.tsx:78` | `hover:bg-green-400` → `hover:bg-success/80` |
| `src/components/dashboard/AssetQuickModal.tsx:212` | `text-[#0f1214]` → `text-background` |

(Los números de línea son orientativos — verifica con grep antes de editar.)

**Verificación:** `grep -rnE '#[0-9a-fA-F]{6}|emerald-|yellow-5|green-400|red-400|blue-500|purple-500|orange-500|cyan-500|gray-300|gray-400' frontend/src --include='*.tsx'` no devuelve colores de diseño fuera de tokens (los `bg-black/70` de backdrops y `bg-white/5` de overlays pueden quedarse).

## Fase 5 — Componentes estrella (look del ejemplo)

Restyle fino para clavar las capturas de `img/`:

1. **`CompanyScorecard.tsx`**: score gigante en `font-mono text-text-gold`, `/100` en muted pequeño; labels de stats con `.label-terminal`.
2. **`PillarScores.tsx`**: valores a la derecha en mono; barras finas con fondo `surface-hover`.
3. **`RecommendationGauge.tsx`**: barra `.score-bar-gradient` con labels AVOID / NEUTRAL / ATTRACTIVE en `.label-terminal` (rojo/muted/verde).
4. **`BullBearCase.tsx`**: contenedor Bull con `.card-accent-success` y título verde con icono; Bear con `.card-accent-danger` y título rojo; bullets con punto de color. Callout/quote de tesis con `.card-accent-gold`.
5. Dashboard y portfolio: cifras clave en mono, labels de sección `.label-terminal`, badge "en vivo" verde intenso.

**Verificación:** comparación lado a lado con `img/modelo de respuesta de llm.png` (scorecard) y `img/modelo de analisis por empresa.png`.

## Fase 6 (OPCIONAL — no ejecutar salvo petición explícita del usuario)

Extraer primitivas `Card` / `Badge` / `Button` / `Modal` (el patrón card se repite ~67×). No es necesaria para el rediseño; queda documentada como deuda de diseño.

---

## Verificación final (obligatoria antes de dar por terminado)

1. `cd frontend && npm run build` sin errores ni warnings nuevos.
2. `npm run dev` y revisión visual de las 8 páginas: `/`, `/market`, `/market/[ticker]` (ej. AAPL), `/portfolio`, `/models`, `/models/[id]`, `/profile`, `/alerts`. Se puede usar `/preview` o `/ui-review` para auditoría.
3. `git diff --stat` no toca `src/lib/`, backend ni lógica — solo CSS, clases, metadata, assets y `Logo.tsx`.
4. Pestaña: `Finance Portfolio · Terminal de Inversión` + favicon nuevo.
5. Contraste: verificar oro sobre navy en nav activo y score (UI-SPEC §6).
