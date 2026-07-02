'use client';

import { use, useEffect, useState } from 'react';
import { fetchModelDetails, fetchModelNav, replicateModel } from '@/lib/api';
import { PieChart, Activity, ShieldCheck, ChevronLeft, TrendingUp, X, CheckCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

const PERIODS = ['1y', '3y', '5y', '10y'] as const;

function ReplicateModal({ model, onClose }: { model: any; onClose: () => void }) {
  const [amount, setAmount] = useState('10000');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleReplicate = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return setError('Introduce un importe válido.');
    setLoading(true); setError('');
    try {
      const res = await replicateModel(model.id, amt);
      setResult(res);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Error al replicar cartera.');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="glass-panel p-8 w-full max-w-lg animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Replicar · {model.name}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-text-muted hover:text-white" /></button>
        </div>

        {!result ? (
          <>
            <p className="text-text-muted text-sm mb-6">
              Distribuiremos tu inversión entre los {model.holdings?.length || 0} activos según los pesos de la cartera modelo, al precio actual de cada uno.
            </p>
            <div className="mb-6">
              <label className="text-xs text-text-muted uppercase font-medium mb-2 block">Importe total a invertir (€/$)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min="1" step="100"
                className="input w-full text-2xl py-4 font-bold" placeholder="10000" />
            </div>
            {/* Preview allocation */}
            <div className="space-y-2 mb-6 max-h-48 overflow-y-auto">
              {model.holdings?.map((h: any) => (
                <div key={h.ticker} className="flex justify-between items-center text-sm bg-surface-hover rounded-lg px-3 py-2">
                  <span className="font-mono font-bold text-primary">{h.ticker}</span>
                  <span className="text-text-muted">{(h.weight * 100).toFixed(0)}%</span>
                  <span className="font-mono">${(Number(amount) * h.weight).toFixed(2)}</span>
                </div>
              ))}
            </div>
            {error && <p className="text-danger text-sm mb-4">{error}</p>}
            <button onClick={handleReplicate} disabled={loading}
              className="w-full py-3 bg-primary hover:bg-primary-hover text-background rounded-xl font-bold transition-colors disabled:opacity-50">
              {loading ? <Activity className="w-5 h-5 animate-spin mx-auto" /> : `Invertir $${Number(amount).toLocaleString()}`}
            </button>
          </>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle className="w-8 h-8 text-success" />
              <div>
                <p className="font-bold text-success">¡Cartera replicada!</p>
                <p className="text-text-muted text-sm">{result.executed?.length} posiciones abiertas · {result.skipped?.length} omitidas</p>
              </div>
            </div>
            <div className="space-y-2 max-h-52 overflow-y-auto mb-6">
              {result.executed?.map((e: any) => (
                <div key={e.ticker} className="flex justify-between text-sm bg-surface-hover rounded-lg px-3 py-2">
                  <span className="font-mono font-bold text-primary">{e.ticker}</span>
                  <span className="text-text-muted">{e.units.toFixed(4)} u.</span>
                  <span className="text-success font-mono">+${e.amount_invested.toFixed(2)}</span>
                </div>
              ))}
              {result.skipped?.map((s: any) => (
                <div key={s.ticker} className="flex justify-between text-sm bg-danger/10 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 text-danger" />
                  <span className="font-mono font-bold">{s.ticker}</span>
                  <span className="text-danger text-xs">{s.reason}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <Link href="/portfolio" className="flex-1 py-2.5 bg-primary hover:bg-primary-hover text-background rounded-xl font-bold text-center transition-colors">
                Ver Mi Portfolio
              </Link>
              <button onClick={onClose} className="flex-1 py-2.5 glass-button rounded-xl font-bold text-center">Cerrar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ModelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = parseInt(resolvedParams.id, 10);

  const [model, setModel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>('5y');
  const [navData, setNavData] = useState<any[]>([]);
  const [navLoading, setNavLoading] = useState(false);
  const [showReplicate, setShowReplicate] = useState(false);

  useEffect(() => {
    fetchModelDetails(id)
      .then(data => { setModel(data); setLoading(false); })
      .catch(console.error);
  }, [id]);

  useEffect(() => {
    setNavLoading(true);
    fetchModelNav(id, period)
      .then(data => { setNavData(data); setNavLoading(false); })
      .catch(() => setNavLoading(false));
  }, [id, period]);

  if (loading) return <div className="p-8 text-text-muted flex items-center gap-2"><Activity className="w-5 h-5 animate-spin" /> Cargando cartera modelo...</div>;
  if (!model) return <div className="p-8 text-danger">Modelo no encontrado</div>;

  const isSimulated = navData.length > 0 && navData[0]?.simulated;
  const navChange = navData.length >= 2 ? navData[navData.length - 1].nav - navData[0].nav : 0;
  const navChangePct = navData.length >= 2 ? navChange : 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {showReplicate && <ReplicateModal model={model} onClose={() => setShowReplicate(false)} />}

      <header className="space-y-4">
        <Link href="/models" className="inline-flex items-center text-sm text-text-muted hover:text-primary transition-colors">
          <ChevronLeft className="w-4 h-4 mr-1" /> Volver a Carteras
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex gap-4 items-center">
            <div className="p-3 rounded-2xl bg-surface-hover" style={{ boxShadow: `0 0 40px ${model.color || 'var(--color-primary)'}30` }}>
              {model.category === 'classic' ? <ShieldCheck className="w-8 h-8 text-secondary" /> : <PieChart className="w-8 h-8 text-primary" />}
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{model.name}</h1>
              <p className="text-text-muted mt-1 max-w-2xl">{model.description}</p>
            </div>
          </div>
          <button onClick={() => setShowReplicate(true)}
            className="bg-primary hover:bg-primary-hover text-background px-6 py-2.5 rounded-xl font-medium transition-colors shadow-lg shadow-primary/20 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Replicar Cartera
          </button>
        </div>
      </header>

      {/* NAV Chart */}
      <section className="glass-panel p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" /> Evolución del NAV
            {isSimulated && <span className="text-xs bg-surface-hover px-2 py-0.5 rounded text-text-muted ml-2">Simulado</span>}
            {navData.length > 0 && (
              <span className={clsx('ml-2 text-sm font-mono font-bold', navChangePct >= 0 ? 'text-success' : 'text-danger')}>
                {navChangePct >= 0 ? '+' : ''}{navChangePct.toFixed(2)}%
              </span>
            )}
          </h2>
          <div className="flex gap-1 bg-surface-hover rounded-lg p-1">
            {PERIODS.map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={clsx('px-3 py-1.5 rounded-md text-xs font-medium transition-colors', period === p ? 'bg-primary text-background' : 'text-text-muted hover:text-white')}>
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[320px] w-full">
          {navLoading ? (
            <div className="h-full flex items-center justify-center text-text-muted gap-2">
              <Activity className="w-5 h-5 animate-spin" /> Cargando datos...
            </div>
          ) : navData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={navData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} minTickGap={60}
                  tickFormatter={v => v.substring(0, 7)} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} domain={['auto', 'auto']}
                  tickFormatter={v => `${v.toFixed(0)}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }}
                  formatter={(v: any) => [`${Number(v).toFixed(2)}`, 'NAV']}
                  labelFormatter={l => l}
                />
                <Line type="monotone" dataKey="nav" stroke={model.color || 'var(--color-primary)'}
                  strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-text-muted">Sin datos históricos</div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Holdings */}
        <section className="lg:col-span-2 glass-panel p-6">
          <h2 className="text-lg font-semibold mb-6 border-b border-[var(--color-border)] pb-4">Composición del Asset Allocation</h2>
          <div className="space-y-4">
            {model.holdings?.map((holding: any, i: number) => (
              <motion.div key={holding.ticker} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium">
                    <span className="font-mono text-primary">{holding.ticker}</span>
                    <span className="text-text-muted text-xs font-normal ml-2">{holding.asset_name}</span>
                  </span>
                  <span className="font-mono text-primary font-bold">{(holding.weight * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full bg-surface-hover rounded-full h-2.5 overflow-hidden">
                  <div className="h-full transition-all duration-1000 ease-out"
                    style={{ width: `${holding.weight * 100}%`, backgroundColor: model.color || 'var(--color-primary)' }} />
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Metrics */}
        <section className="glass-panel p-6 space-y-6">
          <h2 className="text-lg font-semibold border-b border-[var(--color-border)] pb-4">Métricas Esperadas</h2>
          <div className="space-y-4">
            {[
              { label: 'Retorno Anualizado (CAGR)', value: `${((model.cagr || 0) * 100).toFixed(2)}%`, color: 'text-success' },
              { label: 'Riesgo (Max Drawdown)', value: `${((model.max_drawdown || 0) * 100).toFixed(2)}%`, color: 'text-danger' },
              { label: 'Ratio de Sharpe', value: (model.sharpe_ratio || 0).toFixed(2), color: 'text-secondary' },
              { label: 'Volatilidad', value: `${((model.volatility || 0) * 100).toFixed(2)}%`, color: 'text-text-main' },
            ].map(m => (
              <div key={m.label} className="flex justify-between items-center bg-surface-hover p-4 rounded-xl border border-[var(--color-border)]">
                <span className="text-sm text-text-muted">{m.label}</span>
                <span className={clsx('text-xl font-mono', m.color)}>{m.value}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
