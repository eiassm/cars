"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { LOT_AREA, SEATS, ZONES, ZONE_MAP, type ZoneGroup } from "@/lib/expo";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { LayerKey, VenueScene, ViewKey } from "./scene";

const VIEW_KEYS: ViewKey[] = ["perspective", "top", "gate", "seats"];
const LAYER_KEYS: LayerKey[] = ["labels", "lines", "surroundings"];
const GROUPS: ZoneGroup[] = ["prog", "booth", "svc"];

function cssFont(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function VenueViewer({ lang, t }: { lang: Locale; t: Dictionary }) {
  const v = t.venue;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<VenueScene | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [view, setView] = useState<ViewKey>("perspective");
  const [night, setNight] = useState(false);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({ labels: true, lines: true, surroundings: true });
  const [sel, setSel] = useState<string | null>(null);

  // Create the three.js scene once, on the client only.
  useEffect(() => {
    let cancelled = false;
    const cv = canvasRef.current;
    if (!cv) return;
    import("./scene")
      .then(({ VenueScene }) => {
        if (cancelled) return;
        sceneRef.current = new VenueScene(cv, {
          locale: lang,
          fonts: { arabic: cssFont("--font-cairo", "Cairo"), latin: cssFont("--font-montserrat", "Montserrat") },
          onSelect: (id) => setSel(id),
          onReady: () => setStatus("ready"),
        });
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) setStatus("failed");
      });
    return () => {
      cancelled = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [lang]);

  useEffect(() => { sceneRef.current?.setNight(night); }, [night, status]);
  useEffect(() => { LAYER_KEYS.forEach((k) => sceneRef.current?.setLayer(k, layers[k])); }, [layers, status]);
  useEffect(() => { sceneRef.current?.select(sel); }, [sel]);

  const goView = (k: ViewKey) => { setView(k); sceneRef.current?.setView(k); };
  const toggle = (id: string) => setSel((cur) => (cur === id ? null : id));
  const z = sel ? ZONE_MAP[sel] : null;
  const m = v.metres;
  const area = (w: number, d: number) => `${Math.round(w * d)} m²`;

  const stats = [
    { value: `≈ ${(Math.round(LOT_AREA / 50) * 50).toLocaleString("en-US")} m²`, label: v.stats.area },
    { value: "12", label: v.stats.booths },
    { value: String(SEATS.length), label: v.stats.seats },
    { value: "16 × 8 m", label: v.stats.stage },
  ];

  return (
    <div className="venue__body">
      <div className="stage3d">
        <canvas ref={canvasRef} role="img" aria-label={v.canvasLabel} />
        <div className="stage3d__top">
          <div className="seg" role="group" aria-label={v.views.perspective}>
            {VIEW_KEYS.map((k) => (
              <button key={k} type="button" aria-pressed={view === k} onClick={() => goView(k)}>{v.views[k]}</button>
            ))}
          </div>
          <div className="seg" role="group" aria-label={`${v.day} / ${v.night}`}>
            <button type="button" aria-pressed={!night} onClick={() => setNight(false)}>{v.day}</button>
            <button type="button" aria-pressed={night} onClick={() => setNight(true)}>{v.night}</button>
          </div>
        </div>
        <div className="stage3d__bottom">
          <div className="layers">
            {LAYER_KEYS.map((k) => (
              <button key={k} type="button" aria-pressed={layers[k]} onClick={() => setLayers((s) => ({ ...s, [k]: !s[k] }))}>{v.layers[k]}</button>
            ))}
          </div>
          <div className="stage3d__hint">{v.hint}</div>
        </div>
        {status !== "ready" && <div className="stage3d__overlay">{status === "failed" ? v.noWebgl : v.loading}</div>}
      </div>

      <aside className="side">
        <div className="stats">
          {stats.map((s) => (
            <div key={s.label} className="stat">
              <span className="stat__value" dir="ltr" style={{ textAlign: t.dir === "rtl" ? "right" : "left" }}>{s.value}</span>
              <span className="stat__label">{s.label}</span>
            </div>
          ))}
        </div>

        {z ? (
          <div className="sel" aria-live="polite">
            <div className="sel__top">
              <span className="sel__tag" dir="ltr">{z.tag}</span>
              <button type="button" className="sel__close" aria-label={v.clear} onClick={() => setSel(null)}><X size={18} aria-hidden="true" /></button>
            </div>
            <h2>{z.name[lang]}</h2>
            <span className="sel__sub">{z.sub[lang]}</span>
            <div className="sel__pills">
              <span>{z.w} × {z.d} {m}</span>
              <span>{area(z.w, z.d)}</span>
            </div>
            <p>{z.note[lang]}</p>
          </div>
        ) : (
          <div className="pick-hint">{v.pickHint}</div>
        )}

        {GROUPS.map((g) => (
          <section key={g} className="zone-group">
            <h3>{v.groups[g]}</h3>
            {ZONES.filter((zz) => zz.group === g).map((zz) => (
              <button key={zz.id} type="button" className="zone-btn" aria-pressed={sel === zz.id} onClick={() => toggle(zz.id)}>
                <span className="tag" dir="ltr" style={{ background: zz.swatch, minWidth: 38 }}>{zz.tag}</span>
                <span className="zone-btn__name">
                  <strong>{zz.name[lang]}</strong>
                  <small>{zz.sub[lang]}</small>
                </span>
                <span className="zone-btn__area" dir="ltr">{area(zz.w, zz.d)}</span>
              </button>
            ))}
          </section>
        ))}

        <p className="side__note">{v.note}</p>
        <p className="side__credit">{v.credit}</p>
      </aside>
    </div>
  );
}
