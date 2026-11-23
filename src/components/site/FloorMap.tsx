"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Rotate3d, X } from "lucide-react";
import type { Tier, Zone } from "@/lib/expo";
import type { Locale } from "@/lib/i18n";
import type { SiteDictionary } from "@/lib/site-i18n";
import { BOOTHS } from "@/lib/site";
import { BANK_COLOR, ENERGY_ROUTES, LOT_LOCAL, PLACES, TIER_COLOR, VILLAGE, ZONES_V2 } from "@/lib/venue";

export type MapFilter = "all" | Tier | "bank" | "svc";

const PROG = "#7C8CFF", SVC = "#8FA3B5", FOOD = "#F2994A";

const colorOf = (z: Zone) =>
  z.tier ? TIER_COLOR[z.tier] : z.group === "bank" ? BANK_COLOR : z.group === "prog" ? PROG : z.id === "food" ? FOOD : SVC;

const matches = (z: Zone, f: MapFilter) =>
  f === "all" ? true : f === "bank" ? z.group === "bank" : f === "svc" ? z.group === "svc" || z.group === "prog" : z.tier === f;

/** Sellable spaces show their status; services just describe themselves. */
const sellable = (z: Zone) => z.group === "booth" || z.group === "bank";

/** North in the layout frame (the yard is drawn aligned to the courts edge). */
const NORTH_DEG = 30.7;

