"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Locale } from "@/lib/i18n";
import type { VenueScene, VenueTheme } from "./scene";

function cssFont(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Creates the three.js venue on a canvas (client only) and tracks loading and the picked zone. */
export function useVenueScene(canvasRef: RefObject<HTMLCanvasElement | null>, lang: Locale, theme?: "gold" | "ev") {
  const sceneRef = useRef<VenueScene | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cv = canvasRef.current;
    if (!cv) return;
    import("./scene")
      .then(({ VenueScene, EV_THEME, GOLD_THEME }) => {
        if (cancelled) return;
        const t: VenueTheme = theme === "ev" ? EV_THEME : GOLD_THEME;
        sceneRef.current = new VenueScene(cv, {
          locale: lang,
          theme: t,
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
  }, [canvasRef, lang, theme]);

  useEffect(() => { sceneRef.current?.select(sel); }, [sel]);

  return { sceneRef, status, sel, setSel };
}
