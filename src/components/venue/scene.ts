// three.js model of the expo yard: the lot from the 1:250 site plan, walls, surroundings,
// stage, seating, 12 dealer pavilions, gate, light masts, plus orbit controls and picking.
// World units are metres. Plan x → world x, plan y (south) → world z, centred on the yard.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { LOT, SEAT_AREA, SEATS, ZONES, ZONE_MAP, type Zone } from "@/lib/expo";
import type { Locale } from "@/lib/i18n";

const CX = 31;
const CY = 30;
/** Colours and copy that differ between the classic gold venue and the EV / plug-in edition. */
export type VenueTheme = {
  id: "gold" | "ev";
  metal: number; // trims, pylons, podium
  metalOpts: { metalness: number; roughness: number };
  strip: number; // booth edge strips
  stripGlow: number; // their evening glow
  css: { accent: string; accentSoft: string; sub: string };
  select: number;
  frontSeats: number;
  heroCar: number;
  led: { from: string; mid: string; to: string; rings: string; title: Record<Locale, string>; sub: string };
  gate: Record<Locale, [string, string]>;
  /** Charging pedestals beside every car and an animated energy path from the gate to the stage. */
  ev: boolean;
};

export const GOLD_THEME: VenueTheme = {
  id: "gold",
  metal: 0xa8883a,
  metalOpts: { metalness: 0.85, roughness: 0.3 },
  strip: 0xa8883a,
  stripGlow: 0xffc06a,
  css: { accent: "#A8883A", accentSoft: "rgba(168,136,58,.85)", sub: "#C8A84E" },
  select: 0xe2c26a,
  frontSeats: 0xa8883a,
  heroCar: 0xc8a84e,
  led: {
    from: "#0a0a0a", mid: "#1a1408", to: "#3a2c0e", rings: "rgba(168,136,58,.35)",
    title: { ar: "معرض فلسطين للسيارات 2027", en: "Palestine Auto Expo 2027" },
    sub: "PALESTINE AUTO EXPO · 1–7 MAY 2027",
  },
  gate: {
    ar: ["معرض فلسطين للسيارات 2027", "Palestine Auto Expo · 1–7 May 2027"],
    en: ["Palestine Auto Expo 2027", "معرض فلسطين للسيارات · 1–7 أيار 2027"],
  },
  ev: false,
};

export const EV_THEME: VenueTheme = {
  id: "ev",
  metal: 0xc9d2da,
  metalOpts: { metalness: 0.9, roughness: 0.22 },
  strip: 0x1fd6c4,
  stripGlow: 0x22e6d2,
  css: { accent: "#22E0C8", accentSoft: "rgba(34,224,200,.85)", sub: "#B6F23A" },
  select: 0x5ff5e3,
  frontSeats: 0x1fb8a8,
  heroCar: 0xe9eef2,
  led: {
    from: "#03121a", mid: "#062a33", to: "#0b3b2a", rings: "rgba(34,224,200,.35)",
    title: { ar: "السيارات الكهربائية والهجينة القابلة للشحن", en: "Electric & Plug-in Hybrid" },
    sub: "PALESTINE AUTO EXPO 2027 · PLUG IN · 1–7 MAY",
  },
  gate: {
    ar: ["معرض فلسطين للسيارات الكهربائية 2027", "Electric & Plug-in · 1–7 May 2027"],
    en: ["Palestine EV & Plug-in Expo 2027", "السيارات الكهربائية والهجينة · 1–7 أيار 2027"],
  },
  ev: true,
};

export type ViewKey = "perspective" | "top" | "gate" | "seats";
export type LayerKey = "labels" | "lines" | "surroundings";

type Orbit = { t: THREE.Vector3; r: number; phi: number; th: number };

const VIEWS: Record<ViewKey, { t: [number, number, number]; r: number; phi: number; th: number }> = {
  perspective: { t: [31, 0, 30], r: 84, phi: 0.9, th: 0.62 },
  top: { t: [31, 0, 31], r: 92, phi: 0.02, th: 0 },
  gate: { t: [30, 2, 38], r: 17, phi: 1.46, th: 0 },
  seats: { t: [31, 3.2, 5], r: 19, phi: 1.5, th: 0 },
};

const MASTS: [number, number][] = [[2.6, 24], [17, 1.2], [44.5, 1.2], [61.4, 14], [52.5, 37.5], [10.5, 49.6]];
const CAR_COLORS = [0xc8a84e, 0xe8e8e8, 0x101010, 0x8f1d1d, 0x22406e, 0x6c6f73, 0xf2f2f2, 0x2b2b2b, 0x7a1616, 0x1a1a1a, 0xbfc4c9, 0x34495e];

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const P = (x: number, y: number, h = 0) => new THREE.Vector3(x - CX, h, y - CY);

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, g: c.getContext("2d") as CanvasRenderingContext2D };
}

function canvasTexture(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function std(color: THREE.ColorRepresentation, opts: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...opts });
}

export type VenueOptions = {
  locale: Locale;
  theme?: VenueTheme;
  fonts: { arabic: string; latin: string };
  onSelect: (zoneId: string | null) => void;
  onReady: () => void;
};

