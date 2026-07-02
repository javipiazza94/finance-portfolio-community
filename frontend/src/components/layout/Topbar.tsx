import { Search, User } from 'lucide-react';

export function Topbar() {
  return (
    <header className="h-20 border-b border-[var(--color-border)] bg-[var(--color-surface-glass)] backdrop-blur-md sticky top-0 z-10 flex items-center justify-between px-8">
      <div className="flex-1 max-w-xl">
        <div className="relative group">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary transition-colors" />
          <input 
            type="text" 
            placeholder="Buscar S&P 500, DAX, Crypto, ETFs..." 
            className="w-full bg-surface-hover/50 border border-[var(--color-border)] focus:border-primary/50 focus:ring-1 focus:ring-primary/50 rounded-full py-2.5 pl-12 pr-4 text-sm outline-none transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="glass-button p-2 rounded-full">
          <User className="w-5 h-5 text-text-main" />
        </button>
      </div>
    </header>
  );
}
