'use client';

import { useEffect, useState, useCallback } from 'react';
import { Globe, RefreshCw } from 'lucide-react';
import {
  fetchIndices,
  fetchMarketBrowse,
  useMarketStream,
  refreshMarketQuotes,
} from '@/lib/api';
import { CategoryBrowse } from '@/components/dashboard/CategoryBrowse';
import { AssetQuickModal, type ModalAsset } from '@/components/dashboard/AssetQuickModal';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';

export default function DashboardPage() {
  const [indices, setIndices] = useState<any[]>([]);
  const { prices, connected } = useMarketStream();

  // Category browse
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [browseAssets, setBrowseAssets] = useState<any[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);

  // Quick modal
  const [modalAsset, setModalAsset] = useState<ModalAsset | null>(null);

  // Refresh
  const [refreshing, setRefreshing] = useState(false);

  const loadIndices = useCallback(async () => {
    try {
      const data = await fetchIndices();
      setIndices(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadIndices();
  }, [loadIndices]);

  const handleSelectCategory = useCallback(
    (id: string) => {
      if (activeCategoryId === id) {
        setActiveCategoryId(null);
        setBrowseAssets([]);
        return;
      }
      setActiveCategoryId(id);
      setBrowseLoading(true);
      fetchMarketBrowse(id)
        .then(data => setBrowseAssets(Array.isArray(data) ? data : []))
        .catch(() => setBrowseAssets([]))
        .finally(() => setBrowseLoading(false));
    },
    [activeCategoryId]
  );

  const handleSelectAsset = useCallback((asset: ModalAsset) => {
    setModalAsset(asset);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalAsset(null);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshMarketQuotes();
      await loadIndices();
      if (activeCategoryId) {
        setBrowseLoading(true);
        const data = await fetchMarketBrowse(activeCategoryId);
        setBrowseAssets(Array.isArray(data) ? data : []);
        setBrowseLoading(false);
      }
    } catch (err) {
      console.error('Refresh failed', err);
    } finally {
      setRefreshing(false);
    }
  }, [activeCategoryId, loadIndices]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Panorama Global</h1>
          <p className="text-text-muted mt-2">
            Bienvenido de nuevo. Aquí tienes el estado de los mercados mundiales.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all shrink-0',
            'border-secondary/30 text-secondary bg-secondary/10 hover:bg-secondary/20',
            refreshing && 'opacity-60 cursor-not-allowed'
          )}
        >
          <RefreshCw className={clsx('w-4 h-4', refreshing && 'animate-spin')} />
          {refreshing ? 'Actualizando…' : 'Actualizar'}
        </button>
      </header>

      {/* Index overview cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {indices.length === 0
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={`skel-${i}`} className="glass-panel p-5 animate-pulse">
                <div className="h-4 bg-surface-hover rounded w-1/2 mb-4" />
                <div className="h-8 bg-surface-hover rounded w-1/3 mb-4" />
                <div className="h-4 bg-surface-hover rounded w-1/4" />
              </div>
            ))
          : indices.map((idx, i) => (
              <motion.div
                key={idx.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass-panel p-5 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Globe className="w-16 h-16" />
                </div>
                <h3 className="text-sm font-medium text-text-muted">{idx.name}</h3>
                <div className="mt-2">
                  <span className="text-2xl font-semibold tracking-tight">
                    {idx.count}
                  </span>
                  <span className="text-sm text-text-muted ml-1">activos</span>
                </div>
              </motion.div>
            ))}
      </section>

      {/* Category browse (chips + expandable list) */}
      <CategoryBrowse
        indices={indices}
        activeCategoryId={activeCategoryId}
        assets={browseAssets}
        loading={browseLoading}
        onSelectCategory={handleSelectCategory}
        onSelectAsset={handleSelectAsset}
      />

      {/* Top Movers + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 glass-panel p-6 min-h-[400px] flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Top Movers en Tiempo Real</h2>
            {connected && (
              <span className="text-xs bg-success-bg text-success px-2 py-1 rounded-full border border-success/20 animate-pulse">
                LIVE
              </span>
            )}
          </div>

          <div className="flex-1 rounded-lg border border-[var(--color-border)] bg-surface/50 overflow-hidden">
            {Object.keys(prices).length > 0 ? (
              <div className="w-full h-full p-4 overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-text-muted border-b border-[var(--color-border)]">
                    <tr>
                      <th className="pb-3 font-medium">Activo</th>
                      <th className="pb-3 font-medium text-right">Precio</th>
                      <th className="pb-3 font-medium text-right">24h %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(prices)
                      .slice(0, 8)
                      .map(([ticker, data]: any) => (
                        <tr
                          key={ticker}
                          onClick={() =>
                            handleSelectAsset({
                              ticker,
                              name: data.name,
                              price: data.price,
                              change: data.change_1d,
                            })
                          }
                          className="border-b border-[var(--color-border)]/50 last:border-0 cursor-pointer hover:bg-secondary/5 transition-colors"
                        >
                          <td className="py-3">
                            <span className="font-mono font-bold text-secondary">{ticker}</span>
                            <span className="text-text-muted text-xs ml-2">{data.name}</span>
                          </td>
                          <td className="py-3 text-right font-mono">
                            ${data.price?.toFixed(2)}
                          </td>
                          <td
                            className={clsx(
                              'py-3 text-right font-mono font-medium',
                              data.change_1d >= 0 ? 'text-success' : 'text-danger'
                            )}
                          >
                            {data.change_1d > 0 ? '+' : ''}
                            {data.change_1d?.toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="w-full h-full p-4">
                <div className="flex justify-between border-b border-[var(--color-border)] pb-3 mb-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-16 h-4 bg-surface-hover rounded animate-pulse" />
                  ))}
                </div>
                <div className="space-y-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex justify-between animate-pulse">
                      <div className="w-1/3 h-5 bg-surface-hover rounded" />
                      <div className="w-1/4 h-5 bg-surface-hover rounded" />
                      <div className="w-1/6 h-5 bg-surface-hover rounded" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="glass-panel p-6">
          <h2 className="text-lg font-semibold mb-6">Últimas Alertas</h2>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-surface-hover border border-[var(--color-border)]">
              <div className="flex justify-between items-start">
                <h4 className="font-medium text-sm">AAPL - Cruce MACD</h4>
                <span className="text-xs text-text-muted">hace 10m</span>
              </div>
              <p className="text-sm text-text-muted mt-1">
                El MACD ha cruzado la señal al alza en gráfico diario.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-surface-hover border border-[var(--color-border)]">
              <div className="flex justify-between items-start">
                <h4 className="font-medium text-sm">BTC-USD - Volumen Inusual</h4>
                <span className="text-xs text-text-muted">hace 1h</span>
              </div>
              <p className="text-sm text-text-muted mt-1">
                Volumen +150% sobre la media de 20 periodos.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Asset quick modal */}
      <AssetQuickModal asset={modalAsset} onClose={handleCloseModal} />
    </div>
  );
}