export class VenueScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.3, 1200);
  private composer: EffectComposer | null = null;
  private pmrem: THREE.PMREMGenerator;
  private clock = new THREE.Clock();
  private ray = new THREE.Raycaster();
  private orb: Orbit;
  private goal: Orbit | null = null;
  private raf = 0;
  private ro: ResizeObserver;
  private alive = true;
  private night = false;
  private disposers: (() => void)[] = [];

  private labelGroup = new THREE.Group();
  private envGroup = new THREE.Group();
  private nightOnly: THREE.Object3D[] = [];
  private emissive: THREE.MeshStandardMaterial[] = [];
  private signs: THREE.MeshStandardMaterial[] = [];
  private pick: THREE.Object3D[] = [];
  private spin: THREE.Object3D[] = [];
  private carSlots: { g: THREE.Group; color: number }[] = [];

  private hemi!: THREE.HemisphereLight;
  private sun!: THREE.DirectionalLight;
  private lotMesh!: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshStandardMaterial>;
  private texLines!: THREE.Texture;
  private texPlain!: THREE.Texture;
  private ledMat!: THREE.MeshStandardMaterial;
  private ledCanvas!: HTMLCanvasElement;
  private ledTex!: THREE.CanvasTexture;
  private lampMat!: THREE.MeshStandardMaterial;
  private mastLamp!: THREE.MeshStandardMaterial;
  private stripMat!: THREE.MeshStandardMaterial;
  private bldMat!: THREE.MeshStandardMaterial;
  private aoTex: THREE.Texture | null = null;
  private bgDay: THREE.Texture | null = null;
  private envDay: THREE.Texture | null = null;
  private bgNight: THREE.Texture;
  private envNight: THREE.Texture;
  private selGroup = new THREE.Group();
  private selBars: THREE.Mesh[] = [];
  private selMat!: THREE.MeshBasicMaterial;
  private selFill!: THREE.Mesh;

  private th: VenueTheme;
  private flowTiles: THREE.Mesh[] = [];
  private chargerGlow!: THREE.MeshStandardMaterial;

  constructor(private cv: HTMLCanvasElement, private opts: VenueOptions) {
    this.th = opts.theme ?? GOLD_THEME;
    const R = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: "high-performance" });
    R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    R.shadowMap.enabled = true;
    R.shadowMap.type = THREE.PCFSoftShadowMap;
    R.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer = R;
    this.pmrem = new THREE.PMREMGenerator(R);
    this.bgNight = this.nightSky();
    this.envNight = this.pmrem.fromEquirectangular(this.bgNight).texture;
    new THREE.TextureLoader().load("/sky/day.jpg", (tex) => {
      if (!this.alive) return;
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      this.bgDay = tex;
      this.envDay = this.pmrem.fromEquirectangular(tex).texture;
      this.applyTime();
    });

    const v = VIEWS.perspective;
    this.orb = { t: new THREE.Vector3(v.t[0] - CX, v.t[1], v.t[2] - CY), r: v.r, phi: v.phi, th: v.th };
    this.scene.add(this.labelGroup, this.envGroup, this.selGroup);

    this.buildLights();
    this.buildLot();
    this.buildWalls();
    this.buildNorth();
    this.buildSurroundings();
    this.buildStage();
    this.buildSeating();
    this.buildTent(ZONE_MAP.vip);
    this.buildTent(ZONE_MAP.media);
    this.buildBooths();
    this.buildGate();
    this.buildMasts();
    this.buildSelection();
    if (this.th.ev) this.buildEnergyPath();

    this.composer = new EffectComposer(R);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), this.th.ev ? 0.55 : 0.8, 0.5, 1.0));
    this.composer.addPass(new OutputPass());

    this.ro = new ResizeObserver(() => this.fit());
    this.ro.observe(cv.parentElement as HTMLElement);
    this.fit();
    this.bindInput();
    this.applyTime();
    this.loadCars();

    const fontsReady = document.fonts?.load
      ? Promise.all([document.fonts.load(`800 40px ${opts.fonts.arabic}`), document.fonts.load(`700 30px ${opts.fonts.latin}`)]).catch(() => undefined)
      : Promise.resolve();
    fontsReady.then(() => {
      if (!this.alive) return;
      this.buildLabels();
      this.buildSigns();
      this.drawLED();
      this.applyTime();
      opts.onReady();
    });

    const loop = () => {
      if (!this.alive) return;
      this.raf = requestAnimationFrame(loop);
      this.tick();
    };
    loop();
  }

  // ---------- public API ----------
  setNight(night: boolean) {
    this.night = night;
    this.applyTime();
  }

  setLayer(key: LayerKey, on: boolean) {
    if (key === "labels") this.labelGroup.visible = on;
    if (key === "surroundings") this.envGroup.visible = on;
    if (key === "lines") {
      this.lotMesh.material.map = on ? this.texLines : this.texPlain;
      this.lotMesh.material.needsUpdate = true;
    }
  }

  setView(key: ViewKey) {
    const v = VIEWS[key];
    this.goal = { t: new THREE.Vector3(v.t[0] - CX, v.t[1], v.t[2] - CY), r: v.r, phi: v.phi, th: v.th };
  }

  select(id: string | null) {
    if (!id || !ZONE_MAP[id]) {
      this.selGroup.visible = false;
      return;
    }
    const z = ZONE_MAP[id];
    const cx = z.x + z.w / 2 - CX;
    const cz = z.y + z.d / 2 - CY;
    const w = z.w + 0.6;
    const d = z.d + 0.6;
    const [a, b, c, e] = this.selBars;
    a.scale.x = w; a.position.set(cx, 0.2, cz - d / 2);
    b.scale.x = w; b.position.set(cx, 0.2, cz + d / 2);
    c.scale.x = d; c.rotation.y = Math.PI / 2; c.position.set(cx - w / 2, 0.2, cz);
    e.scale.x = d; e.rotation.y = Math.PI / 2; e.position.set(cx + w / 2, 0.2, cz);
    this.selFill.scale.set(w, d, 1);
    this.selFill.position.set(cx, 0.17, cz);
    this.selGroup.visible = true;
    this.goal = { t: new THREE.Vector3(cx, 1, cz), r: Math.max(this.th.ev ? 30 : 22, Math.max(z.w, z.d) * 2.6), phi: 0.88, th: this.orb.th };
  }

  dispose() {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.disposers.forEach((fn) => fn());
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      mats.forEach((mt) => {
        Object.values(mt).forEach((val) => { if (val instanceof THREE.Texture) val.dispose(); });
        mt.dispose();
      });
    });
    this.pmrem.dispose();
    this.composer?.dispose();
    this.renderer.dispose();
  }

  // ---------- helpers ----------
  private box(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = this.scene) {
    const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    g.position.set(x, y, z);
    g.castShadow = true;
    g.receiveShadow = true;
    parent.add(g);
    return g;
  }

  private pickable(o: THREE.Object3D, zone: string) {
    o.userData.zone = zone;
    this.pick.push(o);
    return o;
  }

  private primary(z: { name: { ar: string; en: string } }) {
    const l = this.opts.locale;
    return { main: z.name[l], other: z.name[l === "ar" ? "en" : "ar"] };
  }

  private textTexture(main: string, sub: string, o: { w: number; h: number; fs: number; fs2: number; bg?: string }) {
    const { c, g } = canvas(o.w, o.h);
    if (o.bg) { g.fillStyle = o.bg; g.fillRect(0, 0, o.w, o.h); }
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#ffffff";
    this.fitFont(g, main, 800, o.fs, o.w - 60);
    g.fillText(main, o.w / 2, sub ? o.h * 0.4 : o.h / 2);
    if (sub) {
      g.fillStyle = this.th.css.sub;
      const subText = /[؀-ۿ]/.test(sub) ? sub : sub.toUpperCase();
      this.fitFont(g, subText, 700, o.fs2, o.w - 60);
      g.fillText(subText, o.w / 2, o.h * 0.76);
    }
    return canvasTexture(c);
  }

  /** Sets the largest font (up to `size`) at which `text` fits in `maxW` pixels. */
  private fitFont(g: CanvasRenderingContext2D, text: string, weight: number, size: number, maxW: number) {
    let px = size;
    g.font = `${weight} ${px}px ${this.fontFor(text)}`;
    while (px > 12 && g.measureText(text).width > maxW) {
      px -= 2;
      g.font = `${weight} ${px}px ${this.fontFor(text)}`;
    }
  }

  private fontFor(s: string) {
    return /[؀-ۿ]/.test(s) ? `${this.opts.fonts.arabic}, sans-serif` : `${this.opts.fonts.latin}, sans-serif`;
  }

  private label(main: string, sub: string, x: number, y: number, h: number, scale = 1) {
    const W = 640, H = 200;
    const { c, g } = canvas(W, H);
    g.fillStyle = "rgba(10,10,10,.82)";
    const r = 36;
    g.beginPath();
    g.moveTo(r, 8);
    g.arcTo(W - 8, 8, W - 8, H - 8, r);
    g.arcTo(W - 8, H - 8, 8, H - 8, r);
    g.arcTo(8, H - 8, 8, 8, r);
    g.arcTo(8, 8, W - 8, 8, r);
    g.closePath();
    g.fill();
    g.strokeStyle = this.th.css.accentSoft;
    g.lineWidth = 4;
    g.stroke();
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#fff";
    this.fitFont(g, main, 800, 62, W - 56);
    g.fillText(main, W / 2, H * 0.4);
    g.fillStyle = this.th.css.accent;
    const subText = /[؀-ۿ]/.test(sub) ? sub : sub.toUpperCase();
    this.fitFont(g, subText, 700, 30, W - 64);
    g.fillText(subText, W / 2, H * 0.76);
    // Constant on-screen size, so labels stay readable from the aerial views.
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTexture(c), depthTest: false, transparent: true, sizeAttenuation: false }));
    sp.scale.set(0.2 * scale, 0.0625 * scale, 1);
    sp.position.copy(P(x, y, h));
    sp.renderOrder = 10;
    this.labelGroup.add(sp);
    return sp;
  }

  private nightSky() {
    const W = 2048, H = 1024;
    const { c, g } = canvas(W, H);
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, "#02030a");
    gr.addColorStop(0.38, "#070a16");
    gr.addColorStop(0.48, "#1a1820");
    gr.addColorStop(0.5, "#3a2a1e");
    gr.addColorStop(0.53, "#141215");
    gr.addColorStop(1, "#070708");
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    const r = rng(5);
    for (let i = 0; i < 1600; i++) {
      const y = Math.pow(r(), 1.6) * H * 0.46;
      g.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.75})`;
      const s = r() < 0.06 ? 2 : 1;
      g.fillRect(r() * W, y, s, s);
    }
    for (let i = 0; i < 60; i++) {
      const x = r() * W, w = 40 + r() * 160;
      const gg = g.createRadialGradient(x, H * 0.5, 0, x, H * 0.5, w);
      gg.addColorStop(0, "rgba(255,170,90,.18)");
      gg.addColorStop(1, "rgba(255,170,90,0)");
      g.fillStyle = gg;
      g.fillRect(x - w, H * 0.5 - w, w * 2, w * 2);
    }
    const t = canvasTexture(c);
    t.mapping = THREE.EquirectangularReflectionMapping;
    return t;
  }

  private aoTexture() {
    if (this.aoTex) return this.aoTex;
    const { c, g } = canvas(128, 64);
    const gr = g.createRadialGradient(64, 32, 4, 64, 32, 62);
    gr.addColorStop(0, "rgba(0,0,0,.75)");
    gr.addColorStop(0.6, "rgba(0,0,0,.35)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.save();
    g.scale(1, 0.5);
    g.fillStyle = gr;
    g.beginPath();
    g.arc(64, 64, 62, 0, Math.PI * 2);
    g.fill();
    g.restore();
    this.aoTex = new THREE.CanvasTexture(c);
    return this.aoTex;
  }

  // ---------- build ----------
  private buildLights() {
    const S = this.scene;
    this.hemi = new THREE.HemisphereLight(0xcfe3ff, 0x6b5a45, 0.55);
    S.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
    sun.position.set(-70, 80, 45);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 10, far: 260 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    S.add(sun, sun.target);
    this.sun = sun;
    const moon = new THREE.DirectionalLight(0x8fa6d6, 0.35);
    moon.position.set(40, 90, -30);
    S.add(moon);
    this.nightOnly.push(moon);
    for (const sx of [-6, 6]) {
      const sp = new THREE.SpotLight(0xffe7c2, 9000, 70, Math.PI / 7, 0.5, 2);
      sp.position.set(sx, 13, -1);
      sp.target.position.set(sx * 0.4, 1.2, -24.5);
      S.add(sp, sp.target);
      this.nightOnly.push(sp);
    }
    const aud = new THREE.SpotLight(0xffd79a, 6000, 60, Math.PI / 5, 0.6, 2);
    aud.position.set(0, 14, -4);
    aud.target.position.set(0, 0, -12);
    S.add(aud, aud.target);
    this.nightOnly.push(aud);
  }

  private lotTexture(lines: boolean) {
    const pxm = 16, W = 64 * pxm, H = 64 * pxm;
    const { c, g } = canvas(W, H);
    g.fillStyle = "#35373b";
    g.fillRect(0, 0, W, H);
    const r = rng(3);
    for (let i = 0; i < 9000; i++) {
      const v = (40 + r() * 30) | 0;
      g.fillStyle = `rgba(${v},${v},${v + 3},${0.25 + r() * 0.3})`;
      g.fillRect(r() * W, r() * H, 2, 2);
    }
    g.fillStyle = "#6d3a33";
    g.fillRect(0, 0, 41.6 * pxm, 2.6 * pxm);
    if (lines) {
      g.strokeStyle = "rgba(240,240,236,.9)";
      g.lineWidth = 0.13 * pxm;
      const L = (x1: number, y1: number, x2: number, y2: number) => { g.beginPath(); g.moveTo(x1 * pxm, y1 * pxm); g.lineTo(x2 * pxm, y2 * pxm); g.stroke(); };
      for (let k = 0; k <= 13; k++) L(3 + 2.6 * k, 4, 3 + 2.6 * k, 9.6);
      for (let k = 0; k <= 5; k++) L(48 + 2.6 * k, 0.6, 48 + 2.6 * k, 6.4);
      for (let k = 0; k <= 12; k++) L(11.5 + 2.6 * k, 15.2, 11.5 + 2.6 * k, 24.8);
      L(11.5, 20, 42.7, 20);
      for (let k = 0; k <= 10; k++) L(14 + 2.6 * k, 31, 14 + 2.6 * k, 40.4);
      L(14, 35.7, 40, 35.7);
      for (let k = 0; k <= 5; k++) L(6.8 + 2.4 * k, 46.8, 6.8 + 2.4 * k, 52.2);
      for (let k = 0; k <= 4; k++) L(37 + 2.6 * k, 46.8, 37 + 2.6 * k, 52.2);
      for (let k = 0; k <= 3; k++) { const y = 53.4 + 2.4 * k; L(20.2, y, 25.4, y); L(31, y, 36.2, y); }
      g.fillStyle = "rgba(40,96,190,.85)";
      g.fillRect(36.8 * pxm, 4 * pxm, 2.5 * pxm, 5.6 * pxm);
      g.fillRect(39.7 * pxm, 4 * pxm, 2.5 * pxm, 5.6 * pxm);
      g.fillStyle = "rgba(240,240,236,.85)";
      const A = (x: number, y: number, dir: number) => {
        g.save(); g.translate(x * pxm, y * pxm); g.rotate(dir);
        g.fillRect(-1.6 * pxm, -0.12 * pxm, 2.4 * pxm, 0.24 * pxm);
        g.beginPath(); g.moveTo(0.8 * pxm, -0.5 * pxm); g.lineTo(1.7 * pxm, 0); g.lineTo(0.8 * pxm, 0.5 * pxm); g.closePath(); g.fill();
        g.restore();
      };
      A(27, 12.2, Math.PI); A(27, 13.4, 0); A(27, 27.6, Math.PI); A(27, 28.8, 0); A(27, 43, Math.PI); A(27, 44.2, 0); A(28, 57, -Math.PI / 2);
    }
    return canvasTexture(c);
  }

  private buildLot() {
    const sh = new THREE.Shape();
    LOT.forEach((p, i) => {
      const X = p[0] - CX, Y = -(p[1] - CY);
      if (i) sh.lineTo(X, Y); else sh.moveTo(X, Y);
    });
    sh.closePath();
    const geo = new THREE.ShapeGeometry(sh);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + CX) / 64, 1 - (-pos.getY(i) + CY) / 64);
    geo.rotateX(-Math.PI / 2);
    this.texLines = this.lotTexture(true);
    this.texPlain = this.lotTexture(false);
    this.lotMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: this.texLines, roughness: 0.92 }));
    this.lotMesh.receiveShadow = true;
    this.scene.add(this.lotMesh);
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(16.2, 6.5), std(0x303235, { roughness: 0.95 }));
    apron.rotation.x = -Math.PI / 2;
    apron.position.copy(P(28.1, 64.4, 0.005));
    apron.receiveShadow = true;
    this.scene.add(apron);
  }

  private buildWalls() {
    const { c, g } = canvas(256, 256);
    g.fillStyle = "#d9ccb1";
    g.fillRect(0, 0, 256, 256);
    const wr = rng(9);
    for (let i = 0; i < 5000; i++) {
      const v = (190 + wr() * 40) | 0;
      g.fillStyle = `rgba(${v},${v - 8},${v - 26},.35)`;
      g.fillRect(wr() * 256, wr() * 256, 2, 2);
    }
    g.fillStyle = "rgba(120,108,88,.55)";
    g.fillRect(0, 0, 3, 256);
    g.fillRect(0, 250, 256, 6);
    const wt = canvasTexture(c);
    wt.wrapS = wt.wrapT = THREE.RepeatWrapping;
    const wallMat = new THREE.MeshStandardMaterial({ map: wt, roughness: 0.95 });
    const curbW = std(0xeeeeee), curbB = std(0x1b1b1b);
    const cypress = std(0x2f4a2a, { flatShading: true });
    for (let i = 1; i < LOT.length; i++) {
      if (i === 9 || i === 10 || i === 11) continue; // the entrance throat stays open
      const a = LOT[i], b = LOT[(i + 1) % LOT.length];
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      if (len < 0.2) continue;
      const h = 3.2, mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      let nx = dy / len, ny = -dx / len;
      if ((mid[0] + nx - CX) * nx + (mid[1] + ny - CY) * ny < 0) { nx = -nx; ny = -ny; }
      const geo = new THREE.BoxGeometry(len + 0.4, h, 0.4);
      const uv = geo.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, (uv.getX(k) * (len + 0.4)) / 4, (uv.getY(k) * h) / 3.2);
      const wall = new THREE.Mesh(geo, wallMat);
      wall.position.copy(P(mid[0] + nx * 0.25, mid[1] + ny * 0.25, h / 2));
      wall.rotation.y = -Math.atan2(dy, dx);
      wall.castShadow = wall.receiveShadow = true;
      this.scene.add(wall);
      const segs = Math.max(1, Math.round(len));
      for (let k = 0; k < segs; k++) {
        const f = (k + 0.5) / segs;
        const cb = new THREE.Mesh(new THREE.BoxGeometry(len / segs, 0.18, 0.3), k % 2 ? curbB : curbW);
        cb.position.copy(P(a[0] + dx * f - nx * 0.15, a[1] + dy * f - ny * 0.15, 0.09));
        cb.rotation.y = -Math.atan2(dy, dx);
        this.scene.add(cb);
      }
      if (i >= 12) {
        const n = Math.floor(len / 3.2);
        for (let k = 0; k < n; k++) {
          const f = (k + 0.5) / n;
          const tr = new THREE.Mesh(new THREE.ConeGeometry(0.32, 2.6, 6), cypress);
          tr.position.copy(P(a[0] + dx * f - nx * 0.55, a[1] + dy * f - ny * 0.55, 1.6));
          tr.castShadow = true;
          this.scene.add(tr);
        }
      }
    }
  }

  private fence(x1: number, y1: number, x2: number, y2: number, h: number, base: number, parent: THREE.Object3D) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const { c, g } = canvas(64, 64);
    g.strokeStyle = "rgba(200,205,210,.9)";
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 64); g.moveTo(64, 0); g.lineTo(0, 64); g.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(len / 0.9, h / 0.9);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(len, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    f.position.copy(P((x1 + x2) / 2, (y1 + y2) / 2, base + h / 2));
    f.rotation.y = -Math.atan2(y2 - y1, x2 - x1);
    parent.add(f);
    const pm = std(0x9aa0a6, { metalness: 0.6, roughness: 0.4 });
    const n = Math.ceil(len / 3);
    for (let k = 0; k <= n; k++) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, h, 6), pm);
      p.position.copy(P(x1 + ((x2 - x1) * k) / n, y1 + ((y2 - y1) * k) / n, base + h / 2));
      parent.add(p);
    }
  }

  private buildNorth() {
    const a = LOT[0], b = LOT[1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(len, 1, 0.35), std(0xd8ccb2, { roughness: 0.95 }));
    parapet.position.copy(P((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.2, 0.5));
    parapet.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    parapet.castShadow = parapet.receiveShadow = true;
    this.scene.add(parapet);
    this.fence(a[0], a[1] - 0.2, b[0], b[1] - 0.2, 2.6, 1, this.scene);

    // Ramallah Sports Village beyond the north edge: padel and multi-sport courts next to the yard,
    // then the football pitch with white tensile canopies over its stands (from the municipality's aerial video).
    const E = this.envGroup;
    const flat = (w: number, d: number, color: number, x: number, y: number, h: number) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), std(color));
      p.rotation.x = -Math.PI / 2;
      p.position.copy(P(x, y, h));
      p.receiveShadow = true;
      E.add(p);
      return p;
    };
    flat(150, 110, 0x77786f, 31, -55, 0.02); // concrete deck around the village
    flat(26, 22, 0x9b3d34, 15, -12, 0.03); // red surround of the padel courts
    flat(10, 20, 0x2f62c4, 9.5, -12, 0.04);
    flat(10, 20, 0x2f62c4, 20.5, -12, 0.04);
    flat(30, 22, 0xc76e64, 47, -12, 0.03);
    flat(26, 18, 0x7fb6d6, 47, -12, 0.04); // light-blue multi-sport court
    this.fence(2, -23, 28, -23, 4, 0, E);
    this.fence(2, -1.2, 28, -1.2, 4, 0, E);
    this.fence(2, -23, 2, -1.2, 4, 0, E);
    this.fence(28, -23, 28, -1.2, 4, 0, E);
    // football pitch with a red track border
    flat(112, 76, 0x9b3d34, 31, -66, 0.03);
    const pitchC = canvas(512, 340);
    pitchC.g.fillStyle = "#2f7a3a"; pitchC.g.fillRect(0, 0, 512, 340);
    for (let i = 0; i < 12; i++) { pitchC.g.fillStyle = i % 2 ? "#2c7236" : "#33833f"; pitchC.g.fillRect(i * 512 / 12, 0, 512 / 12, 340); }
    pitchC.g.strokeStyle = "rgba(255,255,255,.9)"; pitchC.g.lineWidth = 3;
    pitchC.g.strokeRect(14, 14, 484, 312); pitchC.g.beginPath(); pitchC.g.moveTo(256, 14); pitchC.g.lineTo(256, 326); pitchC.g.stroke();
    pitchC.g.beginPath(); pitchC.g.arc(256, 170, 46, 0, Math.PI * 2); pitchC.g.stroke();
    pitchC.g.strokeRect(14, 100, 70, 140); pitchC.g.strokeRect(428, 100, 70, 140);
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(100, 64), new THREE.MeshStandardMaterial({ map: canvasTexture(pitchC.c), roughness: 0.95 }));
    pitch.rotation.x = -Math.PI / 2;
    pitch.position.copy(P(31, -66, 0.05));
    pitch.receiveShadow = true;
    E.add(pitch);
    // stands with white tensile canopies along both long sides
    const standMat = std(0xd9d6cf, { roughness: 0.9 });
    const sailMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.55, side: THREE.DoubleSide });
    const postMat = std(0xbfc3c7, { metalness: 0.5, roughness: 0.4 });
    for (const side of [1, -1]) {
      const yEdge = side > 0 ? -29 : -103;
      const stand = new THREE.Mesh(new THREE.BoxGeometry(84, 3, 6), standMat);
      stand.position.copy(P(31, yEdge + side * 3, 1.5));
      stand.castShadow = stand.receiveShadow = true;
      E.add(stand);
      for (let k = 0; k < 7; k++) {
        const x = -5 + k * 12;
        const sail = new THREE.Mesh(new THREE.PlaneGeometry(11, 9), sailMat);
        sail.position.copy(P(x + 5.5, yEdge + side * 3.5, 8));
        sail.rotation.x = -Math.PI / 2 + side * 0.32;
        sail.castShadow = true;
        E.add(sail);
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 10, 8), postMat);
        post.position.copy(P(x, yEdge + side * 7.5, 5));
        E.add(post);
      }
    }
  }

  private buildSurroundings() {
    const E = this.envGroup, r = rng(11);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(520, 48), std(0x8f7d5d, { roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.03;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // streets: west side street, south curve, east street (approximate)
    const path = new THREE.CatmullRomCurve3(
      [[-9, -60], [-8, -10], [-6.5, 25], [-2, 50], [8, 66], [24, 71], [40, 69], [53, 61], [62, 47], [71, 27], [78, 6], [85, -30]].map(([x, y]) => P(x, y, 0)),
    );
    const pts = path.getSpacedPoints(160);
    const pos: number[] = [], idx: number[] = [];
    const hw = 4.2;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[Math.min(i + 1, pts.length - 1)], o = pts[Math.max(i - 1, 0)];
      const d = new THREE.Vector3().subVectors(q, o).normalize();
      pos.push(p.x - d.z * hw, 0.012, p.z + d.x * hw, p.x + d.z * hw, 0.012, p.z - d.x * hw);
      if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    rg.setIndex(idx);
    rg.computeVertexNormals();
    const road = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ color: 0x2a2b2e, roughness: 0.95, side: THREE.DoubleSide }));
    road.receiveShadow = true;
    E.add(road);

    const hillColors = [0x8b7a57, 0x7f7150, 0x93835f, 0x6f6a47];
    const hills = [[-75, 10, 60, 30], [-70, 70, 55, 26], [10, 115, 70, 34], [75, 95, 60, 30], [120, 30, 65, 36], [115, -55, 60, 32], [40, -150, 75, 40], [-50, -125, 60, 34], [-110, -20, 70, 42]];
    const treeMat = std(0x46602f, { flatShading: true });
    hills.forEach(([hx, hy, hr, hh], i) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(hr, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(hillColors[i % 4], { flatShading: true, roughness: 1 }));
      m.position.copy(P(hx * 1.45 + CX, hy * 1.45 + CY, 0));
      m.scale.set(1, hh / hr, 1);
      m.receiveShadow = true;
      E.add(m);
      for (let k = 0; k < 26; k++) {
        const a = r() * Math.PI * 2, rr = r() * hr * 0.85;
        const y = hh * Math.sqrt(Math.max(0, 1 - (rr / hr) ** 2));
        const tree = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2 + r() * 1.4, 0), treeMat);
        tree.position.set(m.position.x + Math.cos(a) * rr, y + 0.6, m.position.z + Math.sin(a) * rr);
        E.add(tree);
      }
    });

    // stone apartment blocks on the hillsides; windows light up in the evening
    const w1 = canvas(64, 64);
    w1.g.fillStyle = "#ddd2b8"; w1.g.fillRect(0, 0, 64, 64);
    w1.g.fillStyle = "#5b5346";
    for (let yy = 8; yy < 64; yy += 20) for (let xx = 6; xx < 64; xx += 20) w1.g.fillRect(xx, yy, 10, 9);
    const wt = canvasTexture(w1.c);
    wt.wrapS = wt.wrapT = THREE.RepeatWrapping;
    const w2 = canvas(64, 64);
    w2.g.fillStyle = "#000"; w2.g.fillRect(0, 0, 64, 64);
    w2.g.fillStyle = "#ffcf8a";
    for (let yy = 8; yy < 64; yy += 20) for (let xx = 6; xx < 64; xx += 20) if (((xx + yy) / 2) % 3 | 0) w2.g.fillRect(xx, yy, 10, 9);
    const et = canvasTexture(w2.c, false);
    et.wrapS = et.wrapT = THREE.RepeatWrapping;
    this.bldMat = new THREE.MeshStandardMaterial({ map: wt, emissiveMap: et, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.9 });
    for (let i = 0; i < 90; i++) {
      const a = r() * Math.PI * 2, dist = 78 + r() * 120;
      const x = Math.cos(a) * dist, z = Math.sin(a) * dist;
      if (z < -20 && z > -120 && x > -80 && x < 90) continue;
      const w = 10 + r() * 12, d = 10 + r() * 12, h = 14 + r() * 34, base = Math.max(0, (dist - 70) * 0.3);
      const geo = new THREE.BoxGeometry(w, h + base, d);
      const uv = geo.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, (uv.getX(k) * w) / 4, (uv.getY(k) * (h + base)) / 3.4);
      const b = new THREE.Mesh(geo, this.bldMat);
      b.position.set(x, (h + base) / 2, z);
      b.rotation.y = r() * Math.PI;
      b.castShadow = dist < 120;
      E.add(b);
    }
    const hotel = new THREE.Mesh(new THREE.BoxGeometry(26, 30, 16), this.bldMat);
    hotel.position.set(95, 23, -70);
    E.add(hotel);
  }

  private buildStage() {
    const blk = std(0x101010, { roughness: 0.5 }), gold = std(this.th.metal, this.th.metalOpts);
    const c = P(31, 5.5);
    this.pickable(this.box(16, 1.2, 8, blk, c.x, 0.6, c.z), "stage");
    this.box(16, 0.1, 0.12, gold, c.x, 1.22, c.z + 4);
    this.box(16.1, 0.1, 0.12, gold, c.x, 0.05, c.z + 4.05);
    for (const sx of [-7, 7]) for (let k = 0; k < 3; k++) this.box(1.6, 0.4 * (k + 1), 0.45, blk, c.x + sx, 0.2 * (k + 1), c.z + 4.25 + (2 - k) * 0.45);

    this.ledCanvas = canvas(1200, 500).c;
    this.ledTex = canvasTexture(this.ledCanvas);
    this.drawLED();
    this.ledMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: this.ledTex, emissiveIntensity: 0.9, roughness: 0.4 });
    const side = std(0x0b0b0b);
    const led = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 0.3), [side, side, side, side, this.ledMat, side]);
    led.position.set(c.x, 3.8, P(31, 2.3).z);
    led.castShadow = true;
    this.scene.add(led);
    this.pickable(led, "stage");
    for (const sx of [-7.6, 7.6]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(2.8, 4, 0.25), [side, side, side, side, this.ledMat, side]);
      s.position.set(c.x + sx, 3.6, P(31, 3).z);
      s.rotation.y = sx > 0 ? -0.35 : 0.35;
      this.scene.add(s);
    }
    const truss = std(0x9a9ea3, { metalness: 0.7, roughness: 0.35 });
    for (const sx of [-8.3, 8.3]) for (const sz of [1.7, 8.9]) this.box(0.35, 8.5, 0.35, truss, c.x + sx, 4.25, P(31, sz).z);
    this.box(17, 0.4, 0.4, truss, c.x, 8.5, P(31, 1.7).z);
    this.box(17, 0.4, 0.4, truss, c.x, 8.5, P(31, 8.9).z);
    this.box(0.4, 0.4, 7.6, truss, c.x - 8.3, 8.5, c.z);
    this.box(0.4, 0.4, 7.6, truss, c.x + 8.3, 8.5, c.z);
    this.lampMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffe2b0, emissiveIntensity: 0 });
    for (let k = -3; k <= 3; k++) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.5, 10), this.lampMat);
      l.position.set(c.x + k * 2.2, 8.1, P(31, 8.9).z);
      this.scene.add(l);
    }
    this.box(0.8, 1.15, 0.55, gold, c.x + 4.5, 1.775, c.z + 2.2);
  }

  private drawLED() {
    const c = this.ledCanvas, g = c.getContext("2d") as CanvasRenderingContext2D, W = c.width, H = c.height;
    const gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, this.th.led.from);
    gr.addColorStop(0.55, this.th.led.mid);
    gr.addColorStop(1, this.th.led.to);
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = this.th.led.rings;
    g.lineWidth = 2;
    for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(W * 0.82, H * 0.5, 40 + i * 34, 0, Math.PI * 2); g.stroke(); }
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#ffffff";
    const title = this.th.led.title[this.opts.locale];
    g.font = `800 ${title.length > 26 ? 70 : 96}px ${this.fontFor(title)}`;
    g.fillText(title, W * 0.42, H * 0.4);
    g.fillStyle = this.th.css.sub;
    g.font = `700 40px ${this.opts.fonts.latin}, sans-serif`;
    g.fillText(this.th.led.sub, W * 0.42, H * 0.66);
    if (this.ledTex) this.ledTex.needsUpdate = true;
  }

  private buildSeating() {
    const S = this.scene;
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(SEAT_AREA.x1 - SEAT_AREA.x0, SEAT_AREA.y1 - SEAT_AREA.y0), std(0x151517, { roughness: 1 }));
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.copy(P((SEAT_AREA.x0 + SEAT_AREA.x1) / 2, (SEAT_AREA.y0 + SEAT_AREA.y1) / 2, 0.02));
    carpet.receiveShadow = true;
    S.add(carpet);
    this.pickable(carpet, "seats");
    const gold = std(this.th.metal, this.th.metalOpts);
    for (const y of [SEAT_AREA.y0, SEAT_AREA.y1]) this.box(SEAT_AREA.x1 - SEAT_AREA.x0, 0.03, 0.1, gold, (SEAT_AREA.x0 + SEAT_AREA.x1) / 2 - CX, 0.03, y - CY);
    const seatG = new THREE.BoxGeometry(0.46, 0.08, 0.44), backG = new THREE.BoxGeometry(0.46, 0.46, 0.06);
    const rows = (list: typeof SEATS, color: number) => {
      const m = std(color, { roughness: 0.6 });
      const a = new THREE.InstancedMesh(seatG, m, list.length), b = new THREE.InstancedMesh(backG, m, list.length);
      const o = new THREE.Object3D();
      list.forEach(([x, y], i) => {
        o.position.copy(P(x, y, 0.46)); o.updateMatrix(); a.setMatrixAt(i, o.matrix);
        o.position.copy(P(x, y + 0.21, 0.72)); o.updateMatrix(); b.setMatrixAt(i, o.matrix);
      });
      a.castShadow = b.castShadow = true;
      S.add(a, b);
    };
    rows(SEATS.filter((s) => s[2] < 2), this.th.frontSeats);
    rows(SEATS.filter((s) => s[2] >= 2), 0x1e1e21);
    const z = ZONE_MAP.foh;
    this.pickable(this.box(z.w, 1.05, z.d, std(0x1a1a1a), z.x + z.w / 2 - CX, 0.52, z.y + z.d / 2 - CY), "foh");
    this.box(z.w + 0.6, 0.12, z.d + 0.6, std(0x0d0d0d), z.x + z.w / 2 - CX, 2.6, z.y + z.d / 2 - CY);
    for (const dx of [0.2, z.w - 0.2]) for (const dz of [0.2, z.d - 0.2]) this.box(0.08, 2.6, 0.08, gold, z.x + dx - CX, 1.3, z.y + dz - CY);
  }

  private buildTent(z: Zone) {
    const gold = std(this.th.metal, this.th.metalOpts);
    const cx = z.x + z.w / 2 - CX, cz = z.y + z.d / 2 - CY;
    this.pickable(this.box(z.w, 0.14, z.d, std(0x1c1c1c), cx, 0.07, cz), z.id);
    const n = Math.max(2, Math.round(z.w / 4) + 1);
    for (let k = 0; k < n; k++) for (const dz of [0.2, z.d - 0.2]) this.box(0.12, 3, 0.12, gold, z.x + 0.2 + ((z.w - 0.4) * k) / (n - 1) - CX, 1.5, z.y + dz - CY);
    this.pickable(this.box(z.w + 0.5, 0.25, z.d + 0.5, std(0x0e0e0e, { roughness: 0.6 }), cx, 3.12, cz), z.id);
    this.box(z.w + 0.55, 0.08, 0.06, gold, cx, 3.0, z.y + z.d + 0.27 - CY);
    const sofa = std(0xd9d2c0, { roughness: 0.9 }), table = std(0x2a2a2a);
    for (let k = 0; k < Math.floor(z.w / 3.4); k++) {
      this.box(2.2, 0.45, 0.85, sofa, z.x + 1.8 + k * 3.4 - CX, 0.36, z.y + z.d * 0.55 - CY);
      this.box(0.9, 0.4, 0.9, table, z.x + 1.8 + k * 3.4 - CX, 0.34, z.y + z.d * 0.55 + 1.1 - CY);
    }
  }

  /** A simple stand-in car, replaced by the glTF model once it loads. */
  private car(color: number, zone: string) {
    const g = new THREE.Group();
    g.userData.zone = zone;
    const body = std(color, { metalness: 0.65, roughness: 0.28 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x0c1116, metalness: 0.9, roughness: 0.1 });
    const tyre = std(0x111111, { roughness: 0.9 }), rim = std(0xc9c9c9, { metalness: 0.9, roughness: 0.2 });
    const add = (m: THREE.Mesh) => { m.castShadow = true; g.add(m); this.pickable(m, zone); return m; };
    add(new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.72, 1.86), body)).position.y = 0.62;
    add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.58, 1.62), glass)).position.set(-0.25, 1.27, 0);
    for (const wx of [-1.45, 1.45]) for (const wz of [-0.86, 0.86]) {
      const w = add(new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.26, 18), tyre));
      w.rotation.x = Math.PI / 2; w.position.set(wx, 0.37, wz);
      const rr = add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.27, 12), rim));
      rr.rotation.x = Math.PI / 2; rr.position.set(wx, 0.37, wz);
    }
    const ao = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 2.9), new THREE.MeshBasicMaterial({ map: this.aoTexture(), transparent: true, depthWrite: false }));
    ao.rotation.x = -Math.PI / 2;
    ao.position.y = 0.015;
    ao.userData.keep = true;
    ao.renderOrder = 1;
    g.add(ao);
    this.carSlots.push({ g, color });
    return g;
  }

  private loadCars() {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      "/models/car.glb",
      (gltf) => {
        if (!this.alive) return;
        const tpl = gltf.scene;
        tpl.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          m.castShadow = m.receiveShadow = true;
          const name = (m.material as THREE.Material | undefined)?.name ?? "";
          if (/licen/i.test(m.name) || /licen/i.test(name)) m.visible = false; // hide the sample's licence plate logo
        });
        const dead = new Set<THREE.Object3D>();
        for (const slot of this.carSlots) {
          const c = SkeletonUtils.clone(tpl);
          const cache = new Map<THREE.Material, THREE.Material>();
          c.traverse((o) => {
            const m = o as THREE.Mesh;
            if (!m.isMesh) return;
            m.userData.zone = slot.g.userData.zone;
            const mat = m.material as THREE.MeshPhysicalMaterial;
            if (mat && /^Paint/.test(mat.name || "")) {
              if (!cache.has(mat)) {
                const k = mat.clone();
                k.color.set(slot.color);
                k.clearcoat = Math.max(k.clearcoat || 0, 0.8);
                k.clearcoatRoughness = 0.08;
                k.roughness = Math.min(k.roughness, 0.35);
                cache.set(mat, k);
              }
              m.material = cache.get(mat) as THREE.Material;
            }
          });
          c.rotation.y = Math.PI / 2;
          c.scale.setScalar(1.03);
          for (const ch of [...slot.g.children]) {
            if (ch.userData.keep) continue;
            slot.g.remove(ch);
            ch.traverse((o) => dead.add(o));
          }
          slot.g.add(c);
          c.traverse((o) => { if ((o as THREE.Mesh).isMesh) this.pick.push(o); });
        }
        this.pick = this.pick.filter((o) => !dead.has(o));
      },
      undefined,
      (e) => console.warn("Car model failed to load; keeping the stand-in cars.", e),
    );
  }

  private buildBooths() {
    const gold = std(this.th.metal, this.th.metalOpts);
    this.stripMat = new THREE.MeshStandardMaterial({ color: this.th.strip, metalness: 0.8, roughness: 0.3, emissive: this.th.stripGlow, emissiveIntensity: this.th.ev ? 0.35 : 0 });
    const strip = this.stripMat;
    ZONES.filter((z) => z.group === "booth").forEach((z, i) => {
      const c = P(z.x + z.w / 2, z.y + z.d / 2);
      this.pickable(this.box(z.w, 0.14, z.d, std(0x141414, { roughness: 0.7 }), c.x, 0.07, c.z), z.id);
      this.box(z.w, 0.05, 0.08, strip, c.x, 0.15, c.z - z.d / 2);
      this.box(z.w, 0.05, 0.08, strip, c.x, 0.15, c.z + z.d / 2);
      this.box(0.08, 0.05, z.d, strip, c.x - z.w / 2, 0.15, c.z);
      this.box(0.08, 0.05, z.d, strip, c.x + z.w / 2, 0.15, c.z);

      if (z.facing === "c") {
        const turntable = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.28, 48), std(0x1a1a1a, { metalness: 0.4, roughness: 0.3 }));
        turntable.position.set(c.x, 0.28, c.z);
        turntable.receiveShadow = true;
        this.scene.add(turntable);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.06, 8, 64), gold);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(c.x, 0.42, c.z);
        this.scene.add(ring);
        const car = this.car(this.th.heroCar, z.id);
        car.position.set(c.x, 0.42, c.z);
        this.scene.add(car);
        this.spin.push(car);
        for (const sx of [-1, 1]) this.pickable(this.box(0.5, 4.2, 0.5, gold, c.x + sx * 3.6, 2.1, c.z - 2.6), z.id);
        if (this.th.ev) {
          // fast-charging hub: two tall DC chargers either side of the turntable
          const hub = new THREE.Group();
          hub.position.set(c.x, 0.14, c.z);
          this.scene.add(hub);
          for (const sx of [-1, 1]) this.charger(hub, sx * 3.6, 1.6, { x: sx * 1.4, z: 0.2 }, z.id, 2.1);
        }
        this.centreSign = new THREE.Vector3(c.x, 4.6, c.z - 2.6);
        return;
      }

      const g = new THREE.Group();
      let L: number, D: number;
      if (z.facing === "n") { L = z.w; D = z.d; g.position.set(c.x, 0, c.z + z.d / 2); g.rotation.y = Math.PI; }
      else if (z.facing === "e") { L = z.d; D = z.w; g.position.set(c.x - z.w / 2, 0, c.z); g.rotation.y = Math.PI / 2; }
      else { L = z.d; D = z.w; g.position.set(c.x + z.w / 2, 0, c.z); g.rotation.y = -Math.PI / 2; }
      this.scene.add(g);
      g.userData.signLength = L;
      g.userData.zone = z.id;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(L, 3.2, 0.25), std(0x0f0f0f, { roughness: 0.5 }));
      wall.position.set(0, 1.74, 0.12);
      wall.castShadow = wall.receiveShadow = true;
      g.add(wall);
      this.pickable(wall, z.id);
      const band = new THREE.Mesh(new THREE.BoxGeometry(L, 0.08, 0.3), strip);
      band.position.set(0, 3.36, 0.14);
      g.add(band);
      const desk = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 0.55), std(0xeeeeee, { roughness: 0.4 }));
      desk.position.set(L / 2 - 1.0, 0.64, D - 0.6);
      desk.castShadow = true;
      g.add(desk);
      for (let k = 0; k < 2; k++) {
        const car = this.car(CAR_COLORS[(i * 2 + k + 1) % CAR_COLORS.length], z.id);
        car.position.set(k ? 1.6 : -1.6, 0.14, k ? D * 0.68 : D * 0.33);
        car.rotation.y = k ? -0.25 : 0.25;
        g.add(car);
        if (this.th.ev) this.charger(g, k ? 2.85 : -2.85, 0.55, { x: car.position.x + (k ? 1.2 : -1.2), z: car.position.z - 0.75 }, z.id);
      }
      (this.boothGroups ||= {})[z.id] = g;
    });
  }

  private boothGroups: Record<string, THREE.Group> | undefined;
  private centreSign: THREE.Vector3 | undefined;

  private buildSigns() {
    ZONES.filter((z) => z.group === "booth" && z.exhibitor).forEach((z) => {
      const ex = z.exhibitor!;
      const l = this.opts.locale;
      const tex = this.textTexture(ex.name[l], ex.name[l === "ar" ? "en" : "ar"], { w: 1024, h: 220, fs: 84, fs2: 40, bg: "#0b0b0b" });
      const m = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25, roughness: 0.5 });
      this.signs.push(m);
      const g = this.boothGroups?.[z.id];
      if (g) {
        const L = g.userData.signLength as number;
        const p = new THREE.Mesh(new THREE.PlaneGeometry(L - 0.3, ((L - 0.3) * 220) / 1024), m);
        p.position.set(0, 2.75, 0.26);
        g.add(p);
        this.pickable(p, z.id);
      } else {
        const at = this.centreSign;
        if (!at) return;
        const p = new THREE.Mesh(new THREE.BoxGeometry(7.7, 1.5, 0.2), m);
        p.position.copy(at);
        this.scene.add(p);
        this.pickable(p, z.id);
      }
    });
    const l = this.opts.locale;
    const [gateMain, gateSub] = this.th.gate[l];
    const gt = this.textTexture(gateMain, gateSub, { w: 1400, h: 180, fs: 80, fs2: 34, bg: "#0b0b0b" });
    const gm = new THREE.MeshStandardMaterial({ map: gt, emissive: 0xffffff, emissiveMap: gt, emissiveIntensity: 0.3 });
    this.signs.push(gm);
    for (const side of [1, -1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(13.4, (13.4 * 180) / 1400), gm);
      p.position.copy(P(28.1, 53.5 + side * 0.36, 5.6));
      if (side < 0) p.rotation.y = Math.PI;
      this.scene.add(p);
    }
  }

  /** A charging post (in the parent's local frame) with a cable to the car's charge port. */
  private charger(parent: THREE.Object3D, x: number, z: number, port: { x: number; z: number }, zone: string, h = 1.45) {
    this.chargerGlow ||= new THREE.MeshStandardMaterial({ color: 0x0b2b2a, emissive: this.th.stripGlow, emissiveIntensity: 1.2, roughness: 0.3 });
    const body = new THREE.MeshStandardMaterial({ color: 0xf1f4f6, metalness: 0.2, roughness: 0.35 });
    const dark = std(0x10161c, { roughness: 0.4 });
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.42, h, 0.3), body);
    post.position.set(x, h / 2, z);
    post.castShadow = true;
    parent.add(post);
    this.pickable(post, zone);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.02), dark);
    screen.position.set(x, h * 0.72, z + 0.16);
    parent.add(screen);
    const ring = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 0.32), this.chargerGlow);
    ring.position.set(x, h - 0.06, z);
    parent.add(ring);
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.06, h * 0.5, 0.02), this.chargerGlow);
    led.position.set(x, h * 0.4, z + 0.16);
    parent.add(led);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, h * 0.5, z + 0.18),
      new THREE.Vector3((x + port.x) / 2, 0.12, (z + port.z) / 2 + 0.2),
      new THREE.Vector3(port.x, 0.75, port.z),
    ]);
    const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.03, 6, false), dark);
    cable.castShadow = true;
    parent.add(cable);
  }

  /** Glowing chevrons on the floor from the gate, around the centre pavilion, to the stage seating. */
  private buildEnergyPath() {
    const routes: [number, number][][] = [
      [[28.2, 52.5], [28.2, 45.3], [24.3, 44.6], [24.3, 30.5], [28.4, 27.8]],
      [[28.2, 45.3], [36, 44.6], [36, 30.5], [33.6, 27.8]],
    ];
    const tileGeo = new THREE.PlaneGeometry(0.26, 0.9);
    for (const route of routes) {
      for (let s = 0; s < route.length - 1; s++) {
        const [ax, ay] = route[s], [bx, by] = route[s + 1];
        const len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.floor(len / 1.25));
        const ang = Math.atan2(bx - ax, by - ay);
        for (let k = 0; k < n; k++) {
          const f = (k + 0.5) / n;
          for (const side of [-1, 1]) {
            const m = new THREE.Mesh(tileGeo, new THREE.MeshStandardMaterial({ color: 0x0d2a24, emissive: this.th.stripGlow, emissiveIntensity: 0.4, transparent: true, opacity: 0.95 }));
            m.rotation.x = -Math.PI / 2;
            m.rotation.z = ang + Math.PI + side * 0.75;
            const p = P(ax + (bx - ax) * f, ay + (by - ay) * f, 0.03);
            m.position.set(p.x + Math.cos(ang) * side * 0.22, p.y, p.z - Math.sin(ang) * side * 0.22);
            this.scene.add(m);
            this.flowTiles.push(m);
          }
        }
      }
    }
  }

  private buildGate() {
    const gold = std(this.th.metal, this.th.metalOpts);
    for (const x of [21.2, 35]) this.pickable(this.box(1.1, 6.4, 1.1, gold, x - CX, 3.2, 53.5 - CY), "gate");
    this.pickable(this.box(15, 1.5, 0.6, std(0x0d0d0d), 28.1 - CX, 5.6, 53.5 - CY), "gate");
    const desk = std(0xeeeeee, { roughness: 0.4 });
    for (const x of [23, 26.4, 29.8, 33.2]) this.pickable(this.box(2.4, 1.05, 0.7, desk, x - CX, 0.53, 57.6 - CY), "gate");
    for (let k = 0; k < 6; k++) for (const x of [22, 34.2]) this.box(0.1, 1, 0.1, gold, x - CX, 0.5, 55 + k * 0.9 - CY);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(16.2, 8.4), new THREE.MeshBasicMaterial({ visible: false }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.copy(P(28.3, 57, 0.05));
    this.scene.add(floor);
    this.pickable(floor, "gate");
  }

  private buildMasts() {
    const pole = std(0xb9bdc1, { metalness: 0.6, roughness: 0.35 });
    this.mastLamp = new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0xfff1d0, emissiveIntensity: 0 });
    for (const [x, y] of MASTS) {
      const b = P(x, y);
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.2, 12, 10), pole);
      p.position.set(b.x, 6, b.z);
      p.castShadow = true;
      this.scene.add(p);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.12), pole);
      bar.position.set(b.x, 12, b.z);
      this.scene.add(bar);
      for (const dx of [-0.8, -0.27, 0.27, 0.8]) {
        const l = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.55), this.mastLamp);
        l.position.set(b.x + dx, 12.25, b.z);
        l.rotation.x = 0.4;
        this.scene.add(l);
      }
      const light = new THREE.PointLight(0xffe9c4, 1400, 46, 2);
      light.position.set(b.x, 11.5, b.z);
      this.scene.add(light);
      this.nightOnly.push(light);
    }
  }

  private buildSelection() {
    this.selGroup.visible = false;
    this.selMat = new THREE.MeshBasicMaterial({ color: this.th.select, transparent: true, opacity: 0.95, depthTest: false });
    this.selBars = [0, 1, 2, 3].map(() => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, 0.22), this.selMat);
      b.renderOrder = 5;
      this.selGroup.add(b);
      return b;
    });
    this.selFill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: this.th.select, transparent: true, opacity: 0.14, depthWrite: false }));
    this.selFill.rotation.x = -Math.PI / 2;
    this.selGroup.add(this.selFill);
  }

  private buildLabels() {
    for (const z of ZONES) {
      const cx = z.x + z.w / 2, cy = z.y + z.d / 2;
      const { main, other } = this.primary(z);
      if (z.group === "booth") this.label(main, `${z.tag} · ${other}`, cx, cy, z.facing === "c" ? 6.6 : 5.2, 0.5);
      else if (z.id === "stage") this.label(main, other, cx, cy - 2, 11, 0.7);
      else if (z.id === "seats") this.label(main, other, cx, cy, 3.2, 0.62);
      else if (z.id === "foh") this.label(main, other, cx, cy, 4.2, 0.42);
      else if (z.id === "gate") this.label(main, other, cx, cy + 2, 7.8, 0.7);
      else this.label(main, other, cx, cy, 5, 0.55);
    }
    const ar = this.opts.locale === "ar";
    this.label(ar ? "القرية الرياضية" : "Sports Village", ar ? "Sports Village" : "القرية الرياضية", 31, -66, 12, 0.6);
    this.label(ar ? "الشارع الشرقي" : "East street", ar ? "East street" : "الشارع الشرقي", 72, 30, 2.5, 0.5);
    this.label(ar ? "الشارع الفرعي" : "Side street", ar ? "Side street" : "الشارع الفرعي", -9, 24, 2.5, 0.5);
  }

  // ---------- time of day ----------
  private applyTime() {
    const n = this.night, S = this.scene;
    S.background = n ? this.bgNight : this.bgDay ?? new THREE.Color(0xa9cbef);
    S.environment = n ? this.envNight : this.envDay;
    S.fog = new THREE.Fog(n ? 0x0a0a10 : 0xd9e3ee, n ? 90 : 170, n ? 420 : 560);
    this.hemi.intensity = n ? 0.12 : 0.55;
    this.hemi.color.set(n ? 0x6c7fa8 : 0xcfe3ff);
    this.sun.visible = !n;
    this.nightOnly.forEach((l) => (l.visible = n));
    this.renderer.toneMappingExposure = n ? 1.15 : 1.0;
    this.lampMat.emissiveIntensity = n ? 3 : 0;
    this.mastLamp.emissiveIntensity = n ? (this.th.ev ? 1.6 : 3) : 0;
    this.stripMat.emissiveIntensity = n ? 2.4 : 0;
    this.ledMat.emissiveIntensity = n ? 1.4 : 0.9;
    this.bldMat.emissiveIntensity = n ? 0.85 : 0;
    this.signs.forEach((m) => (m.emissiveIntensity = n ? 0.9 : 0.25));
    this.emissive.forEach((m) => (m.emissiveIntensity = n ? 2.2 : 0.4));
    if (this.chargerGlow) this.chargerGlow.emissiveIntensity = n ? 3 : 1.2;
  }

  // ---------- camera + input ----------
  private fit() {
    const p = this.cv.parentElement as HTMLElement;
    const w = p.clientWidth, h = p.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private bindInput() {
    const cv = this.cv;
    const ptrs = new Map<number, { x: number; y: number }>();
    let down: { b: number; sh: boolean } | null = null;
    let moved = 0;
    let pinch: { d: number; mx: number; my: number } | null = null;
    const pan = (dx: number, dy: number) => {
      const o = this.orb, k = o.r * 0.0016, fx = Math.sin(o.th), fz = Math.cos(o.th);
      o.t.x += (-dx * fz - dy * fx) * k;
      o.t.z += (dx * fx - dy * fz) * k;
    };
    const onContext = (e: Event) => e.preventDefault();
    const onDown = (e: PointerEvent) => {
      cv.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      down = { b: e.button, sh: e.shiftKey };
      moved = 0;
      this.goal = null;
      cv.style.cursor = "grabbing";
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      }
    };
    const onMove = (e: PointerEvent) => {
      const prev = ptrs.get(e.pointerId);
      if (!prev) return;
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved += Math.abs(dx) + Math.abs(dy);
      const o = this.orb;
      if (ptrs.size === 2 && pinch) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        o.r = Math.min(260, Math.max(8, (o.r * pinch.d) / Math.max(1, d)));
        pan(mx - pinch.mx, my - pinch.my);
        pinch = { d, mx, my };
        return;
      }
      if (down && (down.b === 2 || down.b === 1 || down.sh)) pan(dx, dy);
      else { o.th -= dx * 0.006; o.phi = Math.min(1.53, Math.max(0.02, o.phi - dy * 0.005)); }
    };
    const onUp = (e: PointerEvent) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      cv.style.cursor = "grab";
      if (ptrs.size === 0 && down && moved < 6 && down.b === 0) this.pickAt(e.clientX, e.clientY);
      if (ptrs.size === 0) down = null;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      this.goal = null;
      const o = this.orb;
      o.r = Math.min(260, Math.max(8, o.r * (1 + Math.sign(e.deltaY) * Math.min(0.25, Math.abs(e.deltaY) * 0.0012))));
    };
    cv.addEventListener("contextmenu", onContext);
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("pointercancel", onUp);
    cv.addEventListener("wheel", onWheel, { passive: false });
    this.disposers.push(() => {
      cv.removeEventListener("contextmenu", onContext);
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp);
      cv.removeEventListener("pointercancel", onUp);
      cv.removeEventListener("wheel", onWheel);
    });
  }

  private pickAt(x: number, y: number) {
    const r = this.cv.getBoundingClientRect();
    const v = new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(v, this.camera);
    const hit = this.ray.intersectObjects(this.pick, false).find((h) => h.object.userData.zone);
    this.opts.onSelect(hit ? (hit.object.userData.zone as string) : null);
  }

  private tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const o = this.orb;
    if (this.goal) {
      const g = this.goal, k = 1 - Math.pow(0.002, dt);
      o.t.lerp(g.t, k);
      o.r += (g.r - o.r) * k;
      o.phi += (g.phi - o.phi) * k;
      let dth = g.th - o.th;
      dth = Math.atan2(Math.sin(dth), Math.cos(dth));
      o.th += dth * k;
      if (Math.abs(g.r - o.r) < 0.05 && o.t.distanceTo(g.t) < 0.02 && Math.abs(dth) < 0.002) this.goal = null;
    }
    const c = this.camera, sp = Math.sin(o.phi);
    c.position.set(o.t.x + o.r * sp * Math.sin(o.th), o.t.y + o.r * Math.cos(o.phi), o.t.z + o.r * sp * Math.cos(o.th));
    if (o.phi < 0.05) c.up.set(-Math.sin(o.th), 0, -Math.cos(o.th));
    else c.up.set(0, 1, 0);
    c.lookAt(o.t);
    this.spin.forEach((s) => (s.rotation.y += dt * 0.35));
    if (this.flowTiles.length) {
      // a pulse runs along the energy path from the gate towards the stage
      const t = performance.now() / 1000;
      const base = this.night ? 0.5 : 0.25, peak = this.night ? 4 : 1.6;
      this.flowTiles.forEach((m, i) => {
        const ph = ((t * 6 - Math.floor(i / 2) * 0.55) % 9 + 9) % 9;
        (m.material as THREE.MeshStandardMaterial).emissiveIntensity = base + peak * Math.max(0, 1 - ph / 2.2);
      });
    }
    if (this.selGroup.visible) this.selMat.opacity = 0.65 + 0.35 * Math.sin(performance.now() / 260);
    if (this.night && this.composer) this.composer.render();
    else this.renderer.render(this.scene, c);
  }
}
