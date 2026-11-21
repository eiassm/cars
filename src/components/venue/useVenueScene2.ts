"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Locale } from "@/lib/i18n";
import type { VenueScene2 } from "./scene2";

function cssFont(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Creates the v2 venue (client only) and tracks loading and the picked zone. */
export function useVenueScene2(canvasRef: RefObject<HTMLCanvasElement | null>, lang: Locale) {
  const sceneRef = useRef<VenueScene2 | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cv = canvasRef.current;
    if (!cv) return;
    import("./scene2")
      .then(({ VenueScene2 }) => {
        if (cancelled) return;
        sceneRef.current = new VenueScene2(cv, {
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
  }, [canvasRef, lang]);

  useEffect(() => { sceneRef.current?.select(sel); }, [sel]);

  return { sceneRef, status, sel, setSel };
}
