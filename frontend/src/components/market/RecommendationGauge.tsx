import React from 'react';
import { clsx } from 'clsx';

interface RecommendationGaugeProps {
  score: number;
  recommendation: string;
  color: 'red' | 'orange' | 'yellow' | 'green';
}

export default function RecommendationGauge({ score, recommendation, color }: RecommendationGaugeProps) {
  const percentage = Math.max(0, Math.min(100, score));
  
  const markerColor = {
    red: 'bg-danger',
    orange: 'bg-warning',
    yellow: 'bg-[var(--color-chart-6)]',
    green: 'bg-success'
  }[color];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-text-main">{recommendation}</span>
        <span className="font-mono text-text-muted">{score.toFixed(1)}/100</span>
      </div>

      {/* Gauge Bar */}
      <div className="relative h-3 w-full rounded-full bg-surface-hover border border-[var(--color-border)] overflow-hidden">
        {/* Background gradient from red to gold to green */}
        <div className="absolute inset-0 score-bar-gradient opacity-90" />

        {/* Marker */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-text-main shadow-lg z-10 transition-all duration-1000 ease-out"
          style={{ left: `${percentage}%`, transform: 'translateX(-50%)' }}
        >
          <div className="absolute -top-1 -bottom-1 left-1/2 -translate-x-1/2 w-3 rounded-full bg-text-main shadow-md border border-[var(--color-border)]" />
        </div>
      </div>

      <div className="flex justify-between mt-1">
        <span className="label-terminal text-danger">Avoid</span>
        <span className="label-terminal">Neutral</span>
        <span className="label-terminal text-success">Attractive</span>
      </div>
    </div>
  );
}
