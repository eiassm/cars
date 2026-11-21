"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Globe, LocateFixed, MapPin, Moon, PlugZap, Search, Sun, X, Zap } from "lucide-react";
import { LOT_AREA, type Zone, type ZoneGroup } from "@/lib/expo";
import { BANK_COLOR, CHARGERS_V2, SEATS_V2, TIER_COLOR, TIER_LABEL, ZONES_V2 } from "@/lib/venue";
import type { Dictionary, Locale } from "@/lib/i18n";
import { useVenueScene2 } from "@/components/venue/useVenueScene2";
import type { LayerKey, ViewKey } from "@/components/venue/scene2";
import { EvMark } from "./EvMark";

const VIEW_KEYS: ViewKey[] = ["perspective", "top", "gate", "seats"];
const LAYER_KEYS: LayerKey[] = ["labels", "lines", "surroundings"];
type Filter = "all" | ZoneGroup;
const FILTERS: Filter[] = ["all", "booth", "bank", "prog", "svc"];

const ZONES = ZONES_V2;
const ZONE_MAP: Record<string, Zone> = Object.fromEntries(ZONES.map((z) => [z.id, z]));
/** 2 posts per dealer pavilion + 2 fast chargers at the centre pavilion. */
const CHARGERS = CHARGERS_V2;

const EV_SWATCH = (z: Zone) => (z.tier ? TIER_COLOR[z.tier] : z.group === "bank" ? BANK_COLOR : z.group === "prog" ? "#7C8CFF" : "#8FA3B5");

