import Link from "next/link";
import type { ReactNode } from "react";
import { BatteryCharging, Car, Check, Footprints, Rotate3d } from "lucide-react";
import { Rings } from "./ExpoMark";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { SiteDictionary } from "@/lib/site-i18n";
import { BOOTHS, STATS, TIER_ORDER, TIER_SPEC } from "@/lib/site";
import { TIER_COLOR } from "@/lib/venue";

export function SectionHead({ kicker, title, body, center }: { kicker: string; title: string; body?: string; center?: boolean }) {
  return (
    <div className={`section-head${center ? " section-head--center" : ""}`}>
      <span className="kicker">{kicker}</span>
      <h2>{title}</h2>
      {body && <p className="lead">{body}</p>}
    </div>
  );
}

/** Inner-page hero in the LED-wall style. */
export function PageHero({ kicker, title, body, children }: { kicker: string; title: string; body: string; children?: ReactNode }) {
  return (
    <section className="page-hero">
      <Rings className="page-hero__rings" />
      <div className="container page-hero__body">
        <span className="chip">{kicker}</span>
        <h1>{title}</h1>
        <p>{body}</p>
        {children && <div className="hero__ctas">{children}</div>}
      </div>
    </section>
  );
}

export function StatsStrip({ s }: { s: SiteDictionary }) {
  const items = [
    { v: String(STATS.days), l: s.stats.days },
    { v: String(STATS.pavilions), l: s.stats.pavilions },
    { v: String(STATS.banks), l: s.stats.banks },
    { v: String(STATS.chargers), l: s.stats.chargers },
    { v: String(STATS.seats), l: s.stats.seats },
    { v: `≈ ${STATS.area.toLocaleString("en-US")} m²`, l: s.stats.area },
  ];
  return (
    <section className="container" aria-label={s.home.statsLabel}>
      <dl className="stats">
        {items.map((it) => (
          <div key={it.l} className="stat">
            <dt>{it.l}</dt>
            <dd dir="ltr">{it.v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function TierCards({ lang, s, link }: { lang: Locale; s: SiteDictionary; link?: boolean }) {
  return (
    <div className="tiers">
      {TIER_ORDER.map((tier) => {
        const T = s.tiers[tier];
        const spots = BOOTHS.filter((b) => b.tier === tier);
        return (
          <article key={tier} className={`tier tier--${tier}`} style={{ ["--c" as string]: TIER_COLOR[tier] }}>
            <header>
              <span className="tier__name">{T.name}</span>
              <span className="tier__spots"><b dir="ltr">{spots.length}</b> {s.tiers.spots}</span>
            </header>
            <p className="tier__tagline">{T.tagline}</p>
            <ul>
              {T.points.map((p) => <li key={p}><Check size={16} aria-hidden="true" />{p}</li>)}
              <li><Car size={16} aria-hidden="true" />{s.tiers.cars}</li>
              <li><BatteryCharging size={16} aria-hidden="true" />{TIER_SPEC[tier].chargers[lang]}</li>
            </ul>
            <div className="tier__foot">
              <span className="tier__tags" dir="ltr">{spots.map((b) => b.tag).join(" · ")}</span>
              <span className="tier__price">{s.tiers.price}</span>
            </div>
            {link && <Link href={`/${lang}/booths#enquiry`} className="tier__link">{s.cta.book}</Link>}
          </article>
        );
      })}
    </div>
  );
}

export function JourneySteps({ lang, t, s }: { lang: Locale; t: Dictionary; s: SiteDictionary }) {
  return (
    <>
      <ol className="journey">
        {t.ev.journey.steps.map((step, i) => (
          <li key={step.id}>
            <span className="journey__n" dir="ltr">{String(i + 1).padStart(2, "0")}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
            <Link href={`/${lang}/ev?zone=${step.id}`} className="journey__link"><Rotate3d size={14} aria-hidden="true" />{s.cta.viewIn3d}</Link>
          </li>
        ))}
      </ol>
      <div className="center-cta">
        <Link href={`/${lang}/ev?tour=1`} className="btn btn-primary"><Footprints size={18} aria-hidden="true" />{s.cta.journey}</Link>
      </div>
    </>
  );
}
