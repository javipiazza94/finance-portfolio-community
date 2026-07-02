# UI-SPEC — Rediseño "Terminal Financiero" · Finance Portfolio

> **Contrato de diseño.** Define QUÉ debe verse, con valores exactos. El CÓMO ejecutarlo está en `REDESIGN-PLAN.md` (mismo directorio). Referencias visuales: `img/modelo de analisis por empresa.png` y `img/modelo de respuesta de llm.png` (raíz del proyecto).

## 0. Restricciones absolutas

- **Cero cambios funcionales**: prohibido tocar lógica, props, estado, hooks, llamadas API (`src/lib/api.ts`), handlers o backend. Solo clases CSS, tokens, metadata, assets y el nuevo componente `Logo.tsx` (presentacional puro).
- La estructura JSX solo puede cambiar donde sea imprescindible para el estilo (envolver un número en un `<span>`, etc.), nunca la jerarquía de datos ni los eventos.
- Stack: Next.js 16 (App Router) + React 19 + **Tailwind v4** (tokens en `@theme` dentro de `globals.css`; NO existe `tailwind.config`). Leer `frontend/AGENTS.md` antes de escribir código.

## 1. Dirección estética

Terminal financiero profesional (Bloomberg / "Rated Markets Scorecard"): fondo navy casi negro, **oro como color de marca**, verde/rojo intensos para señal alcista/bajista, tarjetas con borde fino de color semántico, cifras en monospace, labels en uppercase con tracking. Se abandona el azul grisáceo desaturado actual.

## 2. Design tokens (`frontend/src/app/globals.css`, bloque `@theme`)

### 2.1 Fondos y superficies

| Token | Valor nuevo | Actual |
|---|---|---|
| `--color-background` | `#0a0e14` | `#0f1214` |
| `--color-surface` | `#10151d` | `#1a1d21` |
| `--color-surface-hover` | `#18202b` | `#22262b` |
| `--color-surface-glass` | `rgba(16, 21, 29, 0.65)` | `rgba(26,29,33,0.6)` |
| `--color-border` | `rgba(230, 179, 69, 0.10)` (oro sutil) | `rgba(255,255,255,0.08)` |
| `--color-border-focus` | `rgba(230, 179, 69, 0.5)` | azul |

### 2.2 Marca (oro) y semánticos

| Token | Valor | Uso |
|---|---|---|
| `--color-primary` | `#e6b345` | Acento de marca: nav activo, focus, CTAs primarios, scores |
| `--color-primary-hover` | `#f2c55c` | Hover del oro |
| `--color-primary-glow` | `rgba(230, 179, 69, 0.35)` | Glows/rings |
| `--color-secondary` | `#3b82f6` | Info/azul (barra "Quality" del ejemplo) |
| `--color-success` | `#22c55e` | Ganancias, bull, conectado |
| `--color-success-bg` | `rgba(34, 197, 94, 0.10)` | Fondos de badge/tarjeta verde |
| `--color-danger` | `#ef4444` | Pérdidas, bear, alertas |
| `--color-danger-bg` | `rgba(239, 68, 68, 0.10)` | Fondos rojos |
| `--color-warning` | `#f59e0b` | **Nuevo** — estados neutros/caution |
| `--color-warning-bg` | `rgba(245, 158, 11, 0.10)` | **Nuevo** |

### 2.3 Texto

| Token | Valor |
|---|---|
| `--color-text-main` | `#f2f4f8` |
| `--color-text-muted` | `#98a2b3` |
| `--color-text-gold` | `#f5c542` — **nuevo**, cifras destacadas (score grande, KPIs clave) |

### 2.4 Categóricos para charts y clasificaciones (**nuevos**)

| Token | Valor | Sustituye a |
|---|---|---|
| `--color-chart-1` | `#3b82f6` (azul) | `bg-blue-500`, `#3b82f6` stocks |
| `--color-chart-2` | `#22c55e` (verde) | `bg-emerald-500`, `#10b981` cash |
| `--color-chart-3` | `#a855f7` (púrpura) | `bg-purple-500`, `#a855f7` bonds |
| `--color-chart-4` | `#f97316` (naranja) | `bg-orange-500`, `#ca8a04` gold-asset |
| `--color-chart-5` | `#06b6d4` (cian) | `bg-cyan-500` |
| `--color-chart-6` | `#e6b345` (oro) | `#facc15` crypto, `text-yellow-500` |

