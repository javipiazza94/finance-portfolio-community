'use client';

import { useEffect, useState } from 'react';
import { Newspaper, AlertCircle } from 'lucide-react';
import { fetchNews } from '@/lib/api';
import NewsCard from './NewsCard';

const INITIAL_VISIBLE = 6;

function NewsSkeleton() {
  return (
    <div className="bg-surface-hover rounded-xl overflow-hidden border border-[var(--color-border)] h-full flex flex-col animate-pulse">
      <div className="h-32 w-full bg-surface" />
      <div className="p-4 flex-1 flex flex-col gap-2">
        <div className="h-3 w-16 bg-surface rounded" />
        <div className="h-4 w-full bg-surface rounded" />
        <div className="h-4 w-3/4 bg-surface rounded" />
        <div className="h-3 w-20 bg-surface rounded mt-auto" />
      </div>
    </div>
  );
}

export default function NewsSection({ ticker }: { ticker: string }) {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const load = () => {
    setLoading(true);
    setError(false);
    fetchNews(ticker)
      .then((data) => {
        setNews(Array.isArray(data) ? data : []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [ticker]);

  const visible = expanded ? news : news.slice(0, INITIAL_VISIBLE);

  return (
    <section className="lg:col-span-3 glass-panel p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-primary" />
          Últimas Noticias
        </h2>
        {!loading && !error && news.length > INITIAL_VISIBLE && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-text-muted hover:text-primary transition-colors"
          >
            {expanded ? 'Ver menos' : `Ver más (${news.length - INITIAL_VISIBLE} más)`}
          </button>
        )}
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => <NewsSkeleton key={i} />)}
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-10 text-text-muted gap-3">
          <AlertCircle className="w-8 h-8 opacity-50" />
          <p className="text-sm">No se pudieron cargar las noticias.</p>
          <button
            onClick={load}
            className="text-xs text-primary hover:underline"
          >
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && news.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-text-muted gap-3">
          <Newspaper className="w-8 h-8 opacity-50" />
          <p className="text-sm">No hay noticias recientes para este activo.</p>
        </div>
      )}

      {!loading && !error && news.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visible.map((item, i) => (
            <NewsCard
              key={i}
              title={item.title}
              url={item.url}
              source={item.source}
              published_at={item.published_at}
              image_url={item.image_url}
            />
          ))}
        </div>
      )}
    </section>
  );
}
