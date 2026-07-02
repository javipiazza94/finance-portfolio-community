'use client';
import { useEffect, useState } from 'react';
import { X, ExternalLink, Sparkles, WifiOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { fetchIndicators, fetchAiSummary } from '@/lib/api';
import { clsx } from 'clsx';

export interface ModalAsset {
  ticker: string;
  name: string;
  price: number;
  change: number;
}

interface Indicators {
  rsi: number | null;
  signal_type: string | null;
  macd: number | null;
  ma50: number | null;
}

interface AssetQuickModalProps {
  asset: ModalAsset | null;
  onClose: () => void;
}

const SIGNAL_LABEL: Record<string, string> = {
  golden_cross: 'Golden ✕',
  death_cross: 'Death ✕',
  overbought: 'Sobrecompra',
  oversold: 'Sobreventa',
  breakout_up: 'Ruptura ↑',
  breakout_down: 'Ruptura ↓',
};

const SIGNAL_COLOR: Record<string, string> = {
  golden_cross: 'text-success',
  breakout_up: 'text-success',
  oversold: 'text-success',
  death_cross: 'text-danger',
  breakout_down: 'text-danger',
  overbought: 'text-danger',
};

function StatCell({
  label,
  value,
  loading,
  className,
}: {
  label: string;
  value: string | null;
  loading: boolean;
  className?: string;
}) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3">
      <div className="text-xs text-text-muted uppercase tracking-wide mb-1">{label}</div>
      {loading ? (
        <div className="h-4 bg-surface-hover rounded animate-pulse w-12" />
      ) : (
        <div className={clsx('font-mono text-sm font-semibold', className ?? 'text-text-main')}>
          {value ?? '—'}
        </div>
      )}
    </div>
  );
}

export function AssetQuickModal({ asset, onClose }: AssetQuickModalProps) {
  const router = useRouter();
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [loadingIndicators, setLoadingIndicators] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiOffline, setAiOffline] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);

  useEffect(() => {
    if (!asset) {
      setIndicators(null);
      setAiSummary(null);
      setAiOffline(false);
      return;
    }
    setLoadingIndicators(true);
    setLoadingAi(true);
    setAiSummary(null);
    setAiOffline(false);

    fetchIndicators(asset.ticker)
      .then((data: any) =>
        setIndicators({
          rsi: data?.rsi ?? null,
          signal_type: data?.signal_type ?? null,
          macd: data?.macd ?? null,
          ma50: data?.ma50 ?? null,
        })
      )
      .catch(() => setIndicators(null))
      .finally(() => setLoadingIndicators(false));

    fetchAiSummary(asset.ticker)
      .then((data: any) => setAiSummary(data?.analysis ?? null))
      .catch((err: any) => {
        const status = err?.response?.status;
        if (status === 503 || status === 504) {
          setAiOffline(true);
        } else {
          setAiSummary(null);
        }
      })
      .finally(() => setLoadingAi(false));
  }, [asset?.ticker]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!asset) return null;

  const isPositive = asset.change >= 0;
  const signalType = indicators?.signal_type ?? null;

  return (
    <div
      className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="glass-panel p-6 w-full max-w-sm animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className="font-mono text-xl font-bold text-secondary">{asset.ticker}</span>
            <p className="text-xs text-text-muted mt-0.5 truncate max-w-[220px]">{asset.name}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-main transition-colors ml-2 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Price */}
        <div className="mb-5">
          <div className="text-2xl font-mono font-bold">
            ${asset.price?.toFixed(2) ?? '—'}
          </div>
          <div className={clsx('text-sm font-mono mt-0.5', isPositive ? 'text-success' : 'text-danger')}>
            {isPositive ? '▲' : '▼'} {Math.abs(asset.change).toFixed(2)}% hoy
          </div>
        </div>

        {/* Indicators */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <StatCell
            label="RSI 14"
            value={indicators?.rsi?.toFixed(1) ?? null}
            loading={loadingIndicators}
          />
          <StatCell
            label="Señal"
            value={signalType ? (SIGNAL_LABEL[signalType] ?? signalType) : null}
            loading={loadingIndicators}
            className={signalType ? (SIGNAL_COLOR[signalType] ?? 'text-text-muted') : 'text-text-muted'}
          />
          <StatCell
            label="MACD"
            value={indicators?.macd?.toFixed(3) ?? null}
            loading={loadingIndicators}
          />
          <StatCell
            label="MA 50"
            value={indicators?.ma50?.toFixed(2) ?? null}
            loading={loadingIndicators}
          />
        </div>

        {/* AI Analysis */}
        <div className="mb-5">
          <div className="flex items-center gap-1.5 text-xs text-text-muted uppercase tracking-wide mb-2">
            <Sparkles className="w-3 h-3 text-secondary" />
            Análisis IA
          </div>
          {loadingAi ? (
            <div className="space-y-2">
              <div className="h-3 bg-surface-hover rounded animate-pulse w-full" />
              <div className="h-3 bg-surface-hover rounded animate-pulse w-5/6" />
              <div className="h-3 bg-surface-hover rounded animate-pulse w-4/6" />
            </div>
          ) : aiOffline ? (
            <div className="flex items-center gap-2 text-xs text-text-muted bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2">
              <WifiOff className="w-3.5 h-3.5 shrink-0" />
              LM Studio no disponible
            </div>
          ) : aiSummary ? (
            <p className="text-xs text-text-muted leading-relaxed bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2">
              {aiSummary}
            </p>
          ) : null}
        </div>

        <hr className="border-[var(--color-border)] mb-5" />

        {/* CTA */}
        <button
          onClick={() => router.push(`/market/${asset.ticker}`)}
          className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 bg-secondary text-background hover:opacity-90 transition-opacity"
        >
          Ver detalle completo
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