Mapeos obligatorios:
- **Tipos de activo** (`portfolio/page.tsx` `typeColors`): stocks→chart-1, bonds→chart-3, crypto→chart-6, cash→chart-2, gold→chart-4, other→`--color-text-muted`.
- **Pilares** (`PillarScores.tsx`): Quality→chart-1, Growth→chart-2, Dividend→chart-3, Valuation→chart-4, Momentum→chart-5.
- **Perfiles de riesgo** (`profile/page.tsx`): conservador→chart-1, moderado→chart-2, equilibrado→chart-6, dinámico→chart-4, agresivo→`--color-danger` (mantener el mismo orden semántico que los 5 colores actuales blue/emerald/yellow/orange/red).

### 2.5 Tipografía

| Token | Valor |
|---|---|
| `--font-sans` | Inter (sin cambio) — UI, textos, navegación |
| `--font-mono` | **Nuevo**: `'JetBrains Mono', ui-monospace, 'SF Mono', monospace` — cargar con `next/font/google` en `layout.tsx`, variable `--font-mono` |

Reglas de uso del mono: precios, variaciones %, KPIs, scores, celdas numéricas de tablas y ejes de charts. Añadir `font-variant-numeric: tabular-nums` al body (o utilidad `.tabular`) para que las cifras alineen. Los ~10 usos existentes de `font-mono` heredan la fuente automáticamente al definir el token.

## 3. Utilidades nuevas (`@layer utilities` en globals.css)

```css
/* Barra de score estilo ejemplo: rojo→naranja→oro→verde */
.score-bar-gradient {
  background: linear-gradient(90deg, #ef4444 0%, #f97316 33%, #e6b345 60%, #22c55e 100%);
}

/* Tarjetas con borde de color semántico (Bull/Bear/callout del ejemplo) */
.card-accent-success { border: 1px solid rgba(34,197,94,.4); background: rgba(34,197,94,.05); border-radius: .75rem; }
.card-accent-danger  { border: 1px solid rgba(239,68,68,.4);  background: rgba(239,68,68,.05);  border-radius: .75rem; }
.card-accent-gold    { border: 1px solid rgba(230,179,69,.45); background: rgba(230,179,69,.05); border-radius: .75rem; }

/* Label estilo terminal */
.label-terminal { text-transform: uppercase; letter-spacing: .08em; font-size: .6875rem; color: var(--color-text-muted); }
```

Actualizar utilidades existentes:
- `.text-gradient` → `from-[var(--color-primary)] to-[var(--color-text-gold)]` (oro, elimina el `#8bacbc`).
- `.glass-panel` / `.glass-button` / `.input` / scrollbar: sin cambios estructurales; heredan tokens nuevos.

## 4. Branding

### 4.1 Título de pestaña y metadata (`frontend/src/app/layout.tsx`)

```ts
export const metadata: Metadata = {
  title: {
    default: "Finance Portfolio · Terminal de Inversión",
    template: "%s · Finance Portfolio",
  },
  description: "Terminal de inversión personal: mercados internacionales en tiempo real y gestión de portfolio.",
};
```

Opcional (no bloqueante): títulos por sección añadiendo un `layout.tsx` mínimo por ruta que exporte `metadata` (las páginas son client components y no pueden exportarla). Títulos: `Market Explorer`, `Mi Portfolio`, `Carteras Modelo`, `Test MiFID`, `Alertas`.

### 4.2 Logo (`frontend/src/components/layout/Logo.tsx`, nuevo)

Componente presentacional puro (sin props de lógica, solo `size`/`withWordmark` opcionales):

- **Marca (icono)**: SVG `viewBox="0 0 32 32"`. Cuadrado redondeado (`rx≈7`) con fondo `#10151d` y borde `#e6b345` de 1.5px; dentro, una línea de tendencia alcista con vela (candlestick) trazada en oro `#e6b345`, con el último punto en verde `#22c55e`. Estilo minimalista, trazo 2px, sin degradados.
- **Wordmark**: `Finance` en `--color-text-main` + `Portfolio` en oro (`--color-primary`), font-semibold, tracking-wide.
- Uso en `Sidebar.tsx`: sustituye al icono `Briefcase` + `h1.text-gradient` actuales (líneas 30-33), icono 28px + wordmark.

### 4.3 Favicon e iconos

