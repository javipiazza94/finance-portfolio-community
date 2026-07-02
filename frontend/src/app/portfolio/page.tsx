'use client';

import { useEffect, useState, useMemo } from 'react';
import { fetchPersonalPortfolio, fetchTrades, deletePosition, refreshPortfolioPrices, fetchLatestProfile, updateAvgPrice, updateUnits } from '@/lib/api';
import { Briefcase, ArrowUpRight, ArrowDownRight, Activity, Plus, Search, PieChart, Calculator, History, Trash2, RefreshCw, ChevronUp, ChevronDown, ArrowUpDown, TrendingDown } from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TradeModal } from '@/components/TradeModal';
import { LiquidityModal } from '@/components/LiquidityModal';

const typeColors: Record<string, string> = {
  stocks: 'var(--color-chart-1)',
  bonds: 'var(--color-chart-3)',
  crypto: 'var(--color-chart-6)',
  cash: 'var(--color-chart-2)',
  gold: 'var(--color-chart-4)',
  other: 'var(--color-text-muted)'
};

const typeNames: Record<string, string> = {
  stocks: 'Acciones / ETFs',
  bonds: 'Renta Fija / Fondos',
  crypto: 'Criptomonedas',
  cash: 'Liquidez',
  gold: 'Oro',
  other: 'Otros'
};

const getMappedType = (type?: string, ticker?: string, name?: string) => {
  const t = type?.toLowerCase() || 'stock';
  const tk = (ticker || '').toLowerCase();
  const n = (name || '').toLowerCase();
  
  if (tk.includes('jupiter') || tk.includes('jupyter') || n.includes('jupiter') || n.includes('jupyter')) return 'gold';
  if (tk.includes('gold') || n.includes('gold') || n.includes('oro')) return 'gold';
  
  if (tk.includes('cash') || n.includes('liquidez')) return 'cash';
  
  if (t === 'stock' || t === 'etf') return 'stocks';
  if (t === 'fund') return 'bonds';
  if (t === 'crypto') return 'crypto';
  if (t === 'cash' || t === 'liquidity') return 'cash';
  if (t === 'gold') return 'gold';
  return 'other';
};



