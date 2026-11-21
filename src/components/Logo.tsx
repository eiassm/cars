/** The gold "P 27" plate used as the expo mark. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 28 120 64" className={className} aria-hidden="true" style={{ direction: "ltr" }}>
      <rect x="6.25" y="29.25" width="107.5" height="61.5" rx="12" fill="none" stroke="#A8883A" strokeWidth="3" />
      <rect x="14" y="37" width="30" height="46" rx="6" fill="#A8883A" />
      <text x="29" y="69" textAnchor="middle" fontFamily="Montserrat, sans-serif" fontWeight="700" fontSize="25" fill="#0A0A0A">
        P
      </text>
      <text x="80" y="72" textAnchor="middle" fontFamily="Montserrat, sans-serif" fontWeight="600" fontSize="32" letterSpacing="-0.5" fill="#A8883A">
        27
      </text>
    </svg>
  );
}
