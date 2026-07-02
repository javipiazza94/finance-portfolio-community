import React from 'react';
import { clsx } from 'clsx';

interface PillarScoresProps {
  pillars: {
    quality: number;
    growth: number;
    dividend: number;
    valuation: number;
    momentum?: number;
    risk?: number; // legacy field, ignored
  };
}

export default function PillarScores({ pillars }: PillarScoresProps) {
  const maxScore = 10;

  const items = [
    { label: 'Quality', value: pillars.quality || 0, color: 'bg-chart-1' },
    { label: 'Growth', value: pillars.growth || 0, color: 'bg-chart-2' },
    { label: 'Dividend', value: pillars.dividend || 0, color: 'bg-chart-3' },
    { label: 'Valuation', value: pillars.valuation || 0, color: 'bg-chart-4' },
    { label: 'Momentum', value: pillars.momentum ?? pillars.risk ?? 0, color: 'bg-chart-5' },
  ];

  return (
    <div className="space-y-4">
      {items.map((item, idx) => {
        const widthPercent = Math.max(0, Math.min(100, (item.value / maxScore) * 100));
        return (
          <div key={idx} className="flex items-center gap-4">
            <div className="w-24 text-sm font-medium text-text-muted truncate">
              {item.label}
            </div>
            <div className="flex-1 h-2 bg-surface-hover rounded-full overflow-hidden border border-[var(--color-border)]">
              <div
                className={clsx('h-full transition-all duration-1000', item.color)}
                style={{ width: `${widthPercent}%` }}
              />
            </div>
            <div className="w-6 text-right text-sm font-mono font-bold">
              {item.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}