export default function PersonalPortfolioPage() {
  const [portfolio, setPortfolio] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trades, setTrades] = useState<any[]>([]);
  const [tradeConfig, setTradeConfig] = useState<{show: boolean, type: 'buy' | 'sell', ticker?: string}>({ show: false, type: 'buy' });
  const [deletingTicker, setDeletingTicker] = useState<string | null>(null);
  const [editingAvgPrice, setEditingAvgPrice] = useState<{ ticker: string; value: string } | null>(null);
  const [savingAvgPrice, setSavingAvgPrice] = useState(false);
  const [editingUnits, setEditingUnits] = useState<{ ticker: string; value: string } | null>(null);
  const [savingUnits, setSavingUnits] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'value', direction: 'desc' });
  const [profileResult, setProfileResult] = useState<any>(null);
  
  const [showLiquidity, setShowLiquidity] = useState(false);

  const loadPortfolio = () => {
    fetchPersonalPortfolio()
      .then(data => { setPortfolio(data); setLoading(false); })
      .catch(console.error);
  };

  const loadTrades = () => {
    fetchTrades().then(d => setTrades(d.trades || [])).catch(console.error);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshPortfolioPrices();
      await loadPortfolio();
    } catch(e) { console.error(e); }
    finally { setRefreshing(false); }
  };

  const handleDelete = async (ticker: string) => {
    if (!confirm(`¿Eliminar la posición de ${ticker}?`)) return;
    setDeletingTicker(ticker);
    try {
      await deletePosition(ticker);
      loadPortfolio();
    } catch(e) { console.error(e); }
    finally { setDeletingTicker(null); }
  };

  const handleSaveUnits = async (ticker: string) => {
    const val = parseFloat(editingUnits?.value ?? '');
    if (!val || val <= 0) { setEditingUnits(null); return; }
    setSavingUnits(true);
    try {
      await updateUnits(ticker, val);
      setPortfolio((prev: any) => ({
        ...prev,
        positions: prev.positions.map((p: any) => {
          if (p.ticker !== ticker) return p;
          const value = val * p.current_price;
          const cost = val * p.avg_price;
          const pl = value - cost;
          return { ...p, units: val, value, pl, pl_pct: cost > 0 ? (pl / cost) * 100 : 0 };
        }),
      }));
    } catch {
      alert('Error al guardar la cantidad. Inténtalo de nuevo.');
    } finally {
      setSavingUnits(false);
      setEditingUnits(null);
    }
  };

  const handleSaveAvgPrice = async (ticker: string) => {
    const val = parseFloat(editingAvgPrice?.value ?? '');
    if (!val || val <= 0) { setEditingAvgPrice(null); return; }
    setSavingAvgPrice(true);
    try {
      await updateAvgPrice(ticker, val);
      setPortfolio((prev: any) => ({
        ...prev,
        positions: prev.positions.map((p: any) => {
          if (p.ticker !== ticker) return p;
          const cost = p.units * val;
          const pl = p.value - cost;
          return { ...p, avg_price: val, pl, pl_pct: cost > 0 ? (pl / cost) * 100 : 0 };
        }),
      }));
    } catch {
      alert('Error al guardar el precio. Inténtalo de nuevo.');
    } finally {
      setSavingAvgPrice(false);
      setEditingAvgPrice(null);
    }
  };

  const [btInitial, setBtInitial] = useState(10000);
  const [btMonthly, setBtMonthly] = useState(500);
  const [btYears, setBtYears] = useState(10);
  const [btRate, setBtRate] = useState(8.5);

  const loadProfile = () => {
    fetchLatestProfile().then(setProfileResult).catch(console.error);
  };

  // On mount: first refresh prices, then load portfolio
  useEffect(() => {
    setLoading(true);
    refreshPortfolioPrices()
      .catch(() => {}) // non-blocking if no positions yet
      .finally(() => {
        loadPortfolio();
        loadTrades();
        loadProfile();
      });
  }, []);

  const sortedPositions = useMemo(() => {
    const pos = portfolio?.positions;
    if (!pos) return [];
    return [...pos].sort((a: any, b: any) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      if (sortConfig.key === 'name') {
        aValue = a.asset_name || a.ticker;
        bValue = b.asset_name || b.ticker;
        return sortConfig.direction === 'asc' 
          ? String(aValue).localeCompare(String(bValue)) 
          : String(bValue).localeCompare(String(aValue));
      }

      // Default numeric sort
      aValue = aValue || 0;
      bValue = bValue || 0;
      return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }, [portfolio?.positions, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40 group-hover:opacity-100 transition-opacity" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 ml-1 text-primary" /> : <ChevronDown className="w-3 h-3 ml-1 text-primary" />;
  };

  if (loading) return <div className="p-8 text-text-muted flex items-center gap-2"><Activity className="w-5 h-5 animate-spin" /> Cargando cartera...</div>;

  let { invested, total, pl, pl_pct, positions } = portfolio;
  
  // Convert USD assets (like Crypto) to EUR and recalculate totals
  const EUR_USD_RATE = 0.93; // Approx exchange rate 1 USD = 0.93 EUR
  
  positions = positions.map((p: any) => {
    if (p.ticker.endsWith('-USD')) {
      const current_price = p.current_price * EUR_USD_RATE;
      const avg_price = p.avg_price * EUR_USD_RATE;
      const value = p.value * EUR_USD_RATE;
      const cost = p.cost * EUR_USD_RATE;
      const pos_pl = value - cost;
      
      return {
        ...p,
        current_price,
        avg_price,
        value,
        cost,
        pl: pos_pl,
      };
    }
    return p;
  });

  total = positions.reduce((sum: number, p: any) => sum + p.value, 0);
  invested = positions.reduce((sum: number, p: any) => sum + p.cost, 0);
  pl = total - invested;
  pl_pct = invested > 0 ? (pl / invested) * 100 : 0;
  
  const isPos = pl >= 0;

  // Asset Allocation Calc
  const allocation: Record<string, number> = {
    cash: 0,
    bonds: 0,
    stocks: 0,
    crypto: 0,
    gold: 0,
    other: 0,
  };
  
  positions.forEach((pos: any) => {
    const t = getMappedType(pos.asset_type, pos.ticker, pos.asset_name);
    allocation[t] += pos.value;
  });
  
  if (allocation.other === 0) delete allocation.other;

  // Backtester Calc
  const btR = btRate / 100 / 12;
  const btN = btYears * 12;
  const btFutureValue = btInitial * Math.pow(1 + btR, btN) + (btMonthly * ((Math.pow(1 + btR, btN) - 1) / btR));
  const btTotalInvested = btInitial + (btMonthly * btN);
  const btProfit = btFutureValue - btTotalInvested;

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {tradeConfig.show && (
        <TradeModal
          positions={portfolio?.positions || []}
          initialType={tradeConfig.type}
          initialTicker={tradeConfig.ticker}
          onClose={() => setTradeConfig({ show: false, type: 'buy' })}
          onDone={() => { setTradeConfig({ show: false, type: 'buy' }); loadPortfolio(); loadTrades(); }}
        />
      )}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mi Portfolio</h1>
          <p className="text-text-muted mt-2">Visión general y análisis profundo de tus inversiones.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleRefresh} disabled={refreshing}
            className="glass-button px-4 py-2.5 flex items-center gap-2 text-sm" title="Actualizar precios">
            <RefreshCw className={clsx('w-4 h-4', refreshing && 'animate-spin')} />
            {refreshing ? 'Actualizando...' : 'Actualizar'}
          </button>
          <button onClick={() => setShowLiquidity(true)} className="bg-success/10 hover:bg-success/20 text-success border border-success/20 px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors">
            <Plus className="w-4 h-4" /> Liquidez
          </button>
          <button onClick={() => setTradeConfig({ show: true, type: 'buy' })} className="bg-primary hover:bg-primary-hover text-background px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors">
            <Plus className="w-4 h-4" /> Nueva Operación
          </button>
          <Link href="/market" className="glass-button px-6 py-2.5 text-primary hover:text-white border-primary/50">
            <Search className="w-4 h-4 mr-2" /> Explorar
          </Link>
        </div>
      </header>

      {/* Top KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="glass-panel p-5 border-l-4 border-primary/80 relative overflow-hidden">
           <div className="absolute -right-4 -bottom-4 opacity-5"><Briefcase className="w-24 h-24" /></div>
           <p className="label-terminal">Patrimonio Total</p>
           <h2 className="font-mono text-3xl font-bold mt-2">€{total.toFixed(2)}</h2>
        </div>
        <div className="glass-panel p-5">
           <p className="label-terminal">Invertido</p>
           <h2 className="font-mono text-3xl font-bold mt-2">€{invested.toFixed(2)}</h2>
        </div>
        <div className="glass-panel p-5">
           <p className="label-terminal">Rentabilidad Histórica</p>
           <h2 className={clsx("font-mono text-3xl font-bold mt-2", isPos ? 'text-success' : 'text-danger')}>
             {isPos ? '+' : ''}€{pl.toFixed(2)}
           </h2>
           <span className={clsx("font-mono text-sm font-medium mt-1 flex items-center", isPos ? "text-success/80" : "text-danger/80")}>
              {isPos ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
              {pl_pct.toFixed(2)}%
           </span>
        </div>
        <div className="glass-panel p-5 bg-gradient-to-br from-surface to-surface-hover">
           <p className="label-terminal">Rentabilidad Anualizada</p>
           <h2 className={clsx("font-mono text-3xl font-bold mt-2", isPos ? 'text-success' : 'text-danger')}>
             {isPos ? '+' : ''}{pl_pct.toFixed(2)}%
           </h2>
           <p className="text-text-muted text-xs mt-1">*Estimada (1 año base)</p>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Main Chart — Bar chart of current position values by asset */}
        <section className="xl:col-span-2 glass-panel p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" /> Valor por Posición
            </h3>
          </div>
          <div className="h-[350px] w-full">
            {positions.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={positions.map((p: any) => ({ name: p.asset_name || p.ticker, value: p.value, pl: p.pl, type: p.asset_type }))} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} 
                    angle={-45} 
                    textAnchor="end" 
                    height={85} 
                    interval={0}
                    tickFormatter={(v) => v.length > 18 ? v.substring(0, 18) + '...' : v}
                  />
                  <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} tickFormatter={(v) => `€${v.toLocaleString()}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }}
                    itemStyle={{ color: 'var(--color-chart-6)', fontWeight: 500 }}
                    labelStyle={{ color: 'white', fontWeight: 'bold', paddingBottom: '4px' }}
                    formatter={(v: any, _: any, props: any) => [
                      `€${Number(v).toFixed(2)} (P/L: ${props.payload.pl >= 0 ? '+' : ''}€${props.payload.pl.toFixed(2)})`,
                      'Valor'
                    ]}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {positions.map((p: any, i: number) => (
                      <Cell key={p.ticker} fill={typeColors[getMappedType(p.asset_type, p.ticker, p.asset_name)] || typeColors.other} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-text-muted">
                Añade posiciones para ver el gráfico.
              </div>
            )}
          </div>
        </section>

        {/* Asset Allocation */}
        <section className="glass-panel p-6 flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <PieChart className="w-5 h-5 text-secondary" /> Asset Allocation
            </h3>
            {profileResult && (
              <div className="text-right">
                <div className="text-xs text-text-muted uppercase tracking-wider font-medium">Tu Perfil MiFID</div>
                <div className="font-bold text-primary">{profileResult.profile} ({profileResult.pct}%)</div>
              </div>
            )}
          </div>
          <div className="flex-1 flex flex-col justify-center">
            {total > 0 ? (
              <>
                <div className="w-full h-4 rounded-full overflow-hidden flex bg-surface-hover mb-6">
                  {Object.entries(allocation).map(([type, val]: any) => (
                    <div 
                      key={type} 
                      style={{ width: `${(val / total) * 100}%`, backgroundColor: typeColors[type] || typeColors.other }}
                      className="h-full transition-all duration-500"
                    />
                  ))}
                </div>
                <div className="space-y-3">
                  {Object.entries(allocation).sort((a: any, b: any) => b[1] - a[1]).map(([type, val]: any) => {
                    const pct = total > 0 ? (val / total) * 100 : 0;
                    
                    const recPct = profileResult?.alloc?.[type] || 0;
                    
                    const diff = Math.abs(pct - recPct);

                    return (
                      <div key={type} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: typeColors[type] || typeColors.other }}></div>
                          <span className="font-medium text-sm">{typeNames[type] || type}</span>
                        </div>
                        <div className="text-right flex items-center justify-end">
                          <span className="font-mono text-sm">€{val.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                          <span className="text-text-muted text-xs ml-2 w-12 inline-block">{pct.toFixed(1)}%</span>
                          {profileResult?.alloc && type !== 'other' && (
                            <span className={clsx(
                              "text-xs font-mono ml-2 w-[85px] text-right inline-block",
                              diff > 15 ? "text-danger" : diff > 5 ? "text-[var(--color-chart-6)]" : "text-text-muted"
                            )}>
                              (Rec: {recPct}%)
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="text-center text-text-muted">
                Añade posiciones para ver tu distribución.
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Positions Table */}
      <section className="glass-panel p-6">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-primary" /> Posiciones Abiertas
          <span className="ml-auto text-xs font-normal text-text-muted">{positions.length} posiciones</span>
        </h3>
        <div className="overflow-x-auto">
          {positions.length === 0 ? (
            <div className="py-12 text-center text-text-muted bg-surface-hover/30 rounded-xl border border-dashed border-[var(--color-border)]">
              No tienes posiciones abiertas. Comienza buscando un activo en el explorador.
              <br />
              <Link href="/market" className="inline-flex mt-4 items-center justify-center glass-button px-4 py-2">Explorar Mercados</Link>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="text-text-muted text-xs uppercase tracking-wider border-b border-[var(--color-border)]/50">
                <tr>
                  <th className="pb-4 font-medium cursor-pointer group hover:text-text-main transition-colors select-none" onClick={() => handleSort('name')}>
                    <div className="flex items-center">Activo <SortIcon columnKey="name" /></div>
                  </th>
                  <th className="pb-4 font-medium text-right cursor-pointer group hover:text-text-main transition-colors select-none" onClick={() => handleSort('units')}>
                    <div className="flex items-center justify-end">Cantidad <SortIcon columnKey="units" /></div>
                  </th>
                  <th className="pb-4 font-medium text-right cursor-pointer group hover:text-text-main transition-colors select-none" onClick={() => handleSort('avg_price')}>
                    <div className="flex items-center justify-end">Precio Medio <SortIcon columnKey="avg_price" /></div>
                  </th>
                  <th className="pb-4 font-medium text-right cursor-pointer group hover:text-text-main transition-colors select-none" onClick={() => handleSort('current_price')}>
                    <div className="flex items-center justify-end">Precio Actual <SortIcon columnKey="current_price" /></div>
                  </th>
                  <th className="pb-4 font-medium text-right cursor-pointer group hover:text-text-main transition-colors select-none" onClick={() => handleSort('value')}>
                    <div className="flex items-center justify-end">Valor Total <SortIcon columnKey="value" /></div>
                  </th>
                  <th className="pb-4 font-medium text-right cursor-pointer group hover:text-text-main transition-colors select-none" onClick={() => handleSort('pl')}>
                    <div className="flex items-center justify-end">Rentabilidad <SortIcon columnKey="pl" /></div>
                  </th>
                  <th className="pb-4 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]/30">
                {sortedPositions.map((pos: any, idx: number) => {
                  const posIsPos = pos.pl >= 0;
                  return (
                    <motion.tr
                      key={pos.ticker}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="hover:bg-surface-hover/30 transition-colors group"
                    >
                      <td className="py-4 pr-4">
                        <Link href={`/market/${pos.ticker}`} className="block">
                          <div className="font-bold group-hover:text-primary transition-colors">{pos.asset_name || pos.ticker}</div>
                          <div className="text-sm text-text-muted truncate max-w-[200px]">{pos.ticker}</div>
                        </Link>
                      </td>
                      <td className="py-4 px-2 text-right font-mono">
                        {editingUnits?.ticker === pos.ticker ? (
                          <input
                            type="number" step="0.0001" min="0.0001"
                            className="w-24 text-right bg-surface border border-primary rounded px-1 py-0.5 font-mono text-sm focus:outline-none"
                            value={editingUnits!.value}
                            disabled={savingUnits}
                            autoFocus
                            onChange={(e) => setEditingUnits({ ticker: pos.ticker, value: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveUnits(pos.ticker);
                              if (e.key === 'Escape') setEditingUnits(null);
                            }}
                            onBlur={() => handleSaveUnits(pos.ticker)}
                          />
                        ) : (
                          <span
                            className="cursor-pointer hover:text-primary hover:underline transition-colors"
                            title="Clic para editar cantidad"
                            onClick={() => setEditingUnits({ ticker: pos.ticker, value: String(pos.units) })}
                          >
                            {(pos.units || 0).toFixed(4)}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-2 text-right font-mono">
                        {editingAvgPrice?.ticker === pos.ticker ? (
                          <input
                            type="number" step="0.01" min="0.01"
                            className="w-24 text-right bg-surface border border-primary rounded px-1 py-0.5 font-mono text-sm focus:outline-none"
                            value={editingAvgPrice!.value}
                            disabled={savingAvgPrice}
                            autoFocus
                            onChange={(e) => setEditingAvgPrice({ ticker: pos.ticker, value: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveAvgPrice(pos.ticker);
                              if (e.key === 'Escape') setEditingAvgPrice(null);
                            }}
                            onBlur={() => handleSaveAvgPrice(pos.ticker)}
                          />
                        ) : (
                          <span
                            className="cursor-pointer hover:text-primary hover:underline transition-colors"
                            title="Clic para editar precio medio"
                            onClick={() => setEditingAvgPrice({ ticker: pos.ticker, value: String(pos.avg_price) })}
                          >
                            €{(pos.avg_price || 0).toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-2 text-right font-mono">€{(pos.current_price || 0).toFixed(2)}</td>
                      <td className="py-4 px-2 text-right font-mono font-medium">€{(pos.value || 0).toFixed(2)}</td>
                      <td className="py-4 pl-4 text-right">
                        <div className={clsx('font-medium', posIsPos ? 'text-success' : 'text-danger')}>
                          {posIsPos ? '+' : ''}€{(pos.pl || 0).toFixed(2)}
                        </div>
                        <div className={clsx('text-xs mt-0.5', posIsPos ? 'text-success/80' : 'text-danger/80')}>
                          {posIsPos ? '+' : ''}{(pos.pl_pct || 0).toFixed(2)}%
                        </div>
                      </td>
                      <td className="py-4 pl-2 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setTradeConfig({ show: true, type: 'sell', ticker: pos.ticker })}
                            className="p-1.5 rounded-lg hover:bg-surface hover:text-white text-text-muted transition-colors flex items-center gap-1 text-xs"
                            title="Vender posición"
                          >
                            <TrendingDown className="w-4 h-4" /> Vender
                          </button>
                          <button
                            onClick={() => handleDelete(pos.ticker)}
                            disabled={deletingTicker === pos.ticker}
                            className="p-1.5 rounded-lg hover:bg-danger/20 hover:text-danger text-text-muted transition-colors"
                            title="Eliminar posición"
                          >
                            {deletingTicker === pos.ticker
                              ? <Activity className="w-4 h-4 animate-spin" />
                              : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Trade History */}
      <section className="glass-panel p-6">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <History className="w-5 h-5 text-secondary" /> Historial de Operaciones
          <span className="ml-auto text-xs font-normal text-text-muted">{trades.length} operaciones</span>
        </h3>
        {trades.length === 0 ? (
          <div className="py-10 text-center text-text-muted border border-dashed border-[var(--color-border)] rounded-xl">
            Aún no hay operaciones. Pulsa <strong className="text-primary">Nueva Operación</strong> para empezar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-text-muted text-xs uppercase tracking-wider border-b border-[var(--color-border)]/50">
                <tr>
                  <th className="pb-3 font-medium">Fecha</th>
                  <th className="pb-3 font-medium">Activo</th>
                  <th className="pb-3 font-medium">Tipo</th>
                  <th className="pb-3 font-medium text-right">Unidades</th>
                  <th className="pb-3 font-medium text-right">Precio</th>
                  <th className="pb-3 font-medium text-right">Total</th>
                  <th className="pb-3 font-medium text-right">P/L Realizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]/30">
                {trades.map((t: any, i: number) => (
                  <motion.tr key={t.id} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{delay:i*0.03}}
                    className="hover:bg-surface-hover/30 text-sm">
                    <td className="py-3 pr-4 text-text-muted font-mono text-xs">{t.date || t.created_at?.split('T')[0]}</td>
                    <td className="py-3 pr-4">
                      <div className="font-bold">{t.asset_name || t.ticker}</div>
                      <div className="text-xs text-text-muted truncate max-w-[140px]">{t.ticker}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={clsx('px-2 py-1 rounded-full text-xs font-bold uppercase', t.trade_type === 'buy' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger')}>
                        {t.trade_type === 'buy' ? 'Compra' : 'Venta'}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right font-mono">{(t.units||0).toFixed(4)}</td>
                    <td className="py-3 px-2 text-right font-mono">€{(t.price||0).toFixed(2)}</td>
                    <td className="py-3 px-2 text-right font-mono font-medium">€{(t.total||0).toFixed(2)}</td>
                    <td className="py-3 pl-2 text-right font-mono">
                      {t.trade_type === 'sell' ? (
                        <span className={clsx(t.realized_pl >= 0 ? 'text-success' : 'text-danger')}>
                          {t.realized_pl >= 0 ? '+' : ''}{(t.realized_pl||0).toFixed(2)}
                        </span>
                      ) : <span className="text-text-muted">—</span>}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Simulator (Backtester) */}

      <section className="glass-panel p-6 bg-gradient-to-br from-surface to-surface-hover/50">
        <div className="flex flex-col lg:flex-row gap-12">
          <div className="flex-1">
            <h3 className="text-xl font-bold flex items-center gap-2 mb-2">
              <Calculator className="w-6 h-6 text-primary" /> Simulador de Inversión
            </h3>
            <p className="text-text-muted text-sm mb-8">Descubre cuánto podría crecer tu capital con el poder del interés compuesto y aportaciones periódicas.</p>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium">Inversión Inicial</label>
                  <span className="font-mono text-primary">€{btInitial.toLocaleString()}</span>
                </div>
                <input type="range" min="0" max="100000" step="1000" value={btInitial} onChange={(e) => setBtInitial(Number(e.target.value))} className="w-full accent-primary" />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium">Aportación Mensual</label>
                  <span className="font-mono text-primary">€{btMonthly.toLocaleString()}</span>
                </div>
                <input type="range" min="0" max="5000" step="50" value={btMonthly} onChange={(e) => setBtMonthly(Number(e.target.value))} className="w-full accent-primary" />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium">Plazo (Años)</label>
                    <span className="font-mono text-primary">{btYears}</span>
                  </div>
                  <input type="range" min="1" max="40" step="1" value={btYears} onChange={(e) => setBtYears(Number(e.target.value))} className="w-full accent-primary" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium">Rentabilidad Anual (%)</label>
                    <span className="font-mono text-success">{btRate}%</span>
                  </div>
                  <input type="range" min="1" max="25" step="0.5" value={btRate} onChange={(e) => setBtRate(Number(e.target.value))} className="w-full accent-success" />
                </div>
              </div>
            </div>
          </div>
          
          <div className="lg:w-[400px] bg-background/50 rounded-2xl p-8 border border-[var(--color-border)] flex flex-col justify-center">
            <p className="text-center text-text-muted mb-2 font-medium">Valor futuro estimado</p>
            <h2 className="text-5xl font-bold text-center text-primary mb-8 tracking-tight">€{btFutureValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</h2>
            
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center pb-3 border-b border-[var(--color-border)]/50">
                <span className="text-text-muted">Total Invertido</span>
                <span className="font-mono font-medium">€{btTotalInvested.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-[var(--color-border)]/50">
                <span className="text-text-muted">Intereses Generados</span>
                <span className="font-mono font-medium text-success">+€{btProfit.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {showLiquidity && (
        <LiquidityModal onClose={() => setShowLiquidity(false)} onAdded={() => { loadPortfolio(); }} />
      )}
    </div>
  );
}
