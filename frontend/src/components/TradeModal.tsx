'use client';
import { useState } from 'react';
import { X, TrendingUp, TrendingDown, Search, Activity, ChevronDown } from 'lucide-react';
import { searchYF, addAsset, buyAsset, sellAsset } from '@/lib/api';
import { clsx } from 'clsx';

interface Position {
  ticker: string;
  asset_name: string;
  units: number;
  avg_price: number;
  current_price: number;
  value: number;
}

interface TradeModalProps {
  positions?: Position[];
  initialType?: 'buy' | 'sell';
  initialTicker?: string;
  onClose: () => void;
  onDone: () => void;
}

export function TradeModal({ positions = [], initialType = 'buy', initialTicker = '', onClose, onDone }: TradeModalProps) {
  const [type, setType] = useState<'buy' | 'sell'>(initialType);

  // --- BUY state ---
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [searching, setSearching] = useState(false);

  // --- SELL state: pick from existing positions ---
  const [sellTicker, setSellTicker] = useState<string>(initialTicker);
  const sellPosition = positions.find(p => p.ticker === sellTicker);

  // --- shared ---
  const [price, setPrice] = useState(() => {
    if (initialType === 'sell' && initialTicker) {
      const pos = positions.find(p => p.ticker === initialTicker);
      return pos ? (pos.current_price > 0 ? pos.current_price.toFixed(2) : pos.avg_price.toFixed(2)) : '';
    }
    return '';
  });
  const [units, setUnits] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const data = await searchYF(query);
      const arr = Array.isArray(data) ? data : (data.results || []);
      // Exclude non-investable types (options, futures, warrants, currencies)
      const EXCLUDE = ['OPTION', 'FUTURE', 'WARRANT', 'CURRENCY'];
      setResults(arr.filter((r: any) => r.ticker && !EXCLUDE.includes(r.type)));
    } catch { setResults([]); }
    finally { setSearching(false); }
  };

  const handleSelect = (r: any) => {
    setSelected(r);
    setResults([]);
    setQuery(`${r.ticker} — ${r.name}`);
    // Pre-fill price if available
  };

  // When sell position changes, pre-fill current price and max units
  const handleSellSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const ticker = e.target.value;
    setSellTicker(ticker);
    const pos = positions.find(p => p.ticker === ticker);
    if (pos) {
      setPrice(pos.current_price > 0 ? pos.current_price.toFixed(2) : pos.avg_price.toFixed(2));
      setUnits(pos.units.toFixed(4));
    }
  };

  const handleSellAllUnits = () => {
    if (sellPosition) setUnits(sellPosition.units.toFixed(4));
  };

  const handleSubmit = async () => {
    if (type === 'buy' && !selected) return setError('Selecciona un activo.');
    if (type === 'sell' && !sellTicker) return setError('Selecciona una posición a vender.');
    if (!price || isNaN(Number(price)) || Number(price) <= 0) return setError('Precio inválido.');
    if (!units || isNaN(Number(units)) || Number(units) <= 0) return setError('Unidades inválidas.');

    if (type === 'sell' && sellPosition && Number(units) > sellPosition.units + 0.0001) {
      return setError(`Máximo ${sellPosition.units.toFixed(4)} unidades disponibles.`);
    }

    setSubmitting(true); setError('');
    try {
      if (type === 'buy') {
        // Map YF quoteType → internal asset_type
        const typeMap: Record<string, string> = {
          'EQUITY': 'stock',
          'ETF': 'etf',
          'CRYPTOCURRENCY': 'crypto',
          'MUTUALFUND': 'fund',
          'FUND': 'fund',
          'INDEX': 'etf',
        };
        const assetType = typeMap[selected.type?.toUpperCase()] || 'stock';
        await addAsset({ ticker: selected.ticker, name: selected.name, asset_type: assetType });
        await buyAsset({ ticker: selected.ticker, units: Number(units), price: Number(price), date });
      } else {
        await sellAsset({ ticker: sellTicker, units: Number(units), price: Number(price), date });
      }
      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Error al registrar operación.');
    } finally { setSubmitting(false); }
  };

  const total = price && units ? (Number(price) * Number(units)).toFixed(2) : '—';
  const sellPL = sellPosition && price && units
    ? ((Number(price) - sellPosition.avg_price) * Number(units)).toFixed(2)
    : null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="glass-panel p-8 w-full max-w-md animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Nueva Operación</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-text-muted hover:text-white" /></button>
        </div>

        {/* Buy / Sell Toggle */}
        <div className="flex rounded-xl overflow-hidden border border-[var(--color-border)] mb-6">
          {(['buy', 'sell'] as const).map(t => (
            <button key={t} onClick={() => { setType(t); setError(''); }}
              className={clsx('flex-1 py-2.5 font-medium text-sm flex items-center justify-center gap-2 transition-colors',
                type === t ? (t === 'buy' ? 'bg-success text-background' : 'bg-danger text-white') : 'text-text-muted hover:text-white')}>
              {t === 'buy' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {t === 'buy' ? 'Compra' : 'Venta'}
            </button>
          ))}
        </div>

        {/* ── BUY: Asset Search ── */}
        {type === 'buy' && (
          <div className="mb-4 relative">
            <label className="text-xs text-text-muted uppercase font-medium mb-1 block">Activo (acciones, ETFs, fondos, cripto)</label>
            <div className="flex gap-2">
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Ej: FXAIX, Fidelity, Bitcoin, AAPL..."
                className="input flex-1"
              />
              <button onClick={handleSearch} className="glass-button px-3" title="Buscar">
                {searching ? <Activity className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-text-muted mt-1">Escribe y pulsa Enter o el botón 🔍</p>
            {results.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 glass-panel mt-1 py-1 max-h-56 overflow-y-auto">
                {results.slice(0, 10).map((r: any) => {
                  const typeBadge: Record<string, string> = {
                    EQUITY: 'Acción', ETF: 'ETF', CRYPTOCURRENCY: 'Cripto',
                    MUTUALFUND: 'Fondo', FUND: 'Fondo', INDEX: 'Índice',
                  };
                  return (
                    <button key={r.ticker} onClick={() => handleSelect(r)}
                      className="w-full text-left px-4 py-2.5 hover:bg-surface-hover flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-bold text-primary text-sm shrink-0">{r.ticker}</span>
                        <span className="text-xs text-text-muted truncate">{r.name}</span>
                      </div>
                      <span className="text-xs bg-surface-hover px-1.5 py-0.5 rounded text-text-muted shrink-0">
                        {typeBadge[r.type] || r.type}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {results.length === 0 && query && !searching && (
              <p className="text-xs text-text-muted mt-1">Sin resultados. Prueba con el ticker exacto (ej: FXAIX).</p>
            )}
            {selected && <p className="text-xs text-success mt-1">✓ {selected.ticker} · {selected.name}</p>}
          </div>
        )}

        {/* ── SELL: Pick from existing positions ── */}
        {type === 'sell' && (
          <div className="mb-4">
            <label className="text-xs text-text-muted uppercase font-medium mb-1 block">Posición a vender</label>
            {positions.length === 0 ? (
              <p className="text-danger text-sm">No tienes posiciones abiertas.</p>
            ) : (
              <div className="relative">
                <select value={sellTicker} onChange={handleSellSelect} className="input w-full appearance-none pr-8">
                  <option value="">-- Selecciona un activo --</option>
                  {positions.map(p => (
                    <option key={p.ticker} value={p.ticker}>
                      {p.ticker} — {p.asset_name} ({p.units.toFixed(4)} u · ${p.value.toFixed(2)})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-text-muted pointer-events-none" />
              </div>
            )}
            {/* Position summary */}
            {sellPosition && (
              <div className="mt-3 bg-surface-hover rounded-xl p-3 grid grid-cols-3 gap-2 text-xs text-center">
                <div>
                  <div className="text-text-muted mb-1">Unidades</div>
                  <div className="font-mono font-bold">{sellPosition.units.toFixed(4)}</div>
                </div>
                <div>
                  <div className="text-text-muted mb-1">Precio Medio</div>
                  <div className="font-mono font-bold">${sellPosition.avg_price.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-text-muted mb-1">Valor Actual</div>
                  <div className="font-mono font-bold">${sellPosition.value.toFixed(2)}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Price & Units */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-text-muted uppercase font-medium mb-1 block">Precio (€/$)</label>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)} min="0" step="0.01" placeholder="0.00" className="input w-full" />
          </div>
          <div>
            <label className="text-xs text-text-muted uppercase font-medium mb-1 flex items-center justify-between">
              <span>Unidades</span>
              {type === 'sell' && sellPosition && (
                <button onClick={handleSellAllUnits} className="text-primary hover:underline text-xs">Vender todo</button>
              )}
            </label>
            <input type="number" value={units} onChange={e => setUnits(e.target.value)} min="0"
              max={type === 'sell' && sellPosition ? sellPosition.units : undefined}
              step="0.0001" placeholder="0" className="input w-full" />
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs text-text-muted uppercase font-medium mb-1 block">Fecha</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input w-full" />
        </div>

        {/* Summary */}
        <div className="bg-surface-hover rounded-xl p-4 mb-6 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-text-muted text-sm">Total operación</span>
            <span className="font-mono font-bold text-lg">${total}</span>
          </div>
          {type === 'sell' && sellPL !== null && (
            <div className="flex justify-between items-center">
              <span className="text-text-muted text-sm">P/L estimado</span>
              <span className={clsx('font-mono font-bold', Number(sellPL) >= 0 ? 'text-success' : 'text-danger')}>
                {Number(sellPL) >= 0 ? '+' : ''}${sellPL}
              </span>
            </div>
          )}
        </div>

        {error && <p className="text-danger text-sm mb-4">{error}</p>}

        <button onClick={handleSubmit} disabled={submitting}
          className={clsx('w-full py-3 rounded-xl font-bold transition-colors',
            type === 'buy' ? 'bg-success hover:bg-success/80 text-background' : 'bg-danger hover:bg-danger/80 text-white',
            'disabled:opacity-50')}>
          {submitting ? 'Procesando...' : type === 'buy' ? 'Registrar Compra' : 'Registrar Venta'}
        </button>
      </div>
    </div>
  );
}
