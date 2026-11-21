// Venue model v2: the Sports Village parking yard traced from the satellite view, with the
// Sports Village beside it and the expo designed on top. Archviz look: real ground imagery,
// soft daylight with ambient occlusion, rounded geometry, clean HTML pins instead of sprites.

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { ZONES, type Tier } from "@/lib/expo";
import { ZONES_V2 } from "@/lib/venue";
import type { Locale } from "@/lib/i18n";
import {
  BANK_COLOR, ENERGY_ROUTES, FLOODLIGHTS, TIERS, TIER_COLOR, LAYOUT_ORIGIN, LAYOUT_YAW, LOT_LOCAL, LOT_TEXTURE, OPEN_EDGES, PLACES, SEATS_V2, SITE_IMAGE,
  STREET_LAMPS, VILLAGE, type Place,
} from "@/lib/venue";

export type ViewKey = "perspective" | "top" | "gate" | "seats";
export type LayerKey = "labels" | "lines" | "surroundings";

const TEAL = 0x22e0c8;
const LIME = 0xb6f23a;
const DEG = Math.PI / 180;

export type Venue2Options = {
  locale: Locale;
  fonts: { arabic: string; latin: string };
  onSelect: (zoneId: string | null) => void;
  onReady: () => void;
};

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, g: c.getContext("2d") as CanvasRenderingContext2D };
}

function tex(c: HTMLCanvasElement, srgb = true, repeat?: [number, number]) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

