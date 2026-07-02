interface LogoProps {
  size?: number;
  withWordmark?: boolean;
}

export function Logo({ size = 28, withWordmark = false }: LogoProps) {
  return (
    <div className="flex items-center gap-2">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect x="1" y="1" width="30" height="30" rx="7" fill="#10151d" stroke="#e6b345" strokeWidth="1.5" />
        <line x1="9" y1="20" x2="9" y2="24" stroke="#e6b345" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="7.5" y="16" width="3" height="4" rx="0.5" fill="#e6b345" />
        <line x1="16" y1="14" x2="16" y2="20" stroke="#e6b345" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="14.5" y="10" width="3" height="4" rx="0.5" fill="#e6b345" />
        <line x1="23" y1="8" x2="23" y2="14" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="21.5" y="6" width="3" height="4" rx="0.5" fill="#22c55e" />
      </svg>
      {withWordmark && (
        <span className="text-xl font-bold tracking-wide whitespace-nowrap">
          <span className="text-text-main">Finance</span>{' '}
          <span className="text-primary">Portfolio</span>
        </span>
      )}
    </div>
  );
}
