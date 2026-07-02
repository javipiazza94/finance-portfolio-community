'use client';

import { useEffect, useState } from 'react';
import { fetchModelOverview } from '@/lib/api';
import { PieChart, TrendingUp, ShieldCheck, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

export default function ModelPortfoliosPage() {
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchModelOverview()
      .then(data => {
        setModels(data);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Carteras Modelo</h1>
          <p className="text-text-muted mt-2">Explora estrategias de inversión predefinidas, desde Bogleheads hasta carteras de dividendos.</p>
        </div>
        <button className="glass-button px-6 py-2.5 text-primary hover:text-white border-primary/50 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Comparar Carteras
        </button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-text-muted">
          <Activity className="w-6 h-6 animate-spin mr-2" /> Cargando modelos...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {models.map((model, i) => (
            <motion.div
              key={model.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-panel p-6 hover:border-primary/50 transition-colors group relative overflow-hidden"
            >
              <div 
                className="absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl -mr-8 -mt-8 opacity-20 transition-opacity group-hover:opacity-40"
                style={{ backgroundColor: model.color || 'var(--color-primary)' }}
              />
              
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 rounded-lg bg-surface-hover">
                  {model.category === 'classic' ? <ShieldCheck className="w-6 h-6 text-secondary" /> : <PieChart className="w-6 h-6 text-primary" />}
                </div>
                <span className="text-xs font-mono px-2 py-1 bg-surface-hover rounded text-text-muted border border-[var(--color-border)]">
                  {model.source}
                </span>
              </div>
              
              <h3 className="text-xl font-bold mb-2">{model.name}</h3>
              <p className="text-sm text-text-muted line-clamp-2 mb-6 h-10">{model.description}</p>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--color-border)]">
                <div>
                  <p className="text-xs text-text-muted uppercase mb-1">Retorno Esp.</p>
                  <p className="font-mono font-semibold text-success">
                    {((model.cagr || 0) * 100).toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted uppercase mb-1">Riesgo (Max DD)</p>
                  <p className="font-mono font-semibold text-danger">
                    {((model.max_drawdown || 0) * 100).toFixed(2)}%
                  </p>
                </div>
              </div>

              <Link 
                href={`/models/${model.id}`}
                className="w-full mt-6 bg-surface-hover hover:bg-primary/20 text-text-main hover:text-primary transition-colors py-2 rounded-lg text-sm font-medium border border-[var(--color-border)] flex items-center justify-center"
              >
                Ver Composición y NAV
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
