/** EV edition mark: a charging plug with a bolt. */
export function EvMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect x="1.5" y="1.5" width="45" height="45" rx="13" fill="#071219" stroke="#22E0C8" strokeWidth="2" />
      <path d="M18 9v7M30 9v7" stroke="#22E0C8" strokeWidth="3" strokeLinecap="round" />
      <path d="M13 16h22v6a11 11 0 0 1-22 0z" fill="none" stroke="#22E0C8" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M25.5 19.5 20 28h4.2l-1.7 7.5 6-9.5h-4.3z" fill="#B6F23A" />
      <path d="M24 33v6" stroke="#22E0C8" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