- Crear `frontend/src/app/icon.svg` con la misma marca (Next.js lo sirve como favicon automáticamente; eliminar `src/app/favicon.ico`).
- Crear `frontend/public/logo.svg` (misma marca, 192px-friendly) y actualizar `public/sw.js` para usar `/logo.svg` como `icon`/`badge` de notificaciones (hoy usa `/window.svg`).
- Crear `frontend/public/manifest.json` básico: name "Finance Portfolio", short_name "FinPortfolio", `theme_color: "#0a0e14"`, `background_color: "#0a0e14"`, icono `logo.svg`. Enlazarlo en metadata (`manifest: "/manifest.json"`).

## 5. Spec por pantalla

Con los tokens nuevos, el ~80% se re-tematiza solo. Cambios específicos por pantalla:

| Pantalla | Cambios visuales |
|---|---|
| **Sidebar** (`layout/Sidebar.tsx`) | Logo nuevo (§4.2). Item activo: `bg-primary/10 text-primary border-primary/20` ya usa tokens → pasará a oro solo. Badge "Conectado (SSE)" se mantiene verde. |
| **Topbar** (`layout/Topbar.tsx`) | Focus del buscador pasa a oro vía tokens. Sin más cambios. |
| **Dashboard** (`app/page.tsx`) | Badge "en vivo" verde intenso; cifras de índices y Top Movers en `font-mono`; labels de sección con `.label-terminal`. |
| **Market Explorer** (`app/market/page.tsx`) | Precios de la lista en mono; badges con tokens. |
| **Detalle activo** (`app/market/[ticker]/page.tsx`) | AreaChart ya usa `var(--color-primary)` → línea/gradiente pasan a oro solos. Precio grande en `font-mono text-text-gold`. `hover:bg-green-400` (L78) → `hover:bg-success/80`. |
| **CompanyScorecard** (`market/CompanyScorecard.tsx`) | Score grande estilo ejemplo: `font-mono`, color oro (`text-text-gold`), `/100` en muted. Gradiente L99 `from-white to-gray-400` → `from-text-main to-text-muted` o directamente oro. Key stats en tarjetas con `.label-terminal`. |
| **PillarScores** (`market/PillarScores.tsx`) | Barras con los tokens chart-1..5 (§2.4). Valores numéricos a la derecha en mono. |
| **RecommendationGauge** (`market/RecommendationGauge.tsx`) | Barra con `.score-bar-gradient` (rojo→naranja→oro→verde, como el ejemplo). Indicador `bg-white border-gray-300` → `bg-text-main border-border`. Labels AVOID/NEUTRAL/ATTRACTIVE con `.label-terminal`. |
| **BullBearCase** (`market/BullBearCase.tsx`) | Bull: `.card-accent-success` con título verde; Bear: `.card-accent-danger` con título rojo (bordes 1px como el ejemplo). Callout de tesis/quote: `.card-accent-gold`. |
| **Portfolio** (`app/portfolio/page.tsx`) | `typeColors` → tokens chart (§2.4). Tooltip `#facc15` → `var(--color-chart-6)`. KPIs en `font-mono`, rentabilidad +/− en verde/rojo intensos. Badge emerald L278 → tokens success. `text-yellow-500` L412 → `text-[var(--color-chart-6)]`. |
| **Carteras Modelo** (`app/models/page.tsx`, `[id]/page.tsx`) | NAV chart hereda tokens. Cifras en mono. |
| **Test MiFID** (`app/profile/page.tsx`) | Chips de categoría y colores de perfil → tokens (§2.4). Resto hereda. |
| **Alertas** (`app/alerts/page.tsx`) | Precios objetivo en mono; estados con success/danger/warning tokens. |
| **Modales** (`TradeModal`, `LiquidityModal`, `AssetQuickModal`) | CTA compra: `bg-success` (no emerald-500); venta: `bg-danger`; hovers `hover:bg-green-400/red-400` → `hover:bg-success/80` / `hover:bg-danger/80`. `text-[#0f1214]` → `text-background`. Backdrops `bg-black/70` se mantienen. |

## 6. Accesibilidad

- Oro `#e6b345` sobre `#0a0e14`: ratio ≈ 9:1 (AA/AAA) ✓. **Nunca** oro sobre superficies claras ni texto oscuro sobre oro salvo `#0a0e14`.
- Texto muted `#98a2b3` sobre surface: mantener ≥ 4.5:1.
- Verde/rojo siempre acompañados de signo (+/−) o icono — no comunicar solo por color.
- Estados de focus visibles con `--color-border-focus` (oro) en inputs y botones.
