'use client';

import { useEffect, useState, useMemo } from 'react';
import { fetchIndices, fetchMarketBrowse, searchYF, addAsset } from '@/lib/api';
import { Search, ChevronRight, Activity, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { clsx } from 'clsx';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type SortKey = 'name' | 'ticker' | 'price' | 'change' | 'market_cap';
type SortDir = 'asc' | 'desc';

export default function MarketExplorerPage() {
  const [indices, setIndices] = useState<any[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<string>('sp500');
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [localFilter, setLocalFilter] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>('market_cap');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const router = useRouter();

  useEffect(() => {
    fetchIndices().then(data => {
      setIndices(data);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedIdx) return;
    setLoading(true);
    setLocalFilter('');
    fetchMarketBrowse(selectedIdx)
      .then(data => {
        setAssets(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [selectedIdx]);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    const timer = setTimeout(() => {
      setIsSearching(true);
      searchYF(searchQuery).then(data => {
        setSearchResults(data);
        setShowDropdown(true);
        setIsSearching(false);
      }).catch(() => setIsSearching(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAddCustomAsset = async (asset: any) => {
    setShowDropdown(false);
    setSearchQuery('');
    try {
      let type = 'stock';
      if (asset.type === 'ETF') type = 'etf';
      if (asset.type === 'CRYPTOCURRENCY') type = 'crypto';
      if (asset.type === 'MUTUALFUND') type = 'fund';
      await addAsset({ ticker: asset.ticker, name: asset.name, asset_type: type });
      router.push(`/market/${asset.ticker}`);
    } catch (e) {
      console.error(e);
    }
  };

  const formatPrice = (price: number, currency: string) => {
    const sym = currency === 'EUR' ? '€' : '$';
    if (price >= 1000) return `${sym}${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
    if (price >= 1) return `${sym}${price.toFixed(2)}`;
    if (price >= 0.01) return `${sym}${price.toFixed(4)}`;
    return `${sym}${price.toFixed(8)}`;
  };

  const cycleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'change' || key === 'market_cap' ? 'desc' : 'asc');
    }
  };

  const sortedAssets = useMemo(() => {
    let filtered = localFilter
      ? assets.filter(a =>
          a.name?.toLowerCase().includes(localFilter.toLowerCase()) ||
          a.ticker?.toLowerCase().includes(localFilter.toLowerCase())
        )
      : assets;

    return [...filtered].sort((a, b) => {
      let av: any, bv: any;
      switch (sortKey) {
        case 'name':    av = a.name?.toLowerCase() ?? ''; bv = b.name?.toLowerCase() ?? ''; break;
        case 'ticker':  av = a.ticker?.toLowerCase() ?? ''; bv = b.ticker?.toLowerCase() ?? ''; break;
        case 'price':   av = a.price ?? 0; bv = b.price ?? 0; break;
        case 'change':  av = a.change_1d ?? 0; bv = b.change_1d ?? 0; break;
        case 'market_cap': av = a.market_cap ?? 0; bv = b.market_cap ?? 0; break;
        default:        av = 0; bv = 0;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [assets, localFilter, sortKey, sortDir]);

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => {
    const active = sortKey === k;
    const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <button
        onClick={() => cycleSort(k)}
        className={clsx(
          'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
          active
            ? 'bg-primary text-background'
            : 'bg-surface hover:bg-surface-hover text-text-muted hover:text-text-main border border-[var(--color-border)]'
        )}
      >
        <Icon className="w-3 h-3" />
        {label}
      </button>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Explorador de Mercados</h1>
        <p className="text-text-muted mt-2">Filtra y navega por el catálogo de activos internacionales.</p>
      </header>

      <div className="flex gap-6">
        {/* Categories Sidebar */}
        <div className="w-64 flex-shrink-0 space-y-2">
          {indices.map(idx => (
            <button
              key={idx.id}
              onClick={() => setSelectedIdx(idx.id)}
              className={clsx(
                'w-full text-left px-4 py-3 rounded-lg flex items-center justify-between transition-all duration-200',
                selectedIdx === idx.id
                  ? 'bg-primary text-background font-medium shadow-md shadow-primary/20'
                  : 'bg-surface hover:bg-surface-hover text-text-muted hover:text-text-main'
              )}
            >
              <span>{idx.name}</span>
              <span className={clsx(
                'text-xs px-2 py-0.5 rounded-full',
                selectedIdx === idx.id ? 'bg-background/20' : 'bg-surface-hover text-text-muted'
              )}>{idx.count}</span>
            </button>
          ))}
        </div>

        {/* Asset Grid */}
        <div className="flex-1 glass-panel p-6 min-h-[500px]">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 mb-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {indices.find(i => i.id === selectedIdx)?.name || 'Activos'}
                {!loading && (
                  <span className="ml-2 text-sm font-normal text-text-muted">
                    ({sortedAssets.length})
                  </span>
                )}
              </h2>

              {/* Global YF search */}
              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  placeholder="Buscar activo globalmente..."
                  className="w-full bg-surface border border-[var(--color-border)] rounded-full py-1.5 pl-9 pr-4 text-sm outline-none focus:border-primary/50"
                />
                {isSearching && <Activity className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-text-muted" />}

                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute top-full mt-2 w-[300px] right-0 bg-surface border border-[var(--color-border)] rounded-lg shadow-xl overflow-hidden z-50">
                    {searchResults.map((res, i) => (
                      <button
                        key={i}
                        onClick={() => handleAddCustomAsset(res)}
                        className="w-full text-left px-4 py-3 hover:bg-surface-hover border-b border-[var(--color-border)]/50 last:border-0 flex justify-between items-center transition-colors"
                      >
                        <div>
                          <div className="font-bold text-sm">{res.ticker}</div>
                          <div className="text-xs text-text-muted truncate max-w-[180px]">{res.name}</div>
                        </div>
                        <div className="text-[10px] uppercase bg-background px-2 py-1 rounded text-text-muted">
                          {res.type}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sort + local filter row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-text-muted mr-1">Ordenar:</span>
              <SortBtn k="name" label="Nombre" />
              <SortBtn k="ticker" label="Ticker" />
              <SortBtn k="price" label="Precio" />
              <SortBtn k="change" label="Cambio %" />
              <SortBtn k="market_cap" label="Market Cap" />

              <div className="ml-auto relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={localFilter}
                  onChange={e => setLocalFilter(e.target.value)}
                  placeholder="Filtrar en este índice..."
                  className="bg-surface border border-[var(--color-border)] rounded-lg py-1.5 pl-8 pr-3 text-xs outline-none focus:border-primary/50 w-48"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64 text-text-muted">
              <Activity className="w-6 h-6 animate-spin mr-2" /> Cargando precios...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedAssets.map((asset) => (
                <div
                  key={asset.ticker}
                  className="bg-surface hover:bg-surface-hover border border-[var(--color-border)] rounded-xl p-4 transition-colors group relative"
                >
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <h3 className="font-bold text-base line-clamp-1">{asset.name}</h3>
                      <p className="text-sm text-text-muted font-mono">{asset.ticker}</p>
                    </div>
                    <span className="text-[10px] font-mono bg-surface-glass px-2 py-1 rounded text-text-muted shrink-0 ml-2">
                      {(asset.asset_type || 'STOCK').toUpperCase()}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-base font-mono font-semibold">
                      {asset.price
                        ? formatPrice(asset.price, asset.currency)
                        : <span className="text-text-muted text-sm">—</span>}
                    </span>
                    {asset.price && asset.change_1d != null ? (
                      <span className={clsx('text-sm font-medium', asset.change_1d >= 0 ? 'text-success' : 'text-danger')}>
                        {asset.change_1d >= 0 ? '+' : ''}{asset.change_1d.toFixed(2)}%
                      </span>
                    ) : asset.price ? (
                      <span className="text-sm text-text-muted">—</span>
                    ) : (
                      <span className="text-xs text-text-muted">Sin precio</span>
                    )}
                  </div>

                  {asset.market_cap && (
                    <p className="text-[10px] text-text-muted mt-1">
                      Cap: {asset.market_cap >= 1e12
                        ? `$${(asset.market_cap / 1e12).toFixed(2)}T`
                        : `$${(asset.market_cap / 1e9).toFixed(1)}B`}
                    </p>
                  )}

                  <Link
                    href={`/market/${asset.ticker}`}
                    className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"
                  >
                    <span className="bg-primary text-background px-4 py-2 rounded-lg font-medium flex items-center gap-2 text-sm">
                      Ver Detalles <ChevronRight className="w-4 h-4" />
                    </span>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
