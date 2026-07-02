import { Newspaper } from 'lucide-react';

interface NewsCardProps {
  title: string;
  url: string;
  source: string;
  published_at: string;
  image_url?: string;
}

export default function NewsCard({ title, url, source, published_at, image_url }: NewsCardProps) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block group">
      <div className="bg-surface-hover rounded-xl overflow-hidden border border-[var(--color-border)] group-hover:border-primary/50 transition-colors h-full flex flex-col">
        <div className="h-32 w-full overflow-hidden bg-surface flex items-center justify-center shrink-0">
          {image_url ? (
            <img
              src={image_url}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <Newspaper className="w-8 h-8 text-text-muted opacity-30" />
          )}
        </div>
        <div className="p-4 flex-1 flex flex-col">
          <p className="text-xs text-primary font-medium mb-2">{source}</p>
          <h3 className="font-bold text-sm leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-3">
            {title}
          </h3>
          <p className="text-xs text-text-muted mt-auto">
            {published_at ? new Date(published_at).toLocaleDateString() : ''}
          </p>
        </div>
      </div>
    </a>
  );
}