export function FloorMap({
  lang, s, tiers, filters = ["all", "premium", "golden", "regular", "bank", "svc"], initial = "all", initialSel = null,
}: {
  lang: Locale;
  s: SiteDictionary["map"];
  tiers: SiteDictionary["tiers"];
  filters?: MapFilter[];
  initial?: MapFilter;
  initialSel?: string | null;
}) {
  const [filter, setFilter] = useState<MapFilter>(initial);
  const [sel, setSel] = useState<string | null>(initialSel);
  const zones = useMemo(() => ZONES_V2.filter((z) => PLACES[z.id]), []);
  const z = sel ? zones.find((x) => x.id === sel) ?? null : null;
  const booth = z ? BOOTHS.find((b) => b.id === z.id) : undefined;
  const lot = LOT_LOCAL.map((p) => p.join(",")).join(" ");
  const V = VILLAGE;

  const pick = (id: string) => setSel((cur) => (cur === id ? null : id));

  return (
    <div className="fmap">
      <div className="fmap__chips" role="group" aria-label={s.label}>
        {filters.map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f !== "all" && <i style={{ background: f === "bank" ? BANK_COLOR : f === "svc" ? SVC : TIER_COLOR[f] }} />}
            {s.filters[f]}
          </button>
        ))}
      </div>

      <div className="fmap__stage">
        <svg viewBox="-22 -6 92 75" className="fmap__svg" role="group" aria-label={s.label} style={{ direction: "ltr" }}>
          <defs>
            <marker id="fmap-arrow" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse">
              <path d="M0 0 6 3 0 6z" fill="#B6F23A" />
            </marker>
            <pattern id="fmap-grid" width="4" height="4" patternUnits="userSpaceOnUse">
              <path d="M4 0H0V4" fill="none" stroke="rgba(34,224,200,.07)" strokeWidth="0.12" />
            </pattern>
          </defs>

          {/* Sports Village context */}
          <g className="fmap__context">
            <rect x={V.basketball.border.x0} y={V.basketball.border.z0} width={V.basketball.border.x1 - V.basketball.border.x0} height={V.basketball.border.z1 - V.basketball.border.z0} rx="0.8" />
            <rect x={V.basketball.court.x - V.basketball.court.w / 2} y={V.basketball.court.z - V.basketball.court.d / 2} width={V.basketball.court.w} height={V.basketball.court.d} rx="0.4" />
            <rect x={V.padel.pad.x0} y={V.padel.pad.z0} width={V.padel.pad.x1 - V.padel.pad.x0} height={V.padel.pad.z1 - V.padel.pad.z0} rx="0.8" />
            <rect x={V.padel.court.x - V.padel.court.w / 2} y={V.padel.court.z - V.padel.court.d / 2} width={V.padel.court.w} height={V.padel.court.d} rx="0.4" />
            <text x={-8.5} y={24.5} textAnchor="end" className="fmap__ctx-label">{s.courts}</text>
          </g>

          <polygon points={lot} className="fmap__lot" />
          <polygon points={lot} fill="url(#fmap-grid)" />

          {/* visitor route */}
          {ENERGY_ROUTES.map((r, i) => (
            <polyline key={i} points={r.map((p) => p.join(",")).join(" ")} className="fmap__route" markerEnd="url(#fmap-arrow)" />
          ))}

          {zones.map((zone) => {
            const p = PLACES[zone.id];
            const on = matches(zone, filter);
            const active = sel === zone.id;
            const c = colorOf(zone);
            const label = zone.name[lang];
            return (
              <g
                key={zone.id}
                className={`fmap__zone${on ? "" : " is-dim"}${active ? " is-active" : ""}`}
                role="button"
                tabIndex={on ? 0 : -1}
                aria-label={label}
                aria-pressed={active}
                onClick={() => pick(zone.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(zone.id); } }}
              >
                <g transform={`translate(${p.x} ${p.z}) rotate(${p.rot})`}>
                  <rect x={-p.w / 2} y={-p.d / 2} width={p.w} height={p.d} rx="0.5" fill={c} fillOpacity={zone.group === "prog" || zone.group === "svc" ? 0.14 : 0.22} stroke={c} strokeWidth={active ? 0.6 : 0.3} />
                  {/* back wall */}
                  {(p.kind === "booth" || p.kind === "bank") && <line x1={-p.w / 2 + 0.3} y1={-p.d / 2 + 0.2} x2={p.w / 2 - 0.3} y2={-p.d / 2 + 0.2} stroke={c} strokeWidth="0.55" strokeLinecap="round" />}
                </g>
                <text x={p.x} y={p.z + 0.1} textAnchor="middle" dominantBaseline="middle" className="fmap__tag" style={{ fontSize: p.kind === "bank" ? 1.4 : 2 }} fill={zone.group === "booth" || zone.group === "bank" ? c : "#dfe9ec"}>
                  {zone.tag}
                </text>
              </g>
            );
          })}

          {/* entrance arrow, from the loop road */}
          <g className="fmap__entrance">
            <line x1="67" y1="45.5" x2="61.5" y2="45.5" markerEnd="url(#fmap-arrow)" />
            <text x="64.5" y="43.3" textAnchor="middle">{s.entrance}</text>
          </g>

          {/* north */}
          <g transform={`translate(60 -1.5) rotate(${NORTH_DEG})`} className="fmap__north">
            <circle r="2.6" />
            <path d="M0 -2 1.1 1.2 0 0.5 -1.1 1.2z" />
          </g>
          <text x="60" y="3.7" textAnchor="middle" className="fmap__north-label">{s.north}</text>
        </svg>

        <div className="fmap__legend" aria-hidden="true">
          <span><i className="fmap__legend-route" />{s.route}</span>
        </div>
      </div>

      <div className="fmap__panel" aria-live="polite">
        {z ? (
          <div className="fmap__card" style={{ ["--c" as string]: colorOf(z) }}>
            <div className="fmap__card-head">
              <span className="fmap__card-tag" dir="ltr">{z.tag}</span>
              <h3>{z.name[lang]}</h3>
              <button type="button" className="fmap__close" aria-label={s.close} onClick={() => setSel(null)}><X size={16} aria-hidden="true" /></button>
            </div>
            <dl>
              {z.tier && (<><dt>{s.tier}</dt><dd><b style={{ color: TIER_COLOR[z.tier] }}>{tiers[z.tier].name}</b></dd></>)}
              <dt>{s.size}</dt><dd dir="ltr">{z.w} × {z.d} m</dd>
              <dt>{s.area}</dt><dd dir="ltr">{Math.round(z.w * z.d)} m²</dd>
              {booth && (<><dt>{s.where}</dt><dd>{booth.where[lang]}</dd></>)}
              {sellable(z) && (<><dt>{s.status}</dt><dd className="fmap__free">{s.available}</dd></>)}
            </dl>
            {!sellable(z) && <p>{z.note[lang]}</p>}
            <Link href={`/${lang}/ev?zone=${z.id}`} className="btn btn-primary btn-sm"><Rotate3d size={16} aria-hidden="true" />{s.open3d}</Link>
          </div>
        ) : (
          <p className="fmap__hint">{s.pick}</p>
        )}
        <p className="fmap__caption">{s.caption}</p>
      </div>
    </div>
  );
}
