import React, { useState } from 'react';
import { Activity, BrainCircuit } from 'lucide-react';
import RecommendationGauge from './RecommendationGauge';
import PillarScores from './PillarScores';
import BullBearCase from './BullBearCase';
import { fetchCompanyAnalysis } from '@/lib/api';

interface KeyStat {
  label: string;
  value: string;
  note: string;
}

interface CompanyScorecardProps {
  ticker: string;
}

export default function CompanyScorecard({ ticker }: CompanyScorecardProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateAnalysis = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchCompanyAnalysis(ticker);
      setData(response);
    } catch (err: any) {
      setError(err?.message || 'Error generating analysis');
    } finally {
      setLoading(false);
    }
  };

  if (!data && !loading && !error) {
    return (
      <div className="glass-panel p-6 flex flex-col items-center justify-center min-h-[300px] text-center">
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4 border border-primary/30">
          <BrainCircuit className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold mb-2">AI Company Analysis</h2>
        <p className="text-text-muted mb-6 max-w-md">
          Generate a comprehensive fundamental and technical scorecard for {ticker} using our Local AI model.
        </p>
        <button
          onClick={generateAnalysis}
          className="bg-primary hover:bg-primary-hover text-background px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
        >
          <BrainCircuit className="w-5 h-5" />
          Generate Scorecard
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="glass-panel p-6 flex flex-col items-center justify-center min-h-[300px] text-center animate-pulse">
        <Activity className="w-10 h-10 text-primary animate-spin mb-4" />
        <h3 className="text-lg font-bold">Analyzing {ticker}...</h3>
        <p className="text-text-muted mt-2">Connecting to local AI model. This may take a few seconds.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel p-6 flex flex-col items-center justify-center min-h-[300px] text-center border-danger/30">
        <div className="text-danger mb-4">Error: {error}</div>
        <button
          onClick={generateAnalysis}
          className="bg-surface hover:bg-surface-hover border border-[var(--color-border)] px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const keyStats: KeyStat[] = Array.isArray(data.key_stats) ? data.key_stats : [];
  const score = typeof data.score === 'number' ? data.score : 50;

  return (
    <div className="glass-panel p-6 space-y-6 animate-fade-in">

      {/* Header: title + overall score */}
      <div className="flex items-start justify-between border-b border-[var(--color-border)] pb-5">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BrainCircuit className="w-6 h-6 text-primary" />
            AI Scorecard
          </h2>
          {data.thesis && (
            <p className="text-text-muted mt-1 text-sm italic max-w-2xl">"{data.thesis}"</p>
          )}
        </div>
        <div className="text-right shrink-0 ml-6">
          <div className="font-mono text-4xl font-black text-text-gold">
            {score.toFixed(1)}<span className="text-lg text-text-muted">/100</span>
          </div>
          <p className="label-terminal mt-1">Overall Score</p>
        </div>
      </div>

      {/* Recommendation gauge */}
      <section>
        <h3 className="text-xs uppercase text-text-muted font-bold tracking-wider mb-3">Recommendation</h3>
        <RecommendationGauge
          score={score}
          recommendation={data.recommendation || 'N/A'}
          color={data.gauge_color || 'yellow'}
        />
      </section>

      {/* Pillar scores */}
      <section className="border-t border-[var(--color-border)] pt-5">
        <h3 className="text-xs uppercase text-text-muted font-bold tracking-wider mb-4">Pillar Scores</h3>
        <PillarScores pillars={data.pillars || { quality: 0, growth: 0, dividend: 0, valuation: 0, risk: 0 }} />
      </section>

      {/* Key stats */}
      {keyStats.length > 0 && (
        <section className="border-t border-[var(--color-border)] pt-5">
          <h3 className="text-xs uppercase text-text-muted font-bold tracking-wider mb-4">Key Stats</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {keyStats.map((stat, idx) => (
              <div
                key={idx}
                className="bg-surface-hover border border-[var(--color-border)] rounded-xl p-4"
              >
                <p className="label-terminal mb-1 truncate">
                  {stat.label}
                </p>
                <p className="text-lg font-mono font-bold text-text-main leading-tight">
                  {stat.value}
                </p>
                {stat.note && (
                  <p className="text-xs text-text-muted mt-1">{stat.note}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Bull / Bear case */}
      <section className="border-t border-[var(--color-border)] pt-5">
        <BullBearCase bullCase={data.bull_case || []} bearCase={data.bear_case || []} />
      </section>

    </div>
  );
}
