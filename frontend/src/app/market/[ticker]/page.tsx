'use client';

import { use, useEffect, useState } from 'react';
import { fetchAssetHistory, fetchIndicators, addAsset, buyAsset } from '@/lib/api';
import { Activity, TrendingUp, AlertCircle, ShoppingCart, X } from 'lucide-react';
import { clsx } from 'clsx';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import NewsSection from '@/components/dashboard/NewsSection';
import CompanyScorecard from '@/components/market/CompanyScorecard';

// ── Inline quick-buy modal pre-seeded with the current ticker ──────────────
function QuickBuyModal({
  ticker, assetName, currentPrice, onClose, onDone,
}: {
  ticker: string; assetName: string; currentPrice: number;
  onClose: () => void; onDone: () => void;
}) {
  const [units, setUnits] = useState('1');
  const [price, setPrice] = useState(currentPrice > 0 ? currentPrice.toFixed(2) : '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const total = price && units ? (Number(price) * Number(units)).toFixed(2) : '—';

  const handleSubmit = async () => {
    if (!price || isNaN(Number(price)) || Number(price) <= 0) return setError('Precio inválido.');
    if (!units || isNaN(Number(units)) || Number(units) <= 0) return setError('Unidades inválidas.');
    setSubmitting(true); setError('');
    try {
      // Ensure asset exists in DB first
      await addAsset({ ticker, name: assetName || ticker, asset_type: 'stock' });
      await buyAsset({ ticker, units: Number(units), price: Number(price), date });
      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Error al registrar la compra.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="glass-panel p-8 w-full max-w-sm animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">Añadir a Portfolio</h2>
            <p className="text-text-muted text-sm mt-0.5">{ticker} · {assetName}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-text-muted hover:text-white" /></button>
        </div>

        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-text-muted uppercase font-medium mb-1 block">Precio (€/$)</label>
              <input type="number" value={price} onChange={e => setPrice(e.target.value)}
                min="0" step="0.01" className="input w-full" />
            </div>
            <div>
              <label className="text-xs text-text-muted uppercase font-medium mb-1 block">Unidades</label>
              <input type="number" value={units} onChange={e => setUnits(e.target.value)}
                min="0" step="0.0001" className="input w-full" />
            </div>
          </div>
          <div>
            <label className="text-xs text-text-muted uppercase font-medium mb-1 block">Fecha</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input w-full" />
          </div>
        </div>

        <div className="bg-surface-hover rounded-xl p-4 mb-6 flex justify-between items-center">
          <span className="text-text-muted text-sm">Total operación</span>
          <span className="font-mono font-bold text-lg">${total}</span>
        </div>

        {error && <p className="text-danger text-sm mb-4">{error}</p>}

        <button onClick={handleSubmit} disabled={submitting}
          className="w-full py-3 rounded-xl font-bold bg-success hover:bg-success/80 text-background transition-colors disabled:opacity-50">
          {submitting ? 'Registrando...' : `Comprar ${ticker}`}
        </button>
      </div>
    </div>
  );
}

const PERIODS = [
  { key: '1m', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '1y', label: '1A' },
  { key: '3y', label: '3A' },
  { key: '5y', label: '5A' },
  { key: 'max', label: 'Máx' },
] as const;

type Period = typeof PERIODS[number]['key'];

// ── Main Page ──────────────────────────────────────────────────────────────
export default function AssetDetailPage({ params }: { params: Promise<{ ticker: string }> }) {
  const resolvedParams = use(params);
  const ticker = resolvedParams.ticker.toUpperCase();

  const [history, setHistory] = useState<any[]>([]);
  const [indicators, setIndicators] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [period, setPeriod] = useState<Period>('1y');
  const [showBuy, setShowBuy] = useState(false);
  const [bought, setBought] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchAssetHistory(ticker, period),
      fetchIndicators(ticker),
    ])
      .then(([histData, indData]) => {
        if (histData && Array.isArray(histData)) {
          setHistory(histData.map((d: any) => ({ date: d.date.split('T')[0], price: d.close })));
        }
        setIndicators(indData);
        setLoading(false);
      })
      .catch(err => { console.error(err); setLoading(false); });
  }, [ticker]);

  // Refetch only history when period changes
  useEffect(() => {
    if (loading) return;
    setChartLoading(true);
    fetchAssetHistory(ticker, period)
      .then(data => {
        if (data && Array.isArray(data)) {
          setHistory(data.map((d: any) => ({ date: d.date.split('T')[0], price: d.close })));
        }
      })
      .catch(console.error)
      .finally(() => setChartLoading(false));
  }, [period]);

  if (loading) return (
    <div className="p-8 text-text-muted flex items-center gap-2">
      <Activity className="w-5 h-5 animate-spin" /> Cargando análisis técnico...
    </div>
  );

  const currentPrice = history.length > 0 ? history[history.length - 1].price : 0;
  const macdBullish = indicators?.macd_hist != null ? indicators.macd_hist > 0 : null;
  const currencySymbol = indicators?.currency === 'EUR' ? '€' : '$';

  return (
    <div className="space-y-6 animate-fade-in">
      {showBuy && (
        <QuickBuyModal
          ticker={ticker}
          assetName={indicators?.name || ticker}
          currentPrice={currentPrice}
          onClose={() => setShowBuy(false)}
          onDone={() => { setShowBuy(false); setBought(true); }}
        />
      )}

      <header className="flex items-center justify-between">
        <div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">
                {indicators?.name || ticker}
              </h1>
              {indicators?.signal_type && (
                <span className={clsx(
                  'px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wider border',
                  ['golden_cross', 'breakout_up', 'oversold'].includes(indicators.signal_type)
                    ? 'bg-success-bg text-success border-success/30'
                    : 'bg-danger-bg text-danger border-danger/30'
                )}>
                  {indicators.signal_type.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <p className="text-sm text-text-muted font-mono mt-0.5">{ticker}</p>
          </div>
          <p className="text-3xl font-mono mt-2">{currencySymbol}{currentPrice.toFixed(2)}</p>
        </div>

        <div className="flex items-center gap-3">
          {bought && (
            <span className="text-success text-sm font-medium flex items-center gap-1">
              ✓ Añadido al portfolio
            </span>
          )}
          <button
            onClick={() => { setShowBuy(true); setBought(false); }}
            className="bg-primary hover:bg-primary-hover text-background px-6 py-3 rounded-xl font-medium transition-colors flex items-center gap-2 shadow-lg shadow-primary/20"
          >
            <ShoppingCart className="w-5 h-5" />
            Añadir a Mi Portfolio
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <section className="lg:col-span-2 glass-panel p-6 min-h-[450px]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Evolución del Precio
            </h2>
            <div className="flex items-center gap-1">
              {PERIODS.map(p => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={clsx(
                    'px-3 py-1 text-xs font-medium rounded border transition-all',
                    period === p.key
                      ? 'border-secondary text-secondary bg-secondary/10'
                      : 'border-[var(--color-border)] text-text-muted hover:border-secondary/40 hover:text-secondary'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[350px] w-full relative">
            {chartLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-surface/60 z-10 rounded-lg">
                <Activity className="w-5 h-5 animate-spin text-secondary" />
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} minTickGap={40} />
                <YAxis domain={['auto', 'auto']} stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${currencySymbol}${v}`} width={60} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: '8px' }}
                  itemStyle={{ color: 'var(--color-text-main)' }}
                />
                <Area type="monotone" dataKey="price" stroke="var(--color-primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorPrice)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Technical Indicators */}
        <section className="glass-panel p-6 flex flex-col">
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-secondary" />
            Análisis Técnico
          </h2>

          {indicators ? (
            <div className="space-y-6 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-surface-hover rounded-xl border border-[var(--color-border)]">
                  <p className="text-xs text-text-muted uppercase mb-1">RSI (14)</p>
                  <p className={clsx('text-2xl font-mono', indicators.rsi > 70 ? 'text-danger' : indicators.rsi < 30 ? 'text-success' : '')}>
                    {indicators.rsi?.toFixed(1) ?? '—'}
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    {indicators.rsi > 70 ? 'Sobrecompra' : indicators.rsi < 30 ? 'Sobreventa' : 'Neutral'}
                  </p>
                </div>
                <div className="p-4 bg-surface-hover rounded-xl border border-[var(--color-border)]">
                  <p className="text-xs text-text-muted uppercase mb-1">MACD</p>
                  {macdBullish !== null ? (
                    <>
                      <p className={clsx('text-lg font-bold mt-1', macdBullish ? 'text-success' : 'text-danger')}>
                        {macdBullish ? '▲ ALCISTA' : '▼ BAJISTA'}
                      </p>
                      <p className="text-xs font-mono text-text-muted mt-1">
                        hist {indicators.macd_hist > 0 ? '+' : ''}{indicators.macd_hist?.toFixed(3)}
                      </p>
                    </>
                  ) : (
                    <p className="text-text-muted text-sm mt-1">—</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { label: 'Media Móvil 20d', val: indicators.ma20, cls: '' },
                  { label: 'Media Móvil 50d', val: indicators.ma50, cls: '' },
                  { label: 'Soporte Clave', val: indicators.support, cls: 'text-success' },
                  { label: 'Resistencia Clave', val: indicators.resistance, cls: 'text-danger' },
                ].map(({ label, val, cls }) => (
                  <div key={label} className="flex justify-between items-center text-sm p-3 bg-surface border border-[var(--color-border)] rounded-lg">
                    <span className="text-text-muted">{label}</span>
                    <span className={clsx('font-mono', cls)}>{val != null ? `${currencySymbol}${val.toFixed(2)}` : '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-text-muted">
              <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">Indicadores no disponibles.</p>
            </div>
          )}
        </section>

        <div className="lg:col-span-3">
          <CompanyScorecard ticker={ticker} />
        </div>

        <NewsSection ticker={ticker} />
      </div>
    </div>
  );
}
