// WellerTracker wordmark with the oil-well map symbol: an open circle (permitted location) beside a
// filled one (drilled well), as on a well-spot map.
export function WellMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
      <circle cx="6" cy="9" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="13.5" cy="9" r="3.6" fill="#2b6cb0" />
    </svg>
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-condensed text-lg font-bold leading-none tracking-tight text-slate-50 ${className}`}>
      <WellMark />
      <span>
        Weller<span className="text-steel">Tracker</span>
      </span>
    </span>
  );
}
