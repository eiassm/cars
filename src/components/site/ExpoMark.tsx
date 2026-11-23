/**
 * The expo mark, taken from the stage LED wall: a lime charging bolt inside concentric teal rings.
 * `tile` draws it on its own dark rounded square (app icon, small sizes).
 */
export function ExpoMark({ className, tile = false, title }: { className?: string; tile?: boolean; title?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title} style={{ direction: "ltr" }}>
      {tile && (
        <>
          <defs>
            <linearGradient id="expo-tile" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#03121A" />
              <stop offset="0.6" stopColor="#062A33" />
              <stop offset="1" stopColor="#0B3B2A" />
            </linearGradient>
          </defs>
          <rect width="120" height="120" rx="30" fill="url(#expo-tile)" />
        </>
      )}
      <g fill="none" stroke="#22E0C8" strokeWidth="3">
        <circle cx="60" cy="60" r="54" strokeOpacity="0.28" />
        <circle cx="60" cy="60" r="44" strokeOpacity="0.5" />
        <circle cx="60" cy="60" r="34" strokeOpacity="0.85" />
      </g>
      <path d="M66.8 24.9 42.5 65.4H60l-8.1 32.4 28.4-45.9H62.7z" fill="#B6F23A" />
    </svg>
  );
}

/** Mark + bilingual wordmark, as used in the site header and footer. */
export function ExpoLogo({ lang, className }: { lang: "ar" | "en"; className?: string }) {
  return (
    <span className={`expo-logo ${className ?? ""}`}>
      <ExpoMark className="expo-logo__mark" />
      <span className="expo-logo__text">
        {lang === "ar" ? (
          <>
            <span className="expo-logo__main">أسبوع فلسطين للسيارات <b dir="ltr">2027</b></span>
            <span className="expo-logo__sub">السيارات الكهربائية والهجينة</span>
          </>
        ) : (
          <>
            <span className="expo-logo__main">PALESTINE CARS WEEK <b>2027</b></span>
            <span className="expo-logo__sub">Electric &amp; Plug-in Hybrid</span>
          </>
        )}
      </span>
    </span>
  );
}

/** Decorative LED-wall rings with the bolt, for hero backgrounds. */
export function Rings({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 800 800" className={className} aria-hidden="true">
      <g fill="none" stroke="#22E0C8" strokeWidth="2">
        {Array.from({ length: 11 }, (_, i) => (
          <circle key={i} cx="400" cy="400" r={40 + i * 36} strokeOpacity={0.55 - i * 0.04} className="rings__ring" style={{ animationDelay: `${i * 0.18}s` }} />
        ))}
      </g>
      <path d="M425 270 335 420H400l-30 120 105-170H410z" fill="#B6F23A" className="rings__bolt" />
    </svg>
  );
}