const mat = (color: THREE.ColorRepresentation, o: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...o });

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Point-in-polygon for the layout-frame lot outline. */
function insideLot(x: number, z: number) {
  let inside = false;
  for (let i = 0, j = LOT_LOCAL.length - 1; i < LOT_LOCAL.length; j = i++) {
    const [xi, zi] = LOT_LOCAL[i], [xj, zj] = LOT_LOCAL[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export class VenueScene2 {
  private renderer: THREE.WebGLRenderer;
  private labels: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.5, 2000);
  private controls: OrbitControls;
  private composer: EffectComposer;
  private ao: GTAOPass;
  private bloom: UnrealBloomPass;
  private site = new THREE.Group(); // satellite frame
  private layout = new THREE.Group(); // design frame (aligned to the courts edge)
  private village = new THREE.Group();
  private pinGroup = new THREE.Group();
  private alive = true;
  private raf = 0;
  private ro: ResizeObserver;
  private clock = new THREE.Clock();
  private night = false;
  private tween: { p0: THREE.Vector3; p1: THREE.Vector3; t0: THREE.Vector3; t1: THREE.Vector3; start: number; dur: number } | null = null;
  private pick: THREE.Object3D[] = [];
  private pins = new Map<string, HTMLElement>();
  private spin: THREE.Object3D[] = [];
  private flow: THREE.MeshStandardMaterial[] = [];
  private nightOnly: THREE.Light[] = [];
  private glowMats: { m: THREE.MeshStandardMaterial; day: number; night: number }[] = [];
  private carSlots: { g: THREE.Group; color: number; hero: boolean }[] = [];
  private lotMat!: THREE.MeshStandardMaterial;
  private linesOn = false;
  private hemi!: THREE.HemisphereLight;
  private siteMat!: THREE.MeshStandardMaterial;
  private sun!: THREE.DirectionalLight;
  private bgDay: THREE.Texture;
  private bgNight: THREE.Texture;
  private sel: { group: THREE.Group; mat: THREE.MeshBasicMaterial } | null = null;
  private selected: string | null = null;
  private disposers: (() => void)[] = [];
  private mobile: boolean;

  constructor(private cv: HTMLCanvasElement, private opts: Venue2Options) {
    this.mobile = Math.min(window.innerWidth, window.innerHeight) < 700;
    const R = new THREE.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: "high-performance", stencil: false });
    R.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.mobile ? 1.5 : 2));
    R.shadowMap.enabled = true;
    R.shadowMap.type = THREE.PCFShadowMap;
    R.toneMapping = THREE.AgXToneMapping;
    R.toneMappingExposure = 1.05;
    this.renderer = R;

    const host = cv.parentElement as HTMLElement;
    this.labels = new CSS2DRenderer();
    Object.assign(this.labels.domElement.style, { position: "absolute", inset: "0", pointerEvents: "none" });
    this.labels.domElement.className = "venue-pins";
    host.appendChild(this.labels.domElement);

    const pmrem = new THREE.PMREMGenerator(R);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.bgDay = this.gradient(["#dfe7ee", "#c9d4de", "#aebccb"]);
    this.bgNight = this.gradient(["#0b1622", "#060c14", "#03060a"]);

    this.scene.add(this.site, this.layout);
    this.layout.position.set(LAYOUT_ORIGIN[0], 0, LAYOUT_ORIGIN[1]);
    this.layout.rotation.y = LAYOUT_YAW;
    this.layout.add(this.village, this.pinGroup);

    this.buildLights();
    this.buildGround();
    this.buildLotEdges();
    this.buildStalls();
    this.buildVillage();
    this.buildStage();
    this.buildSeats();
    this.buildFoh();
    this.buildTent("vip");
    this.buildTent("media");
    this.buildGate();
    this.buildBooths();
    this.buildBanks();
    this.buildEnergyPath();
    this.buildPoles();
    this.buildSelection();

    // camera + controls
    this.controls = new OrbitControls(this.camera, cv);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 260;
    this.controls.maxPolarAngle = 1.48;
    this.controls.screenSpacePanning = false;
    this.controls.addEventListener("start", () => (this.tween = null));
    const v = this.viewPose("perspective");
    this.camera.position.copy(v.pos);
    this.controls.target.copy(v.target);

    // post-processing: ambient occlusion → bloom (evening) → tone mapping → SMAA
    this.composer = new EffectComposer(R, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.ao = new GTAOPass(this.scene, this.camera, 512, 512);
    this.ao.blendIntensity = 0.85;
    this.ao.updateGtaoMaterial({ radius: 2.2, distanceExponent: 1.4, thickness: 2, scale: 1.2, samples: this.mobile ? 8 : 16 });
    this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: this.mobile ? 8 : 16 });
    this.composer.addPass(this.ao);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.4, 0.35, 0.92);
    this.bloom.enabled = false;
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(new SMAAPass());

    this.ro = new ResizeObserver(() => this.fit());
    this.ro.observe(host);
    this.fit();
    this.bindPicking();
    this.applyTime();
    this.loadCars();

    const fontsReady = document.fonts?.load
      ? Promise.all([document.fonts.load(`800 40px ${opts.fonts.arabic}`), document.fonts.load(`700 30px ${opts.fonts.latin}`)]).catch(() => undefined)
      : Promise.resolve();
    fontsReady.then(() => {
      if (!this.alive) return;
      this.buildSigns();
      this.buildPins();
      opts.onReady();
    });

    const loop = () => {
      if (!this.alive) return;
      this.raf = requestAnimationFrame(loop);
      this.tick();
    };
    loop();
  }

  // ------------------------------------------------------------------ public API
  setNight(n: boolean) { this.night = n; this.applyTime(); }

  setLayer(key: LayerKey, on: boolean) {
    if (key === "labels") this.labels.domElement.style.display = on ? "" : "none";
    if (key === "surroundings") this.village.visible = on;
    if (key === "lines") { this.linesOn = on; if (this.stalls) this.stalls.visible = on; }
  }

  private stalls: THREE.Mesh | null = null;

  /** Today's parking layout: 2.5 m bays, 5 m deep, along every walled edge. */
  private buildStalls() {
    const X0 = -1, X1 = 64, Z0 = -1, Z1 = 67, S = 32;
    const { c, g } = canvas((X1 - X0) * S, (Z1 - Z0) * S);
    const P = (x: number, z: number): [number, number] => [(x - X0) * S, (z - Z0) * S];
    g.beginPath();
    LOT_LOCAL.forEach(([x, z], i) => { const [u, v] = P(x, z); if (i) g.lineTo(u, v); else g.moveTo(u, v); });
    g.closePath();
    g.clip();
    g.strokeStyle = "rgba(245,245,240,.9)";
    g.lineWidth = 0.12 * S;
    g.lineCap = "butt";
    const n = LOT_LOCAL.length;
    for (let i = 0; i < n; i++) {
      if (i === 6 || i === 7) continue;
      const a = LOT_LOCAL[i], b = LOT_LOCAL[(i + 1) % n];
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
      if (len < 6) continue;
      let nx = -dz / len, nz = dx / len;
      if (!insideLot((a[0] + b[0]) / 2 + nx * 2, (a[1] + b[1]) / 2 + nz * 2)) { nx = -nx; nz = -nz; }
      const ux = dx / len, uz = dz / len;
      const bays = Math.floor((len - 3) / 2.5);
      const start = (len - bays * 2.5) / 2;
      g.beginPath();
      for (let k = 0; k <= bays; k++) {
        const t = start + k * 2.5;
        const [u0, v0] = P(a[0] + ux * t + nx * 0.4, a[1] + uz * t + nz * 0.4);
        const [u1, v1] = P(a[0] + ux * t + nx * 5.4, a[1] + uz * t + nz * 5.4);
        g.moveTo(u0, v0); g.lineTo(u1, v1);
      }
      const [s0, t0] = P(a[0] + ux * start + nx * 5.4, a[1] + uz * start + nz * 5.4);
      const [s1, t1] = P(a[0] + ux * (start + bays * 2.5) + nx * 5.4, a[1] + uz * (start + bays * 2.5) + nz * 5.4);
      g.moveTo(s0, t0); g.lineTo(s1, t1);
      g.stroke();
    }
    // centre double row
    g.beginPath();
    for (let k = 0; k <= 12; k++) { const x = 12 + k * 2.5; for (const [z0, z1] of [[25, 30], [30, 35]]) { const [u0, v0] = P(x, z0), [u1, v1] = P(x, z1); g.moveTo(u0, v0); g.lineTo(u1, v1); } }
    { const [u0, v0] = P(12, 30), [u1, v1] = P(42, 30); g.moveTo(u0, v0); g.lineTo(u1, v1); }
    g.stroke();
    const t = tex(c);
    const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((X0 + X1) / 2, 0.035, (Z0 + Z1) / 2);
    mesh.receiveShadow = true;
    mesh.visible = this.linesOn;
    this.layout.add(mesh);
    this.stalls = mesh;
  }

  setView(key: ViewKey) {
    const v = this.viewPose(key);
    this.flyTo(v.pos, v.target, 1.4);
  }

  select(id: string | null) {
    this.selected = id;
    this.pins.forEach((el, k) => el.classList.toggle("is-active", k === id));
    if (!id || !PLACES[id]) { if (this.sel) this.sel.group.visible = false; return; }
    const p = PLACES[id];
    this.placeSelection(p);
    const target = this.L(p.x, p.kind === "stage" ? 2 : 0.8, p.z);
    const off = this.camera.position.clone().sub(this.controls.target);
    off.y = Math.max(off.y, 6);
    const dist = Math.max(18, Math.max(p.w, p.d) * 2.6);
    off.setLength(dist);
    if (off.y < dist * 0.45) { off.y = dist * 0.55; off.setLength(dist); }
    this.flyTo(target.clone().add(off), target, 1.1);
  }

  dispose() {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.disposers.forEach((d) => d());
    this.controls.dispose();
    this.labels.domElement.remove();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const ms = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      ms.forEach((x) => { Object.values(x).forEach((v) => v instanceof THREE.Texture && v.dispose()); x.dispose(); });
    });
    this.composer.dispose();
    this.renderer.dispose();
  }

  // ------------------------------------------------------------------ helpers
  /** Layout-frame point → world. */
  private L(x: number, y: number, z: number) {
    this.layout.updateMatrixWorld();
    return this.layout.localToWorld(new THREE.Vector3(x, y, z));
  }

  private gradient(stops: string[]) {
    const { c, g } = canvas(4, 512);
    const gr = g.createLinearGradient(0, 0, 0, 512);
    stops.forEach((s, i) => gr.addColorStop(i / (stops.length - 1), s));
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, 512);
    return tex(c);
  }

  private add(parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, zone?: string) {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    if (zone) { mesh.userData.zone = zone; this.pick.push(mesh); }
    return mesh;
  }

  private rbox(w: number, h: number, d: number, r = 0.05) {
    return new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.01, h / 2.01, d / 2.01));
  }

  private glow(color: number, day: number, night: number) {
    const m = new THREE.MeshStandardMaterial({ color: 0x0a1a1a, emissive: color, emissiveIntensity: day, roughness: 0.4 });
    this.glowMats.push({ m, day, night });
    return m;
  }

  private placed(p: Place) {
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    g.rotation.y = -p.rot * DEG;
    this.layout.add(g);
    return g;
  }

  private fontFor(s: string) {
    return /[؀-ۿ]/.test(s) ? `${this.opts.fonts.arabic}, sans-serif` : `${this.opts.fonts.latin}, sans-serif`;
  }

  private fitText(g: CanvasRenderingContext2D, text: string, weight: number, size: number, maxW: number) {
    let px = size;
    g.font = `${weight} ${px}px ${this.fontFor(text)}`;
    while (px > 12 && g.measureText(text).width > maxW) { px -= 2; g.font = `${weight} ${px}px ${this.fontFor(text)}`; }
  }

  private signTexture(main: string, sub: string, w = 1024, h = 256, bg = "#0d1217", accent = "#22E0C8") {
    const { c, g } = canvas(w, h);
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = accent;
    g.fillRect(0, h - 10, w, 10);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#ffffff";
    this.fitText(g, main, 800, Math.round(h * 0.36), w - 80);
    g.fillText(main, w / 2, h * 0.4);
    if (sub) {
      g.fillStyle = accent;
      const s = /[؀-ۿ]/.test(sub) ? sub : sub.toUpperCase();
      this.fitText(g, s, 700, Math.round(h * 0.16), w - 120);
      g.fillText(s, w / 2, h * 0.74);
    }
    return tex(c);
  }

  // ------------------------------------------------------------------ lights & ground
  private buildLights() {
    this.hemi = new THREE.HemisphereLight(0xe8f0ff, 0x6e6a60, 0.6);
    this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xfff3e2, 3.2);
    sun.position.set(-60, 95, 70);
    sun.castShadow = true;
    sun.shadow.mapSize.set(this.mobile ? 2048 : 4096, this.mobile ? 2048 : 4096);
    Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 20, far: 320 });
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.04;
    sun.shadow.radius = 3;
    sun.target.position.set(-20, 0, 0);
    this.scene.add(sun, sun.target);
    this.sun = sun;
  }

  private buildGround() {
    const loader = new THREE.TextureLoader();
    // satellite context, fading into the background at its edges
    const sw = SITE_IMAGE.x1 - SITE_IMAGE.x0, sh = SITE_IMAGE.z1 - SITE_IMAGE.z0;
    const siteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, depthWrite: false });
    this.siteMat = siteMat;
    loader.load(SITE_IMAGE.url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; siteMat.map = t; siteMat.needsUpdate = true; });
    const site = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), siteMat);
    site.rotation.x = -Math.PI / 2;
    site.position.set((SITE_IMAGE.x0 + SITE_IMAGE.x1) / 2, -0.02, (SITE_IMAGE.z0 + SITE_IMAGE.z1) / 2);
    site.receiveShadow = true;
    site.renderOrder = -2;
    this.site.add(site);

    // the yard surface, with its painted lines traced from the satellite
    const shape = new THREE.Shape();
    LOT_LOCAL.forEach(([x, z], i) => { const w = this.L(x, 0, z); if (i) shape.lineTo(w.x, -w.z); else shape.moveTo(w.x, -w.z); });
    const geo = new THREE.ShapeGeometry(shape);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    const { x0, x1, z0, z1 } = LOT_TEXTURE;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - x0) / (x1 - x0), 1 - (-pos.getY(i) - z0) / (z1 - z0));
    geo.rotateX(-Math.PI / 2);
    this.lotMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.93 });
    const lot = new THREE.Mesh(geo, this.lotMat);
    lot.position.y = 0.02;
    lot.receiveShadow = true;
    this.site.add(lot);
    const load = (url: string) =>
      loader.load(url, (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        this.lotMat.map = t;
        this.lotMat.needsUpdate = true;
      });
    load(LOT_TEXTURE.plain);
  }

  private concreteTexture(panel = 4) {
    const { c, g } = canvas(512, 256);
    g.fillStyle = "#d8cfbd";
    g.fillRect(0, 0, 512, 256);
    const r = rng(9);
    for (let i = 0; i < 9000; i++) {
      const v = (196 + r() * 34) | 0;
      g.fillStyle = `rgba(${v},${v - 6},${v - 22},.28)`;
      g.fillRect(r() * 512, r() * 256, 2, 2);
    }
    g.fillStyle = "rgba(110,100,84,.45)";
    g.fillRect(0, 0, 3, 256);
    g.fillRect(256, 0, 2, 256);
    g.fillStyle = "rgba(255,255,255,.35)";
    g.fillRect(0, 0, 512, 6);
    return tex(c, true, [1 / panel, 1]);
  }

  private buildLotEdges() {
    const wallTex = this.concreteTexture();
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 });
    const capMat = mat(0xece6da, { roughness: 0.8 });
    const curbGeo = this.rbox(1, 0.16, 0.3, 0.03);
    const curbW: THREE.Matrix4[] = [], curbB: THREE.Matrix4[] = [];
    const cypress: THREE.Matrix4[] = [];
    const o = new THREE.Object3D();
    const n = LOT_LOCAL.length;
    for (let i = 0; i < n; i++) {
      const a = LOT_LOCAL[i], b = LOT_LOCAL[(i + 1) % n];
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
      const ang = Math.atan2(dz, dx);
      // outward normal
      let nx = dz / len, nz = -dx / len;
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      if (insideLot(mx + nx * 0.5, mz + nz * 0.5)) { nx = -nx; nz = -nz; }
      const entrance = i === 6 || i === 7;
      // black / white curb
      if (!entrance) {
        const segs = Math.max(1, Math.round(len));
        for (let k = 0; k < segs; k++) {
          const f = (k + 0.5) / segs;
          o.position.set(a[0] + dx * f - nx * 0.15, 0.08, a[1] + dz * f - nz * 0.15);
          o.rotation.set(0, -ang, 0);
          o.scale.set(len / segs, 1, 1);
          o.updateMatrix();
          (k % 2 ? curbB : curbW).push(o.matrix.clone());
        }
      }
      if (OPEN_EDGES.has(i)) continue;
      // retaining wall with a light cap
      const h = 2.6;
      const wallGeo = new THREE.BoxGeometry(len + 0.35, h, 0.35);
      const uv = wallGeo.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (len + 0.35), uv.getY(k));
      const wall = this.add(this.layout, wallGeo, wallMat, mx + nx * 0.25, h / 2, mz + nz * 0.25);
      wall.rotation.y = -ang;
      const cap = this.add(this.layout, new THREE.BoxGeometry(len + 0.45, 0.12, 0.5), capMat, mx + nx * 0.25, h + 0.06, mz + nz * 0.25);
      cap.rotation.y = -ang;
      // cypress row along the wall (as in the photos)
      const cnt = Math.floor(len / 2.6);
      for (let k = 0; k < cnt; k++) {
        const f = (k + 0.5) / cnt;
        o.position.set(a[0] + dx * f - nx * 0.75, 0, a[1] + dz * f - nz * 0.75);
        o.rotation.set(0, k * 1.7, 0);
        const s = 0.85 + ((k * 37) % 10) / 30;
        o.scale.set(s, s * (0.9 + ((k * 13) % 7) / 20), s);
        o.updateMatrix();
        cypress.push(o.matrix.clone());
      }
    }
    const inst = (geo: THREE.BufferGeometry, m: THREE.Material, list: THREE.Matrix4[], shadows = true) => {
      const im = new THREE.InstancedMesh(geo, m, list.length);
      list.forEach((mm, i) => im.setMatrixAt(i, mm));
      im.castShadow = shadows;
      im.receiveShadow = true;
      this.layout.add(im);
      return im;
    };
    inst(curbGeo, mat(0xf2f2ee, { roughness: 0.6 }), curbW, false);
    inst(curbGeo, mat(0x1c1d1f, { roughness: 0.6 }), curbB, false);
    // cypress: a slim spindle on a short trunk
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(0.42 * Math.sin(Math.PI * Math.pow(t, 0.8)) * (1 - t * 0.25), 0.4 + t * 3.4)); }
    const crown = new THREE.LatheGeometry(pts, 9);
    const trunk = new THREE.CylinderGeometry(0.06, 0.08, 0.5, 6).translate(0, 0.25, 0);
    inst(crown, mat(0x2f4630, { roughness: 0.95, flatShading: true }), cypress);
    inst(trunk, mat(0x4a3b2c), cypress, false);
  }

  // ------------------------------------------------------------------ Sports Village
  private courtTexture(kind: "padel" | "basket", w: number, d: number) {
    const s = 32;
    const { c, g } = canvas(w * s, d * s);
    g.fillStyle = kind === "padel" ? "#2b5fc0" : "#8f9fb3";
    g.fillRect(0, 0, w * s, d * s);
    g.strokeStyle = "rgba(255,255,255,.95)";
    g.lineWidth = 0.08 * s;
    if (kind === "padel") {
      g.strokeRect(0.1 * s, 0.1 * s, (w - 0.2) * s, (d - 0.2) * s);
      g.beginPath();
      g.moveTo(0, (d / 2) * s); g.lineTo(w * s, (d / 2) * s);
      g.moveTo(0, (d / 2 - 6.95) * s); g.lineTo(w * s, (d / 2 - 6.95) * s);
      g.moveTo(0, (d / 2 + 6.95) * s); g.lineTo(w * s, (d / 2 + 6.95) * s);
      g.moveTo((w / 2) * s, (d / 2 - 6.95) * s); g.lineTo((w / 2) * s, (d / 2 + 6.95) * s);
      g.stroke();
    } else {
      g.fillStyle = "#3d5a8a";
      g.fillRect(0, 0, w * s, 5.8 * s);
      g.fillRect(0, (d - 5.8) * s, w * s, 5.8 * s);
      g.strokeRect(0.1 * s, 0.1 * s, (w - 0.2) * s, (d - 0.2) * s);
      g.beginPath(); g.moveTo(0, (d / 2) * s); g.lineTo(w * s, (d / 2) * s); g.stroke();
      g.beginPath(); g.arc((w / 2) * s, (d / 2) * s, 1.8 * s, 0, Math.PI * 2); g.stroke();
      for (const end of [0, 1]) {
        const y = end ? d * s : 0, dir = end ? -1 : 1;
        g.strokeRect((w / 2 - 2.45) * s, end ? (d - 5.8) * s : 0, 4.9 * s, 5.8 * s);
        g.beginPath(); g.arc((w / 2) * s, y + dir * 1.575 * s, 6.75 * s, end ? Math.PI : 0, end ? 2 * Math.PI : Math.PI); g.stroke();
      }
    }
    return tex(c);
  }

  private flat(parent: THREE.Object3D, w: number, d: number, m: THREE.Material, x: number, y: number, z: number, h = 0.06) {
    return this.add(parent, new THREE.BoxGeometry(w, h, d), m, x, y + h / 2, z);
  }

  private buildVillage() {
    const V = this.village, Vd = VILLAGE;
    // walkway between the yard and the courts
    const pav = canvas(256, 256);
    pav.g.fillStyle = "#b9b4aa"; pav.g.fillRect(0, 0, 256, 256);
    pav.g.strokeStyle = "rgba(90,86,80,.35)"; pav.g.lineWidth = 2;
    for (let i = 0; i <= 256; i += 32) { pav.g.beginPath(); pav.g.moveTo(i, 0); pav.g.lineTo(i, 256); pav.g.moveTo(0, i); pav.g.lineTo(256, i); pav.g.stroke(); }
    const w = Vd.walkway;
    this.flat(V, w.x1 - w.x0, w.z1 - w.z0, new THREE.MeshStandardMaterial({ map: tex(pav.c, true, [(w.x1 - w.x0) / 4, (w.z1 - w.z0) / 4]), roughness: 0.9 }), (w.x0 + w.x1) / 2, 0, (w.z0 + w.z1) / 2, 0.08);

    // padel court with glass walls
    const pd = Vd.padel;
    this.flat(V, pd.pad.x1 - pd.pad.x0, pd.pad.z1 - pd.pad.z0, mat(0x9e4a3c, { roughness: 0.9 }), (pd.pad.x0 + pd.pad.x1) / 2, 0, (pd.pad.z0 + pd.pad.z1) / 2, 0.08);
    this.flat(V, pd.court.w, pd.court.d, new THREE.MeshStandardMaterial({ map: this.courtTexture("padel", pd.court.w, pd.court.d), roughness: 0.85 }), pd.court.x, 0.08, pd.court.z, 0.03);
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xcfe6ee, roughness: 0.05, transmission: 0.0, transparent: true, opacity: 0.22, metalness: 0, depthWrite: false });
    const frame = mat(0x15181b, { metalness: 0.6, roughness: 0.4 });
    const cw = pd.court.w, cd = pd.court.d;
    for (const side of [-1, 1]) {
      this.add(V, new THREE.BoxGeometry(cw, 3, 0.04), glass, pd.court.x, 1.6, pd.court.z + side * cd / 2);
      this.add(V, new THREE.BoxGeometry(cw + 0.1, 0.08, 0.08), frame, pd.court.x, 3.1, pd.court.z + side * cd / 2);
      this.add(V, new THREE.BoxGeometry(0.04, 3, cd), glass, pd.court.x + side * cw / 2, 1.6, pd.court.z);
      this.add(V, new THREE.BoxGeometry(0.08, 0.08, cd + 0.1), frame, pd.court.x + side * cw / 2, 3.1, pd.court.z);
    }
    for (const sx of [-1, 1]) for (let k = 0; k <= 4; k++) this.add(V, new THREE.BoxGeometry(0.08, 3.1, 0.08), frame, pd.court.x + sx * cw / 2, 1.6, pd.court.z - cd / 2 + (k * cd) / 4);

    // basketball court with a red surround and green border, fenced
    const bb = Vd.basketball;
    this.flat(V, bb.border.x1 - bb.border.x0, bb.border.z1 - bb.border.z0, mat(0x2d6f5a, { roughness: 0.9 }), (bb.border.x0 + bb.border.x1) / 2, 0, (bb.border.z0 + bb.border.z1) / 2, 0.07);
    this.flat(V, bb.pad.x1 - bb.pad.x0, bb.pad.z1 - bb.pad.z0, mat(0xa04a3a, { roughness: 0.9 }), (bb.pad.x0 + bb.pad.x1) / 2, 0.07, (bb.pad.z0 + bb.pad.z1) / 2, 0.02);
    this.flat(V, bb.court.w, bb.court.d, new THREE.MeshStandardMaterial({ map: this.courtTexture("basket", bb.court.w, bb.court.d), roughness: 0.85 }), bb.court.x, 0.09, bb.court.z, 0.02);
    const pole = mat(0x2a2d31, { metalness: 0.5, roughness: 0.4 });
    for (const end of [-1, 1]) {
      const z = bb.court.z + end * (bb.court.d / 2 + 0.6);
      this.add(V, new THREE.CylinderGeometry(0.09, 0.12, 3.4, 10), pole, bb.court.x, 1.7, z);
      this.add(V, new THREE.BoxGeometry(1.8, 1.05, 0.06), mat(0xf4f4f4, { roughness: 0.3 }), bb.court.x, 3.3, z - end * 1.1);
      this.add(V, new THREE.BoxGeometry(0.1, 0.1, 1.2), pole, bb.court.x, 3.4, z - end * 0.55);
    }
    this.fence(V, bb.border.x0, bb.border.z0, bb.border.x1, bb.border.z0, 4);
    this.fence(V, bb.border.x0, bb.border.z1, bb.border.x1, bb.border.z1, 4);
    this.fence(V, bb.border.x0, bb.border.z0, bb.border.x0, bb.border.z1, 4);

    // stadium: tiered stands with white tensile sails, then the pitch
    const st = Vd.stands, pt = Vd.pitch;
    this.flat(V, 120, 150, mat(0xc9c3b6, { roughness: 0.95 }), -88, -0.04, 30, 0.04);
    const tier = mat(0xd9d4ca, { roughness: 0.9 });
    const seatMat = mat(0x3f7f9a, { roughness: 0.7 });
    const standLen = st.z1 - st.z0, standZ = (st.z0 + st.z1) / 2;
    const buildStand = (xFront: number, dir: number) => {
      for (let k = 0; k < 7; k++) {
        const h = 0.5 + k * 0.55;
        this.add(V, new THREE.BoxGeometry(1.2, h, standLen), tier, xFront + dir * (k * 1.2 + 0.6), h / 2, standZ);
        this.add(V, new THREE.BoxGeometry(0.5, 0.08, standLen - 2), seatMat, xFront + dir * (k * 1.2 + 0.85), h + 0.04, standZ);
      }
      this.add(V, new THREE.BoxGeometry(2.4, 5.2, standLen), mat(0xcfc8bb, { roughness: 0.9 }), xFront + dir * 9.6, 2.6, standZ);
      // sails: twisted white membranes spanning between masts
      const sailMat = new THREE.MeshStandardMaterial({ color: 0xf6f6f3, roughness: 0.55, side: THREE.DoubleSide });
      const bays = Math.floor(standLen / 12);
      for (let k = 0; k < bays; k++) {
        const z0 = st.z0 + k * 12 + 0.4, z1 = z0 + 11.2;
        const geo = new THREE.BufferGeometry();
        const xb = xFront + dir * 10.5, xf = xFront - dir * 1.5;
        const verts = new Float32Array([xb, 11, z0, xb, 8, z1, xf, 7.6, z0, xf, 9.8, z1]);
        geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
        geo.setIndex([0, 2, 1, 1, 2, 3]);
        geo.computeVertexNormals();
        const sail = new THREE.Mesh(geo, sailMat);
        sail.castShadow = true;
        sail.receiveShadow = true;
        V.add(sail);
        this.add(V, new THREE.CylinderGeometry(0.16, 0.2, 11.5, 8), mat(0xd9dde1, { metalness: 0.4, roughness: 0.4 }), xb, 5.75, z0);
      }
    };
    buildStand(st.x1, -1);
    buildStand(pt.x - pt.w / 2 - 5, -1);
    // pitch with mown stripes and lines, red track around it
    this.flat(V, pt.w + 8, pt.d + 8, mat(0x9c4636, { roughness: 0.9 }), pt.x, 0, pt.z, 0.05);
    const s = 8;
    const p = canvas(pt.w * s, pt.d * s);
    for (let i = 0; i < 14; i++) { p.g.fillStyle = i % 2 ? "#2f7d3c" : "#378a45"; p.g.fillRect(0, (i * pt.d * s) / 14, pt.w * s, (pt.d * s) / 14 + 1); }
    p.g.strokeStyle = "rgba(255,255,255,.92)"; p.g.lineWidth = 0.14 * s;
    p.g.strokeRect(1.5 * s, 1.5 * s, (pt.w - 3) * s, (pt.d - 3) * s);
    p.g.beginPath(); p.g.moveTo(1.5 * s, (pt.d / 2) * s); p.g.lineTo((pt.w - 1.5) * s, (pt.d / 2) * s); p.g.stroke();
    p.g.beginPath(); p.g.arc((pt.w / 2) * s, (pt.d / 2) * s, 9.15 * s, 0, Math.PI * 2); p.g.stroke();
    p.g.strokeRect((pt.w / 2 - 20.15) * s, 1.5 * s, 40.3 * s, 16.5 * s);
    p.g.strokeRect((pt.w / 2 - 20.15) * s, (pt.d - 18) * s, 40.3 * s, 16.5 * s);
    this.flat(V, pt.w, pt.d, new THREE.MeshStandardMaterial({ map: tex(p.c), roughness: 0.95 }), pt.x, 0.05, pt.z, 0.02);
  }

  private fence(parent: THREE.Object3D, x1: number, z1: number, x2: number, z2: number, h: number) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const { c, g } = canvas(64, 64);
    g.strokeStyle = "rgba(60,66,72,.9)";
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 64); g.moveTo(64, 0); g.lineTo(0, 64); g.stroke();
    const t = tex(c, true, [len / 0.7, h / 0.7]);
    const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.2, side: THREE.DoubleSide, roughness: 0.6 });
    const f = new THREE.Mesh(new THREE.PlaneGeometry(len, h), m);
    f.position.set((x1 + x2) / 2, h / 2, (z1 + z2) / 2);
    f.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    parent.add(f);
    const pm = mat(0x3a3f45, { metalness: 0.5, roughness: 0.4 });
    const n = Math.ceil(len / 3);
    for (let k = 0; k <= n; k++) this.add(parent, new THREE.CylinderGeometry(0.04, 0.04, h, 6), pm, x1 + ((x2 - x1) * k) / n, h / 2, z1 + ((z2 - z1) * k) / n);
  }

  // ------------------------------------------------------------------ expo: stage
  private truss(len: number, size = 0.4) {
    // box truss along +y: four chords + zig-zag diagonals on each face
    const parts: THREE.BufferGeometry[] = [];
    const r = 0.03, h = size / 2;
    for (const [x, z] of [[-h, -h], [h, -h], [h, h], [-h, h]]) parts.push(new THREE.CylinderGeometry(r, r, len, 6).translate(x, len / 2, z));
    const step = size;
    const n = Math.floor(len / step);
    const faces: [number, number, number, number][] = [[-h, -h, h, -h], [h, -h, h, h], [h, h, -h, h], [-h, h, -h, -h]];
    for (let i = 0; i < n; i++) {
      for (const [ax, az, bx, bz] of faces) {
        const y0 = i * step, y1 = y0 + step;
        const a = new THREE.Vector3(ax, y0, az), b = new THREE.Vector3(bx, y1, bz);
        const d = b.clone().sub(a), l = d.length();
        const cyl = new THREE.CylinderGeometry(r * 0.7, r * 0.7, l, 4);
        cyl.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
        cyl.translate((ax + bx) / 2, (y0 + y1) / 2, (az + bz) / 2);
        parts.push(cyl);
      }
    }
    return mergeGeometries(parts.map((p) => p.toNonIndexed()));
  }

  private ledTexture() {
    const { c, g } = canvas(1600, 600);
    const gr = g.createLinearGradient(0, 0, 1600, 600);
    gr.addColorStop(0, "#03121a"); gr.addColorStop(0.55, "#062a33"); gr.addColorStop(1, "#0b3b2a");
    g.fillStyle = gr; g.fillRect(0, 0, 1600, 600);
    g.strokeStyle = "rgba(34,224,200,.3)"; g.lineWidth = 3;
    for (let i = 0; i < 16; i++) { g.beginPath(); g.arc(1320, 300, 40 + i * 36, 0, Math.PI * 2); g.stroke(); }
    // bolt mark
    g.fillStyle = "#B6F23A";
    g.beginPath(); g.moveTo(1345, 170); g.lineTo(1255, 320); g.lineTo(1320, 320); g.lineTo(1290, 440); g.lineTo(1395, 270); g.lineTo(1330, 270); g.closePath(); g.fill();
    g.textAlign = "center"; g.textBaseline = "middle";
    const ar = this.opts.locale === "ar";
    const title = ar ? "السيارات الكهربائية والهجينة" : "Electric & Plug-in Hybrid";
    g.fillStyle = "#ffffff"; this.fitText(g, title, 800, 110, 1050); g.fillText(title, 620, 250);
    g.fillStyle = "#22E0C8"; this.fitText(g, "PALESTINE AUTO EXPO 2027 · 1–7 MAY", 700, 46, 1000); g.fillText("PALESTINE AUTO EXPO 2027 · 1–7 MAY", 620, 380);
    return tex(c);
  }

  private buildStage() {
    const p = PLACES.stage;
    const g = this.placed(p); // local x = depth (towards the audience is +x), z = width
    const deck = mat(0x15191d, { roughness: 0.5 });
    this.add(g, this.rbox(p.w, 1.2, p.d, 0.06), deck, 0, 0.6, 0, "stage");
    const led = this.glow(TEAL, 0.6, 2.2);
    this.add(g, new THREE.BoxGeometry(0.05, 0.08, p.d - 0.2), led, p.w / 2 + 0.01, 1.12, 0);
    // stairs
    for (const sz of [-1, 1]) for (let k = 0; k < 3; k++) this.add(g, new THREE.BoxGeometry(0.45, 0.4 * (k + 1), 1.6), deck, p.w / 2 + 0.25 + (2 - k) * 0.45, 0.2 * (k + 1), sz * (p.d / 2 - 1.4));
    // LED wall
    const ledMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: this.ledTexture(), emissiveIntensity: 1, roughness: 0.35 });
    this.glowMats.push({ m: ledMat, day: 1, night: 1.5 });
    const frame = mat(0x0b0d10, { roughness: 0.4 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5, 12.4), [ledMat, frame, frame, frame, frame, frame]);
    wall.position.set(-p.w / 2 + 0.9, 1.2 + 2.6, 0);
    wall.castShadow = true;
    g.add(wall);
    wall.userData.zone = "stage";
    this.pick.push(wall);
    for (const sz of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.6, 2.6), [ledMat, frame, frame, frame, frame, frame]);
      side.position.set(-p.w / 2 + 1.6, 1.2 + 2.3, sz * 7.8);
      side.rotation.y = sz * 0.35;
      g.add(side);
    }
    // box truss: four towers and a roof grid
    const tm = mat(0xb9bec4, { metalness: 0.85, roughness: 0.3 });
    const H = 8.4;
    const leg = this.truss(H);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.add(g, leg, tm, sx * (p.w / 2 + 0.2), 0, sz * (p.d / 2 + 0.2));
    const beamX = this.truss(p.w + 0.4).rotateZ(Math.PI / 2);
    const beamZ = this.truss(p.d + 0.4).rotateX(Math.PI / 2);
    for (const sz of [-1, 1]) this.add(g, beamX, tm, p.w / 2 + 0.2, H, sz * (p.d / 2 + 0.2));
    for (const sx of [-1, 1]) this.add(g, beamZ, tm, sx * (p.w / 2 + 0.2), H, -p.d / 2 - 0.2);
    // line arrays and moving heads
    const spk = mat(0x111214, { roughness: 0.6 });
    for (const sz of [-1, 1]) for (let k = 0; k < 6; k++) {
      const b = this.add(g, this.rbox(0.7, 0.38, 1.1, 0.03), spk, p.w / 2 + 0.6, H - 0.6 - k * 0.4, sz * (p.d / 2 - 0.4));
      b.rotation.z = -k * 0.04;
    }
    const headMat = mat(0x1a1c1f, { metalness: 0.4, roughness: 0.5 });
    const lens = this.glow(0xfff0d0, 0, 3);
    for (let k = -3; k <= 3; k++) {
      this.add(g, new THREE.CylinderGeometry(0.2, 0.2, 0.36, 12), headMat, p.w / 2 + 0.2, H - 0.45, k * 2.1);
      this.add(g, new THREE.CircleGeometry(0.15, 16).rotateY(Math.PI / 2), lens, p.w / 2 + 0.41, H - 0.45, k * 2.1);
    }
    // podium
    this.add(g, this.rbox(0.6, 1.15, 0.8, 0.05), mat(0xf1f3f4, { roughness: 0.3 }), 1.8, 1.2 + 0.575, -4);
    // evening wash
    for (const sz of [-1, 1]) {
      const sp = new THREE.SpotLight(0xffe9c8, 1800, 50, Math.PI / 6, 0.5, 1.4);
      const w = this.L(p.x + 14, 9, p.z + sz * 5);
      sp.position.copy(w);
      sp.target.position.copy(this.L(p.x, 1.5, p.z + sz * 2));
      sp.visible = false;
      this.scene.add(sp, sp.target);
      this.nightOnly.push(sp);
    }
  }

  private buildSeats() {
    const parts = [
      new THREE.BoxGeometry(0.44, 0.06, 0.44).translate(0, 0.45, 0),
      new THREE.BoxGeometry(0.06, 0.42, 0.44).translate(0.2, 0.7, 0),
      ...[[-0.18, -0.18], [-0.18, 0.18], [0.18, -0.18], [0.18, 0.18]].map(([x, z]) => new THREE.CylinderGeometry(0.015, 0.015, 0.45, 4).translate(x, 0.225, z)),
    ];
    const chair = mergeGeometries(parts.map((p) => p.toNonIndexed()));
    const rows = (list: typeof SEATS_V2, color: number) => {
      const im = new THREE.InstancedMesh(chair, mat(color, { roughness: 0.55 }), list.length);
      const o = new THREE.Object3D();
      list.forEach(([x, z], i) => { o.position.set(x, 0, z); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
      im.castShadow = true;
      im.receiveShadow = true;
      this.layout.add(im);
    };
    rows(SEATS_V2.filter((s) => s[2] < 2), 0x1fb8a8);
    rows(SEATS_V2.filter((s) => s[2] >= 2), 0x22262b);
    const p = PLACES.seats;
    const carpet = this.add(this.layout, new THREE.BoxGeometry(p.w + 1, 0.02, p.d + 1), mat(0x1a1d21, { roughness: 1 }), p.x, 0.035, p.z, "seats");
    carpet.castShadow = false;
  }

  private buildFoh() {
    const p = PLACES.foh;
    const g = this.placed(p);
    this.add(g, this.rbox(p.w, 0.2, p.d, 0.04), mat(0x1c2024), 0, 0.1, 0, "foh");
    this.add(g, this.rbox(1.2, 1.0, 2.6, 0.04), mat(0x101215), 0.2, 0.7, 0, "foh");
    const post = mat(0xc9d2da, { metalness: 0.8, roughness: 0.3 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.add(g, new THREE.CylinderGeometry(0.04, 0.04, 2.6, 6), post, sx * (p.w / 2 - 0.1), 1.3, sz * (p.d / 2 - 0.1));
    this.add(g, this.rbox(p.w + 0.3, 0.12, p.d + 0.3, 0.05), mat(0xf2f4f5, { roughness: 0.5 }), 0, 2.66, 0);
  }

  private buildTent(id: "vip" | "media") {
    const p = PLACES[id];
    const g = this.placed(p);
    const fabric = new THREE.MeshStandardMaterial({ color: 0xf4f5f3, roughness: 0.6, side: THREE.DoubleSide });
    this.add(g, this.rbox(p.w, 0.15, p.d, 0.04), mat(0x2a2f35, { roughness: 0.8 }), 0, 0.075, 0, id);
    // back and side fabric walls, front open
    this.add(g, new THREE.BoxGeometry(0.05, 2.5, p.d), fabric, -p.w / 2, 1.4, 0, id);
    for (const sz of [-1, 1]) this.add(g, new THREE.BoxGeometry(p.w * 0.6, 2.5, 0.05), fabric, -p.w * 0.2, 1.4, sz * p.d / 2, id);
    const post = mat(0xd5dbe0, { metalness: 0.7, roughness: 0.35 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.add(g, new THREE.CylinderGeometry(0.05, 0.05, 2.6, 8), post, sx * p.w / 2, 1.45, sz * p.d / 2);
    // pagoda roof
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(p.w, p.d) / 2 + 0.2, 2.2, 4, 1, true), fabric);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(p.w / Math.hypot(p.w, p.d) * 1.42, 1, p.d / Math.hypot(p.w, p.d) * 1.42);
    roof.position.y = 2.75 + 1.1;
    roof.castShadow = true;
    roof.userData.zone = id;
    this.pick.push(roof);
    g.add(roof);
    const valance = this.glow(TEAL, 0.5, 2);
    this.add(g, new THREE.BoxGeometry(p.w + 0.05, 0.08, 0.06), valance, 0, 2.72, p.d / 2);
    const sofa = mat(0xe6e1d6, { roughness: 0.9 }), table = mat(0x2a2f35);
    for (let k = -1; k <= 1; k++) {
      this.add(g, this.rbox(0.9, 0.42, 2, 0.12), sofa, -p.w / 2 + 0.9, 0.36, k * 2.2);
      this.add(g, this.rbox(0.8, 0.4, 0.8, 0.08), table, -p.w / 2 + 2.1, 0.35, k * 2.2);
    }
  }

  private buildGate() {
    const p = PLACES.gate;
    const g = this.placed(p);
    const metal = mat(0xc9d2da, { metalness: 0.9, roughness: 0.22 });
    for (const sz of [-1, 1]) this.add(g, this.rbox(1.1, 6.2, 1.1, 0.08), metal, 0, 3.1, sz * (p.d / 2 - 0.6), "gate");
    const header = this.add(g, this.rbox(0.7, 1.4, p.d, 0.08), mat(0x0d1217, { roughness: 0.4 }), 0, 6.2, 0, "gate");
    header.userData.sign = true;
    const strip = this.glow(TEAL, 0.8, 2.6);
    this.add(g, new THREE.BoxGeometry(0.75, 0.06, p.d - 0.2), strip, 0, 5.47, 0);
    // turnstiles and registration desks inside
    for (let k = -3; k <= 3; k++) this.add(g, this.rbox(0.9, 1.0, 0.25, 0.04), metal, -0.4, 0.5, k * 1.6);
    const desk = mat(0xf2f4f5, { roughness: 0.35 });
    for (let k = -2; k <= 2; k++) this.add(g, this.rbox(0.7, 1.05, 2.2, 0.06), desk, -4, 0.525, k * 3.2, "gate");
    this.gateGroup = g;
  }

  private gateGroup: THREE.Group | null = null;

  // ------------------------------------------------------------------ expo: booths
  private boothGroups = new Map<string, THREE.Group>();

  private boothTier = new Map<string, Tier>();
  private boothTop = new Map<string, number>();

  private buildBooths() {
    const colors = [0xe9eef2, 0x1a1d21, 0x8f1d1d, 0x22406e, 0x6c6f73, 0xf2f2f2, 0x2b2b2b, 0x3b6e8f, 0xbfc4c9, 0x34495e, 0x7a1616, 0xd9d9d9];
    const white = mat(0xf1f3f4, { roughness: 0.45 });
    const dark = mat(0x0f1317, { roughness: 0.5 });
    const gloss = mat(0x0b0e11, { roughness: 0.16, metalness: 0.35 });
    const gold = mat(0xc9a14a, { roughness: 0.28, metalness: 1 });
    const floor = mat(0x23272c, { roughness: 0.7 });
    const carpet = mat(0x15181c, { roughness: 1 });
    const spec: Record<Tier, { plat: number; wallH: number; wall: THREE.Material; side: THREE.Material; fascia: THREE.Material; strip: THREE.Material }> = {
      regular: { plat: 0.18, wallH: 3.4, wall: white, side: white, fascia: dark, strip: this.glow(TEAL, 0.7, 2.4) },
      golden: { plat: 0.22, wallH: 3.6, wall: white, side: gold, fascia: gold, strip: this.glow(0xffc35a, 0.8, 2.4) },
      premium: { plat: 0.34, wallH: 4.6, wall: gloss, side: gloss, fascia: gloss, strip: this.glow(LIME, 0.9, 2.8) },
    };
    ZONES.filter((z) => z.group === "booth").forEach((zone, i) => {
      const p = PLACES[zone.id];
      if (!p) return;
      const tier = TIERS[zone.id] ?? "regular";
      this.boothTier.set(zone.id, tier);
      const g = this.placed(p);
      this.boothGroups.set(zone.id, g);
      if (p.kind === "hub") { this.buildHub(g, p, zone.id); return; }
      const { w, d } = p;
      const S = spec[tier], b = S.plat;
      this.boothTop.set(zone.id, b + S.wallH);
      this.add(g, this.rbox(w, b, d, 0.05), floor, 0, b / 2, 0, zone.id);
      this.add(g, new THREE.BoxGeometry(w - 0.2, 0.01, d - 0.2), carpet, 0, b + 0.005, 0).castShadow = false;
      this.add(g, new THREE.BoxGeometry(w, 0.05, 0.05), S.strip, 0, b - 0.02, d / 2 + 0.01);
      for (const sx of [-1, 1]) this.add(g, new THREE.BoxGeometry(0.05, 0.05, d), S.strip, sx * (w / 2 + 0.01), b - 0.02, 0);
      // back wall, fascia, side return
      this.add(g, this.rbox(w, S.wallH, 0.24, 0.05), S.wall, 0, b + S.wallH / 2, -d / 2 + 0.12, zone.id);
      this.add(g, this.rbox(w + 0.1, 0.75, 0.36, 0.04), S.fascia, 0, b + S.wallH + 0.2, -d / 2 + 0.2, zone.id);
      this.add(g, this.rbox(0.2, 2.6, d * 0.42, 0.04), S.side, w / 2 - 0.1, b + 1.3, -d / 2 + d * 0.21, zone.id);
      if (tier === "premium") {
        // LED line along the top of the wall and down both edges
        this.add(g, new THREE.BoxGeometry(w - 0.2, 0.06, 0.04), S.strip, 0, b + S.wallH - 0.3, -d / 2 + 0.26);
        for (const sx of [-1, 1]) this.add(g, new THREE.BoxGeometry(0.06, S.wallH - 0.4, 0.04), S.strip, sx * (w / 2 - 0.15), b + S.wallH / 2, -d / 2 + 0.26);
      }
      if (tier === "golden") this.add(g, new THREE.BoxGeometry(w, 0.12, 0.26), gold, 0, b + 0.06, -d / 2 + 0.12);
      const n = w >= 7.5 ? 2 : 1;
      // info stand at the front edge
      const sx0 = n === 2 ? 0 : -2.4;
      this.add(g, this.rbox(0.6, 1.05, 0.4, 0.05), tier === "premium" ? gloss : white, sx0, b + 0.525, d / 2 - 0.45, zone.id);
      this.add(g, new THREE.BoxGeometry(0.62, 0.05, 0.42), S.strip, sx0, b + 0.9, d / 2 - 0.45);
      for (let k = 0; k < n; k++) {
        const car = new THREE.Group();
        car.userData.zone = zone.id;
        const cx = n === 2 ? (k ? 2 : -2) : 0.4;
        car.position.set(cx, b, -0.15);
        g.add(car);
        this.carSlots.push({ g: car, color: colors[(i * 2 + k) % colors.length], hero: false });
        const px = n === 2 ? (k ? 0.45 : -0.45) : -1.6;
        this.charger(g, px, -d / 2 + 0.55, { x: n === 2 ? cx + (k ? -0.6 : 0.6) : cx - 0.6, z: -1.6 }, zone.id, 1.5, b);
        if (n === 1) this.charger(g, 2.3, -d / 2 + 0.55, { x: cx + 0.6, z: -1.6 }, zone.id, 1.5, b); // keep two posts per pavilion
      }
    });
  }

  // ------------------------------------------------------------------ banks avenue
  private bankGroups = new Map<string, THREE.Group>();

  private buildBanks() {
    const white = mat(0xf1f3f4, { roughness: 0.45 });
    const dark = mat(0x12171c, { roughness: 0.5 });
    const blue = this.glow(0x5aa8ff, 0.8, 2.4);
    const post = mat(0xc9d2da, { metalness: 0.8, roughness: 0.3 });
    const stool = mat(0x2a3138, { roughness: 0.6 });
    const screen = new THREE.MeshStandardMaterial({ color: 0x050a10, emissive: 0x1b4f8f, emissiveIntensity: 0.6, roughness: 0.2 });
    this.glowMats.push({ m: screen, day: 0.6, night: 1.4 });
    for (const zone of ZONES_V2.filter((z) => z.group === "bank")) {
      const p = PLACES[zone.id];
      const g = this.placed(p);
      this.bankGroups.set(zone.id, g);
      const { w, d } = p;
      this.add(g, this.rbox(w, 0.15, d, 0.04), dark, 0, 0.075, 0, zone.id);
      this.add(g, new THREE.BoxGeometry(w, 0.05, 0.05), blue, 0, 0.13, d / 2 + 0.01);
      this.add(g, this.rbox(w, 2.7, 0.18, 0.04), white, 0, 0.15 + 1.35, -d / 2 + 0.09, zone.id);
      this.add(g, new THREE.PlaneGeometry(1.5, 0.85), screen, 0, 1.75, -d / 2 + 0.19).castShadow = false;
      // canopy on two front posts
      for (const sx of [-1, 1]) this.add(g, new THREE.CylinderGeometry(0.04, 0.04, 2.7, 8), post, sx * (w / 2 - 0.1), 1.5, d / 2 - 0.1);
      this.add(g, this.rbox(w + 0.2, 0.12, d + 0.2, 0.04), white, 0, 2.91, 0, zone.id);
      this.add(g, this.rbox(w + 0.22, 0.5, 0.12, 0.03), dark, 0, 2.7, d / 2 + 0.12, zone.id);
      // desk and two visitor stools
      this.add(g, this.rbox(1.6, 0.95, 0.6, 0.05), white, 0, 0.15 + 0.475, -0.1, zone.id);
      this.add(g, new THREE.BoxGeometry(1.62, 0.05, 0.62), blue, 0, 0.15 + 0.8, -0.1);
      for (const sx of [-0.45, 0.45]) this.add(g, new THREE.CylinderGeometry(0.2, 0.18, 0.65, 14), stool, sx, 0.15 + 0.325, 0.75);
    }
  }

  private buildHub(g: THREE.Group, p: Place, id: string) {
    const r = Math.min(p.w, p.d) / 2;
    this.add(g, new THREE.CylinderGeometry(r, r, 0.2, 64), mat(0x1c2126, { roughness: 0.6 }), 0, 0.1, 0, id);
    this.add(g, new THREE.TorusGeometry(r, 0.05, 8, 96).rotateX(Math.PI / 2), this.glow(LIME, 0.9, 2.8), 0, 0.2, 0);
    const turntable = this.add(g, new THREE.CylinderGeometry(r - 0.8, r - 0.8, 0.12, 64), mat(0xd9dee2, { metalness: 0.7, roughness: 0.25 }), 0, 0.26, 0, id);
    turntable.castShadow = false;
    const car = new THREE.Group();
    car.position.set(0, 0.32, 0);
    car.userData.zone = id;
    g.add(car);
    this.spin.push(car);
    this.carSlots.push({ g: car, color: 0xe9eef2, hero: true });
    // halo ring overhead on two totems
    const metal = mat(0xc9d2da, { metalness: 0.9, roughness: 0.22 });
    for (const s of [-1, 1]) this.add(g, this.rbox(0.35, 5.4, 0.35, 0.06), metal, s * (r - 0.7), 2.7, -r + 0.6, id);
    for (const s of [-1, 1]) this.charger(g, s * (r - 0.5), r - 0.6, { x: s * 1.2, z: 0.6 }, id, 2.1);
  }

  private chargerGlow: THREE.MeshStandardMaterial | null = null;

  private charger(parent: THREE.Object3D, x: number, z: number, port: { x: number; z: number }, zone: string, h = 1.5, base = 0.18) {
    this.chargerGlow ||= this.glow(TEAL, 1.4, 3.2);
    const body = mat(0xf3f5f6, { roughness: 0.3 });
    const dark = mat(0x0e1216, { roughness: 0.35 });
    this.add(parent, this.rbox(0.42, h, 0.32, 0.06), body, x, base + h / 2, z, zone);
    this.add(parent, new THREE.BoxGeometry(0.3, 0.38, 0.02), dark, x, base + h * 0.72, z + 0.17);
    this.add(parent, new THREE.BoxGeometry(0.06, h * 0.45, 0.02), this.chargerGlow, x - 0.13, base + h * 0.4, z + 0.17);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, base + h * 0.5, z + 0.18),
      new THREE.Vector3((x + port.x) / 2, base + 0.04, (z + port.z) / 2 + 0.3),
      new THREE.Vector3(port.x, base + 0.67, port.z),
    ]);
    this.add(parent, new THREE.TubeGeometry(curve, 24, 0.028, 6, false), dark);
  }

  private buildSigns() {
    const l = this.opts.locale;
    ZONES.filter((z) => z.group === "booth" && z.exhibitor).forEach((zone) => {
      const g = this.boothGroups.get(zone.id);
      const p = PLACES[zone.id];
      if (!g || !p) return;
      const ex = zone.exhibitor!;
      const tier = this.boothTier.get(zone.id) ?? "regular";
      const t = this.signTexture(ex.name[l], ex.name[l === "ar" ? "en" : "ar"], 1024, 256, tier === "golden" ? "#17120a" : "#0d1217", TIER_COLOR[tier]);
      const m = new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.35, roughness: 0.5 });
      this.glowMats.push({ m, day: 0.35, night: 1 });
      if (p.kind === "hub") {
        const r = Math.min(p.w, p.d) / 2;
        const sw = 2 * r - 1.6, sh = sw / 4;
        const zb = -r + 0.6;
        this.add(g, this.rbox(sw + 0.2, sh + 0.2, 0.42, 0.05), mat(0x0d1217), 0, 6.1, zb, zone.id);
        const s = this.add(g, new THREE.PlaneGeometry(sw, sh), m, 0, 6.1, zb + 0.22, zone.id);
        s.castShadow = false;
        const back = s.clone();
        back.rotation.y = Math.PI;
        back.position.z = zb - 0.22;
        g.add(back);
        return;
      }
      const top = this.boothTop.get(zone.id) ?? 3.58;
      const s = this.add(g, new THREE.PlaneGeometry(p.w - 0.3, 0.62), m, 0, top + 0.2, -p.d / 2 + 0.39, zone.id);
      s.castShadow = false;
      if (!ex.brands) return;
      // logo light box on the back wall
      const mark = this.signTexture(ex.brands, "", 1024, 400, "#0f151b");
      const lm = new THREE.MeshStandardMaterial({ map: mark, emissive: 0xffffff, emissiveMap: mark, emissiveIntensity: 0.45, roughness: 0.4 });
      this.glowMats.push({ m: lm, day: 0.45, night: 1.1 });
      this.add(g, new THREE.PlaneGeometry(2.6, 1.0), lm, -0.6, 0.18 + 2.1, -p.d / 2 + 0.25, zone.id).castShadow = false;
    });
    for (const zone of ZONES_V2.filter((z) => z.group === "bank")) {
      const g = this.bankGroups.get(zone.id);
      if (!g) continue;
      const p = PLACES[zone.id];
      const t = this.signTexture(zone.name[l], zone.name[l === "ar" ? "en" : "ar"], 1024, 160, "#0d1217", BANK_COLOR);
      const m = new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.35, roughness: 0.5 });
      this.glowMats.push({ m, day: 0.35, night: 1 });
      this.add(g, new THREE.PlaneGeometry(p.w, 0.47), m, 0, 2.7, p.d / 2 + 0.185, zone.id).castShadow = false;
    }
    if (this.gateGroup) {
      const [main, sub] = l === "ar" ? ["معرض فلسطين للسيارات الكهربائية 2027", "Electric & Plug-in · 1–7 May 2027"] : ["Palestine EV & Plug-in Expo 2027", "السيارات الكهربائية والهجينة · 1–7 أيار"];
      const t = this.signTexture(main, sub, 2048, 160);
      const m = new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.4 });
      this.glowMats.push({ m, day: 0.4, night: 1 });
      const d = PLACES.gate.d;
      for (const s of [1, -1]) {
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(d - 0.4, ((d - 0.4) * 160) / 2048 * 1.6), m);
        plane.position.set(s * 0.36, 6.2, 0);
        plane.rotation.y = (s * Math.PI) / 2;
        this.gateGroup.add(plane);
      }
    }
  }

  // ------------------------------------------------------------------ energy path, poles
  private buildEnergyPath() {
    const geo = new THREE.PlaneGeometry(0.22, 0.95);
    for (const route of ENERGY_ROUTES) {
      let idx = 0;
      for (let s = 0; s < route.length - 1; s++) {
        const [ax, az] = route[s], [bx, bz] = route[s + 1];
        const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.floor(len / 1.4));
        const ang = Math.atan2(bx - ax, bz - az);
        for (let k = 0; k < n; k++, idx++) {
          const f = (k + 0.5) / n;
          const m = new THREE.MeshStandardMaterial({ color: 0x0c2a22, emissive: LIME, emissiveIntensity: 0.5, transparent: true, opacity: 0.95 });
          m.userData.i = idx;
          this.flow.push(m);
          for (const side of [-1, 1]) {
            const t = new THREE.Mesh(geo, m);
            t.rotation.x = -Math.PI / 2;
            t.rotation.z = ang + Math.PI + side * 0.75;
            t.position.set(ax + (bx - ax) * f + Math.cos(ang) * side * 0.2, 0.05, az + (bz - az) * f - Math.sin(ang) * side * 0.2);
            this.layout.add(t);
          }
        }
      }
    }
  }

  private buildPoles() {
    const pole = mat(0xb8bec4, { metalness: 0.7, roughness: 0.3 });
    const lampOff = mat(0xe8e8e8, { roughness: 0.3 });
    const lampGlow = this.glow(0xfff1d6, 0, 1.4);
    for (const [x, z] of FLOODLIGHTS) {
      const parent = x < -6 ? this.village : this.layout;
      this.add(parent, new THREE.CylinderGeometry(0.14, 0.26, 16, 12), pole, x, 8, z);
      this.add(parent, new THREE.BoxGeometry(0.15, 0.15, 2.6), pole, x + 0.3, 16, z);
      for (const dz of [-0.95, -0.32, 0.32, 0.95]) {
        const l = this.add(parent, this.rbox(0.45, 0.55, 0.5, 0.05), lampOff, x + 0.55, 16.1, z + dz);
        l.rotation.z = -0.5;
        const face = this.add(parent, new THREE.PlaneGeometry(0.38, 0.45), lampGlow, x + 0.8, 16.0, z + dz);
        face.rotation.y = Math.PI / 2;
        face.rotation.x = 0.5;
      }
      if (x > -6) {
        const pl = new THREE.PointLight(0xffecc8, 320, 48, 1.7);
        pl.position.copy(this.L(x + 2, 15, z));
        pl.visible = false;
        this.scene.add(pl);
        this.nightOnly.push(pl);
      }
    }
    for (const [x, z] of STREET_LAMPS) {
      this.add(this.layout, new THREE.CylinderGeometry(0.07, 0.12, 8, 10), pole, x, 4, z);
      const arm = this.add(this.layout, new THREE.BoxGeometry(1.6, 0.08, 0.08), pole, x + 0.7, 7.9, z);
      arm.rotation.z = 0.12;
      this.add(this.layout, this.rbox(0.6, 0.12, 0.3, 0.04), lampOff, x + 1.5, 7.98, z);
      this.add(this.layout, new THREE.PlaneGeometry(0.5, 0.22).rotateX(Math.PI / 2), lampGlow, x + 1.5, 7.9, z);
    }
  }

  // ------------------------------------------------------------------ cars
  private loadCars() {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const prep = (scene: THREE.Object3D) => {
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true;
        m.receiveShadow = true;
        const name = (m.material as THREE.Material | undefined)?.name ?? "";
        if (/licen/i.test(m.name) || /licen/i.test(name)) m.visible = false;
      });
      return scene;
    };
    const place = (tpl: THREE.Object3D, slots: { g: THREE.Group; color: number; hero: boolean }[]) => {
      for (const slot of slots) {
        const c = SkeletonUtils.clone(tpl);
        const cache = new Map<THREE.Material, THREE.Material>();
        c.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          m.userData.zone = slot.g.userData.zone;
          this.pick.push(m);
          const mt = m.material as THREE.MeshPhysicalMaterial;
          if (mt && /^Paint/.test(mt.name || "")) {
            if (!cache.has(mt)) {
              const k = mt.clone();
              k.color.set(slot.color);
              k.clearcoat = 1;
              k.clearcoatRoughness = 0.06;
              k.roughness = 0.32;
              k.metalness = 0.6;
              cache.set(mt, k);
            }
            m.material = cache.get(mt) as THREE.Material;
          }
        });
        c.position.z = -0.24; // centre the body on its slot
        c.scale.setScalar(1.02);
        slot.g.add(c);
      }
    };
    loader.load("/models/car-lod.glb", (gltf) => { if (this.alive) place(prep(gltf.scene), this.carSlots.filter((s) => !s.hero)); });
    loader.load("/models/car.glb", (gltf) => { if (this.alive) place(prep(gltf.scene), this.carSlots.filter((s) => s.hero)); });
  }

  // ------------------------------------------------------------------ pins & selection
  private buildPins() {
    const l = this.opts.locale;
    for (const z of ZONES_V2) {
      const p = PLACES[z.id];
      if (!p) continue;
      const el = document.createElement("button");
      el.type = "button";
      el.className = `venue-pin venue-pin--${z.group}${z.tier ? ` venue-pin--${z.tier}` : ""}`;
      el.setAttribute("aria-label", z.name[l]);
      const tag = document.createElement("span");
      tag.className = "venue-pin__tag";
      tag.textContent = z.tag;
      const name = document.createElement("span");
      name.className = "venue-pin__name";
      name.textContent = z.name[l];
      el.append(tag, name);
      el.addEventListener("click", (e) => { e.stopPropagation(); this.opts.onSelect(z.id); });
      const obj = new CSS2DObject(el);
      const h = p.kind === "stage" ? 10 : p.kind === "gate" ? 8 : p.kind === "hub" ? 7 : p.kind === "seats" ? 3 : p.kind === "tent" ? 5.6 : p.kind === "bank" ? 3.9 : (this.boothTop.get(z.id) ?? 3.6) + 1.6;
      obj.position.set(p.x, h, p.z);
      this.pinGroup.add(obj);
      this.pins.set(z.id, el);
    }
  }

  private buildSelection() {
    const group = new THREE.Group();
    group.visible = false;
    const m = new THREE.MeshBasicMaterial({ color: 0x5ff5e3, transparent: true, opacity: 0.9, depthWrite: false });
    for (let i = 0; i < 4; i++) group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 0.06, 0.16), m));
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.12, depthWrite: false }));
    fill.rotation.x = -Math.PI / 2;
    group.add(fill);
    this.layout.add(group);
    this.sel = { group, mat: m };
  }

  private placeSelection(p: Place) {
    if (!this.sel) return;
    const { group } = this.sel;
    group.position.set(p.x, 0.25, p.z);
    group.rotation.y = -p.rot * DEG;
    const w = p.w + 0.8, d = p.d + 0.8;
    const [a, b, c, e, fill] = group.children as THREE.Mesh[];
    a.scale.x = w; a.position.set(0, 0, -d / 2); a.rotation.y = 0;
    b.scale.x = w; b.position.set(0, 0, d / 2); b.rotation.y = 0;
    c.scale.x = d; c.position.set(-w / 2, 0, 0); c.rotation.y = Math.PI / 2;
    e.scale.x = d; e.position.set(w / 2, 0, 0); e.rotation.y = Math.PI / 2;
    fill.scale.set(w, d, 1);
    group.visible = true;
  }

  // ------------------------------------------------------------------ camera
  private viewPose(k: ViewKey) {
    const p = this.viewPoseRaw(k);
    const host = this.cv.parentElement as HTMLElement;
    const aspect = host.clientWidth / Math.max(1, host.clientHeight);
    const zoom = aspect < 1 ? Math.min(2.4, 1.1 / aspect) : 1; // portrait screens need more distance
    if (zoom > 1 && k !== "seats") p.pos.sub(p.target).multiplyScalar(zoom).add(p.target);
    return p;
  }

  private viewPoseRaw(k: ViewKey) {
    const C = (x: number, y: number, z: number) => this.L(x, y, z);
    switch (k) {
      case "top": {
        const t = C(18, 0, 32);
        return { target: t, pos: t.clone().add(new THREE.Vector3(0.01, 135, 0.01)) };
      }
      case "gate":
        return { target: C(22, 0, 30), pos: C(74, 17, 57) };
      case "seats":
        return { target: C(3, 3.8, 30), pos: C(25, 2.4, 33) };
      default:
        return { target: C(26, 0, 33), pos: C(100, 66, 76) };
    }
  }

  private flyTo(pos: THREE.Vector3, target: THREE.Vector3, dur: number) {
    this.tween = { p0: this.camera.position.clone(), p1: pos, t0: this.controls.target.clone(), t1: target, start: performance.now(), dur: dur * 1000 };
  }

  private bindPicking() {
    const el = this.cv;
    const ray = new THREE.Raycaster();
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) { down = null; return; }
      down = null;
      const r = el.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
      const hit = ray.intersectObjects(this.pick, false).find((h) => h.object.userData.zone);
      this.opts.onSelect(hit ? (hit.object.userData.zone as string) : null);
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    this.disposers.push(() => { el.removeEventListener("pointerdown", onDown); el.removeEventListener("pointerup", onUp); });
  }

  private fit() {
    const host = this.cv.parentElement as HTMLElement;
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.labels.setSize(w, h);
    this.camera.aspect = w / h;
    // desktop: the menu covers one side, so centre the picture in the remaining space
    const inset = w > 900 ? 400 : 0;
    if (inset) this.camera.setViewOffset(w + inset, h, this.opts.locale === "ar" ? 0 : inset, 0, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------ time of day + frame
  private applyTime() {
    const n = this.night;
    this.scene.background = n ? this.bgNight : this.bgDay;
    this.scene.fog = new THREE.Fog(n ? 0x050a10 : 0xc9d4de, n ? 160 : 220, n ? 420 : 520);
    this.scene.environmentIntensity = n ? 0.08 : 0.55;
    this.hemi.intensity = n ? 0.08 : 0.6;
    this.sun.visible = !n;
    this.renderer.toneMappingExposure = n ? 1.1 : 1.05;
    this.nightOnly.forEach((l) => (l.visible = n));
    this.glowMats.forEach(({ m, day, night }) => (m.emissiveIntensity = n ? night : day));
    this.bloom.enabled = n;
    this.siteMat.color.set(n ? 0x2a3138 : 0xffffff);
    this.ao.blendIntensity = n ? 0.6 : 0.85;
  }

  private tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.tween) {
      const tw = this.tween;
      const t = Math.min(1, (performance.now() - tw.start) / tw.dur), k = ease(t);
      this.camera.position.lerpVectors(tw.p0, tw.p1, k);
      this.controls.target.lerpVectors(tw.t0, tw.t1, k);
      if (t >= 1) this.tween = null;
    }
    this.controls.update();
    this.spin.forEach((s) => (s.rotation.y += dt * 0.3));
    const time = performance.now() / 1000;
    const base = this.night ? 0.6 : 0.35, peak = this.night ? 3.6 : 1.4;
    for (const m of this.flow) {
      const ph = (((time * 5 - (m.userData.i as number) * 0.6) % 10) + 10) % 10;
      m.emissiveIntensity = base + peak * Math.max(0, 1 - ph / 2);
    }
    if (this.sel?.group.visible) this.sel.mat.opacity = 0.55 + 0.4 * Math.sin(time * 4);
    this.composer.render(dt);
    this.labels.render(this.scene, this.camera);
  }
}
