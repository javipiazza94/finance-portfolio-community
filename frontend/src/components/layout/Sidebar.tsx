'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  LineChart,
  Briefcase,
  PieChart,
  ShieldCheck,
  BellRing
} from 'lucide-react';
import { clsx } from 'clsx';
import { Logo } from './Logo';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/market', label: 'Market Explorer', icon: LineChart },
  { href: '/portfolio', label: 'Mi Portfolio', icon: Briefcase },
  { href: '/models', label: 'Carteras Modelo', icon: PieChart },
  { href: '/profile', label: 'Test MiFID', icon: ShieldCheck },
  { href: '/alerts', label: 'Alertas', icon: BellRing },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col z-20">
      <div className="p-6">
        <Logo size={28} withWordmark />
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 font-medium",
                isActive 
                  ? "bg-primary/10 text-primary border border-primary/20" 
                  : "text-text-muted hover:text-text-main hover:bg-surface-hover border border-transparent"
              )}
            >
              <Icon className={clsx("w-5 h-5", isActive ? "text-primary" : "opacity-70")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-6 border-t border-[var(--color-border)]">
        <div className="glass-panel p-4 text-sm">
          <p className="text-text-muted">Estado del Sistema</p>
          <div className="flex items-center gap-2 mt-2 text-success">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
            Conectado (SSE)
          </div>
        </div>
      </div>
    </aside>
  );
}
