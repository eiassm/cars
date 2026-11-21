"use client";

import { useEffect, useState } from "react";
import { MicVocal } from "lucide-react";
import { EXPO_CLOSES, EXPO_DAYS, EXPO_OPENS } from "@/lib/expo";
import type { Dictionary } from "@/lib/i18n";

/** 1 May 2027 is a Saturday (weekday index 6). */
const FIRST_WEEKDAY = 6;

export function Programme({ t }: { t: Dictionary }) {
  const [day, setDay] = useState(0);

  // During the expo week, open on today's tab.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const now = Date.now();
      if (now >= EXPO_OPENS && now < EXPO_CLOSES) setDay(Math.min(EXPO_DAYS - 1, Math.floor((now - EXPO_OPENS) / 864e5)));
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const p = t.program;
  const weekday = (i: number) => t.weekdays[(FIRST_WEEKDAY + i) % 7];
  const slots = [
    day === 0 ? p.opening : p.slot,
    p.slot,
    day === EXPO_DAYS - 1 ? p.closing : p.slot,
  ];

  return (
    <>
      <div role="tablist" aria-label={p.kicker} className="days">
        {Array.from({ length: EXPO_DAYS }, (_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            id={`day-tab-${i}`}
            aria-selected={day === i}
            aria-controls="day-panel"
            className="day-tab"
            onClick={() => setDay(i)}
          >
            <span className="day-tab__wd">{weekday(i)}</span>
            <span className="day-tab__date">{i + 1} {t.month}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" id="day-panel" aria-labelledby={`day-tab-${day}`} className="day-panel">
        <div className="day-panel__head">
          <h3>{p.dayTitles[day]}</h3>
          <span>{weekday(day)} {day + 1} {t.month} 2027</span>
        </div>
        {slots.map((title, i) => (
          <div key={i} className="slot">
            <span className="slot__time" dir="ltr">{p.time}</span>
            <span className="slot__title">{title}</span>
            <span className="slot__where"><MicVocal size={14} aria-hidden="true" />{p.stage}</span>
          </div>
        ))}
      </div>
    </>
  );
}