export function EvPlanner({ lang, t }: { lang: Locale; t: Dictionary }) {
  const e = t.ev, v = t.venue;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { sceneRef, status, sel, setSel } = useVenueScene2(canvasRef, lang);
  const [view, setView] = useState<ViewKey>("perspective");
  const [night, setNight] = useState(false);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({ labels: true, lines: false, surroundings: true });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [menuOpen, setMenuOpen] = useState(true);
  // phones: start with the 3D in view; the menu opens from its button
  useEffect(() => {
    if (window.innerWidth >= 700) return;
    const t = setTimeout(() => setMenuOpen(false), 0);
    return () => clearTimeout(t);
  }, []);

  // Push UI state into the scene once it is ready, and whenever it changes.
  useEffect(() => { sceneRef.current?.setNight(night); }, [sceneRef, night, status]);
  useEffect(() => { LAYER_KEYS.forEach((k) => sceneRef.current?.setLayer(k, layers[k])); }, [sceneRef, layers, status]);

  const other: Locale = lang === "ar" ? "en" : "ar";
  const z = sel ? ZONE_MAP[sel] : null;
  const area = (w: number, d: number) => `${Math.round(w * d)} m²`;

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ZONES.filter((zz) => (filter === "all" || zz.group === filter))
      .filter((zz) => !q || [zz.name.ar, zz.name.en, zz.tag, zz.exhibitor?.brands ?? "", zz.exhibitor?.city.ar ?? "", zz.exhibitor?.city.en ?? ""].some((s) => s.toLowerCase().includes(q)));
  }, [query, filter]);

  const goView = (k: ViewKey) => { setView(k); sceneRef.current?.setView(k); };
  const toggleNight = (n: boolean) => setNight(n);
  const toggleLayer = (k: LayerKey) => setLayers((s) => ({ ...s, [k]: !s[k] }));
  const pick = (id: string) => { setSel(id); if (sel === id) sceneRef.current?.select(id); };

  const stats = [
    { value: String(CHARGERS), label: e.stats.chargers, icon: <PlugZap size={16} aria-hidden="true" /> },
    { value: "12", label: e.stats.booths },
    { value: String(SEATS_V2.length), label: e.stats.seats },
    { value: `≈ ${(Math.round(LOT_AREA / 50) * 50).toLocaleString("en-US")} m²`, label: e.stats.area },
  ];

  return (
    <div className={`ev${menuOpen ? " ev--menu" : ""}`}>
      <canvas ref={canvasRef} className="ev__canvas" role="img" aria-label={v.canvasLabel} />

      <header className="ev__bar">
        <div className="ev__brand">
          <EvMark className="ev__mark" />
          <div className="ev__titles">
            <h1>{e.title}</h1>
            <span className="ev__edition">{e.edition}</span>
          </div>
        </div>
        <div className="ev__controls">
          <div className="ev-seg" role="group" aria-label={v.views.perspective}>
            {VIEW_KEYS.map((k) => (
              <button key={k} type="button" aria-pressed={view === k} onClick={() => goView(k)}>{v.views[k]}</button>
            ))}
          </div>
          <div className="ev-seg" role="group" aria-label={`${v.day} / ${v.night}`}>
            <button type="button" aria-pressed={!night} aria-label={v.day} onClick={() => toggleNight(false)}><Sun size={16} aria-hidden="true" /></button>
            <button type="button" aria-pressed={night} aria-label={v.night} onClick={() => toggleNight(true)}><Moon size={16} aria-hidden="true" /></button>
          </div>
          <Link href={`/${other}/ev`} className="ev-pill" hrefLang={other} lang={other} aria-label={t.switchLang}>
            <Globe size={15} aria-hidden="true" />{t.switchLangShort}
          </Link>
        </div>
      </header>

      <div className="ev__legend" aria-hidden="true">
        <span><i className="ev-dot ev-dot--teal" />{e.legendChargers}</span>
        <span><i className="ev-dot ev-dot--lime" />{e.legendPath}</span>
        {(["premium", "golden", "regular"] as const).map((k) => (
          <span key={k}><i className="ev-dot" style={{ background: TIER_COLOR[k] }} />{TIER_LABEL[k][lang]}</span>
        ))}
        <span><i className="ev-dot" style={{ background: BANK_COLOR }} />{e.legendBanks}</span>
      </div>

      <div className="ev__layers">
        {LAYER_KEYS.map((k) => (
          <button key={k} type="button" aria-pressed={layers[k]} onClick={() => toggleLayer(k)}>{v.layers[k]}</button>
        ))}
        <span className="ev__hint">{e.hint}</span>
      </div>

      {!menuOpen && (
        <button type="button" className="ev__open" onClick={() => setMenuOpen(true)} aria-expanded={false} aria-controls="ev-menu">
          <Search size={16} aria-hidden="true" />{e.menu}
        </button>
      )}

      <aside id="ev-menu" className="ev__menu" hidden={!menuOpen} aria-label={e.menu}>
        <div className="ev__menu-head">
          <div className="ev__place"><MapPin size={14} aria-hidden="true" />{e.place}</div>
          <button type="button" className="ev-icon" onClick={() => setMenuOpen(false)} aria-label={e.hideMenu}><ChevronDown size={18} aria-hidden="true" /></button>
        </div>

        <div className="ev-stats">
          {stats.map((s) => (
            <div key={s.label} className="ev-stat">
              <span className="ev-stat__value" dir="ltr">{s.icon}{s.value}</span>
              <span className="ev-stat__label">{s.label}</span>
            </div>
          ))}
        </div>

        {z && (
          <div className="ev-sel" aria-live="polite">
            <div className="ev-sel__top">
              <span className="ev-tag" dir="ltr" style={{ background: EV_SWATCH(z) }}>{z.tag}</span>
              <button type="button" className="ev-icon" aria-label={v.clear} onClick={() => setSel(null)}><X size={16} aria-hidden="true" /></button>
            </div>
            <h2>{z.name[lang]}</h2>
            <span className="ev-sel__sub">{z.sub[lang]}</span>
            <div className="ev-sel__pills">
              <span dir="ltr">{z.w} × {z.d} m</span>
              <span dir="ltr">{area(z.w, z.d)}</span>
              {z.tier && <span style={{ color: TIER_COLOR[z.tier] }}>{TIER_LABEL[z.tier][lang]}</span>}
              {z.group === "booth" && <span className="ev-sel__charge"><Zap size={12} aria-hidden="true" />{z.id === "p1" ? "DC × 2" : "AC × 2"}</span>}
            </div>
            <p>{z.note[lang]}</p>
            {z.group === "booth" && <p className="ev-sel__ev"><PlugZap size={14} aria-hidden="true" />{z.id === "p1" ? e.hubChargers : e.boothChargers}</p>}
            <button type="button" className="ev-fly" onClick={() => sceneRef.current?.select(z.id)}><LocateFixed size={15} aria-hidden="true" />{e.flyTo}</button>
          </div>
        )}

        <label className="ev-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">{e.searchLabel}</span>
          <input type="search" value={query} placeholder={e.search} onChange={(ev) => setQuery(ev.target.value)} />
        </label>

        <div className="ev-filters" role="group" aria-label={e.searchLabel}>
          {FILTERS.map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{e.filters[f]}</button>
          ))}
        </div>

        <ul className="ev-list">
          {list.map((zz) => (
            <li key={zz.id}>
              <button type="button" aria-pressed={sel === zz.id} onClick={() => pick(zz.id)}>
                <span className="ev-tag" dir="ltr" style={{ background: EV_SWATCH(zz) }}>{zz.tag}</span>
                <span className="ev-list__name">
                  <strong>{zz.name[lang]}</strong>
                  <small>{zz.sub[lang]}</small>
                </span>
                <span className="ev-list__area" dir="ltr">{area(zz.w, zz.d)}</span>
              </button>
            </li>
          ))}
          {!list.length && <li className="ev-list__empty">{e.noResults}</li>}
        </ul>

        <p className="ev__note">{e.note}</p>
        <p className="ev__credit">{v.credit}</p>
      </aside>

      {status !== "ready" && (
        <div className="ev__loading" role="status">
          {status === "failed" ? v.noWebgl : (<><span className="ev-battery"><span /></span>{e.loading}</>)}
        </div>
      )}
    </div>
  );
}
