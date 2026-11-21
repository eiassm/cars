"use client";

import { useEffect, useState } from "react";
import { EXPO_CLOSES, EXPO_OPENS } from "@/lib/expo";
import type { Dictionary } from "@/lib/i18n";

const pad = (n: number) => String(n).padStart(2, "0");

export function Countdown({ t }: { t: Dictionary["countdown"] }) {
  // The clock only starts after hydration, so the server render and the first client render match.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => { window.clearTimeout(first); window.clearInterval(id); };
  }, []);

  if (now === null) return <div className="countdown" aria-hidden="true" />;
  if (now >= EXPO_CLOSES) return <div className="countdown"><span className="countdown__label">{t.over}</span></div>;
  if (now >= EXPO_OPENS) return <div className="countdown"><span className="countdown__label">{t.live}</span></div>;

  let s = Math.floor((EXPO_OPENS - now) / 1000);
  const days = Math.floor(s / 86400);
  s -= days * 86400;
  const hours = Math.floor(s / 3600);
  s -= hours * 3600;
  const minutes = Math.floor(s / 60);
  const seconds = s - minutes * 60;
  const values = [String(days), pad(hours), pad(minutes), pad(seconds)];

  return (
    <div className="countdown">
      <span className="countdown__label">{t.before}</span>
      <div className="countdown__cells" dir="ltr" role="timer" aria-label={`${days} ${t.units[0]} ${hours} ${t.units[1]}`}>
        {values.map((v, i) => (
          <div key={i} className="countdown__cell">
            <span className="countdown__value">{v}</span>
            <span className="countdown__unit">{t.units[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
