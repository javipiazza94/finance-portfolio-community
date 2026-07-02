'use client';
import { Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

interface BrowseAsset {
  ticker: string;
  name: string;
  price: number;
  change_1d: number;
}

interface Index {
  id: string;
  name: string;
  count: number;
}

interface ModalAsset {
  ticker: string;
  name: string;
  price: number;
  change: number;
}

interface CategoryBrowseProps {
  indices: Index[];
  activeCategoryId: string | null;
  assets: BrowseAsset[];
  loading: boolean;
  onSelectCategory: (id: string) => void;
  onSelectAsset: (asset: ModalAsset) => void;
}

export function CategoryBrowse({
  indices,
  activeCategoryId,
  assets,
  loading,
  onSelectCategory,
  onSelectAsset,
}: CategoryBrowseProps) {
  if (indices.length === 0) return null;

  return (
    <section className="space-y-3">
      {/* Chip strip */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-text-muted uppercase tracking-wide mr-1">Explorar</span>
        {indices.map(idx => (
          <button
            key={idx.id}
            onClick={() => onSelectCategory(idx.id)}
            className={clsx(
              'px-3 py-1.5 text-xs font-medium rounded-lg border transition-all',
              activeCategoryId === idx.id
                ? 'border-secondary text-secondary bg-secondary/10'
                : 'border-[var(--color-border)] text-text-muted hover:border-secondary/50 hover:text-secondary'
            )}
          >
            {idx.name}
          </button>
        ))}
      </div>

      {/* Inline expandable list */}
      {activeCategoryId && (
        <div className="glass-panel p-4 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-secondary">
              {indices.find(i => i.id === activeCategoryId)?.name}
            </h3>
            <span className="text-xs text-text-muted">
              {loading ? '…' : `${assets.length} activos · click para detalle`}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-secondary" />
            </div>
          ) : (
            <div className="overflow-y-auto max-h-80 divide-y divide-[var(--color-border)]">
              {assets.map(asset => (
                <button
                  key={asset.ticker}
                  onClick={() =>
                    onSelectAsset({
                      ticker: asset.ticker,
                      name: asset.name,
                      price: asset.price,
                      change: asset.change_1d,
                    })
                  }
                  className="w-full flex items-center justify-between py-2.5 px-1 hover:bg-secondary/5 transition-colors text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-secondary w-16 text-left shrink-0">
                      {asset.ticker}
                    </span>
                    <span className="text-text-muted text-xs truncate max-w-[180px]">
                      {asset.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="font-mono text-text-main">
                      ${asset.price?.toFixed(2) ?? '—'}
                    </span>
                    <span
                      className={clsx(
                        'font-mono text-xs w-14 text-right',
                        asset.change_1d >= 0 ? 'text-success' : 'text-danger'
                      )}
                    >
                      {asset.change_1d > 0 ? '+' : ''}
                      {asset.change_1d?.toFixed(2)}%
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
