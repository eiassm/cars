// Venue model v2, traced from the satellite view of the Sports Village parking yard.
//
// Two frames, both in metres:
// - SITE frame: the satellite image, x to the right of the image, z down the image
//   (7.69 px per metre, origin near the middle of the yard). Ground textures live here.
// - LAYOUT frame: aligned to the yard's straight edge along the courts. Local x runs from that
//   edge (x = 0) into the yard, local z runs along it. Everything we design lives here.
// LAYOUT → SITE: p = ORIGIN + x · UX + z · UZ, i.e. a group at ORIGIN rotated by LAYOUT_YAW.

import { ZONES, type Tier, type Zone } from "./expo";

export const LAYOUT_ORIGIN: [number, number] = [-37.3, -22.1];
export const LAYOUT_YAW = 0.5347; // radians; local +x → site (0.860, -0.510)

/** Yard outline (curb line) in the layout frame. */
export const LOT_LOCAL: [number, number][] = [
  [0, 0], [19.3, 2.4], [34.5, 9.0], [44.8, 15.5], [52.4, 23.0], [57.5, 24.5], [61.5, 34.9],
  [60.9, 48.6], [54.9, 56.2], [45.1, 62.5], [32.9, 64.3], [14.8, 62.7], [0, 60.4],
];
/** Edge indices (i → i+1) that stay open: 13→0 is the straight edge along the courts walkway, 6→8 the entrance. */
export const OPEN_EDGES = new Set([6, 7, 12]);

/** Satellite ground image placement in the SITE frame. */
export const SITE_IMAGE = { url: "/venue/site.webp", x0: -91.03, x1: 63.46, z0: -132.64, z1: 63.72 };
export const LOT_TEXTURE = { plain: "/venue/lot-plain.webp", x0: -45, x1: 45, z0: -40, z1: 40 };

export type Facing = "in" | "c";

/**
 * A placed rectangle in the layout frame: centre, size along its own x (w) and z (d), and its angle in degrees
 * measured from layout +x towards +z (three.js yaw = −rot). A booth's back wall is on its own −z side.
 */
export type Place = { x: number; z: number; w: number; d: number; rot: number; kind: "stage" | "seats" | "foh" | "tent" | "gate" | "booth" | "hub" | "bank" };

export const PLACES: Record<string, Place> = {
  stage: { x: 5.5, z: 30, w: 8, d: 16, rot: 0, kind: "stage" },
  seats: { x: 16.3, z: 30, w: 8.6, d: 20.8, rot: 0, kind: "seats" }, // 297 seats (−30% from 420)
  foh: { x: 23.8, z: 30, w: 3, d: 3.5, rot: 0, kind: "foh" },
  vip: { x: 5, z: 16, w: 8, d: 7, rot: 0, kind: "tent" },
  media: { x: 5, z: 44, w: 8, d: 7, rot: 0, kind: "tent" },
  gate: { x: 57.4, z: 45.5, w: 4, d: 19, rot: 17, kind: "gate" },
  // p1 = featured centre pavilion facing the entrance
  p1: { x: 45, z: 43, w: 8, d: 8, rot: 0, kind: "hub" },
  // top row, back walls along the curved top edge
  p2: { x: 3.6, z: 5.3, w: 8, d: 6.5, rot: 7.1, kind: "booth" },
  p3: { x: 12.1, z: 6.4, w: 8, d: 6.5, rot: 7.1, kind: "booth" },
  p4: { x: 22.6, z: 9.4, w: 8, d: 6.5, rot: 23.5, kind: "booth" },
  p5: { x: 45.2, z: 22.7, w: 8, d: 6.5, rot: 44.6, kind: "booth" },
  p6: { x: 53.6, z: 31.3, w: 6.5, d: 7, rot: 0, kind: "booth" },
  // middle
  p7: { x: 34, z: 25.3, w: 8, d: 6.5, rot: 0, kind: "booth" },
  p8: { x: 34, z: 39.3, w: 8, d: 6.5, rot: 180, kind: "booth" },
  // bottom row, back walls along the bottom edge
  p9: { x: 8, z: 56.8, w: 8, d: 6.5, rot: 180, kind: "booth" },
  p10: { x: 18, z: 56.8, w: 8, d: 6.5, rot: 180, kind: "booth" },
  p11: { x: 28, z: 57.2, w: 8, d: 6.5, rot: 180, kind: "booth" },
  p12: { x: 38, z: 56.8, w: 8, d: 6.5, rot: 180, kind: "booth" },
  // banks avenue: car-finance kiosks on the walkway along the courts, facing into the yard
  ...Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`b${i + 1}`, { x: -5, z: 42 + i * 4, w: 3, d: 3, rot: -90, kind: "bank" as const }])),
};

/** Booth tiers: premium = best spots with the boldest build, golden = gold finish, regular = standard shell. */
export const TIERS: Record<string, Tier> = {
  p1: "premium", p6: "premium",
  p2: "golden", p3: "golden", p4: "golden", p5: "golden",
  p7: "regular", p8: "regular", p9: "regular", p10: "regular", p11: "regular", p12: "regular",
};

export const TIER_LABEL: Record<Tier, { ar: string; en: string }> = {
  premium: { ar: "بريميوم", en: "Premium" },
  golden: { ar: "ذهبي", en: "Golden" },
  regular: { ar: "عادي", en: "Regular" },
};

export const TIER_COLOR: Record<Tier, string> = { premium: "#B6F23A", golden: "#E2B84A", regular: "#22E0C8" };
export const BANK_COLOR = "#5AA8FF";

/** Seats in rows facing the stage (towards −x), with a central aisle. [x, z, row] */
export const SEATS_V2: [number, number, number][] = (() => {
  const s = PLACES.seats;
  const out: [number, number, number][] = [];
  let row = 0;
  for (let x = s.x - s.w / 2 + 0.6; x <= s.x + s.w / 2 - 0.3; x += 0.95, row++) {
    for (let z = s.z - s.d / 2 + 0.3; z <= s.z + s.d / 2 - 0.3; z += 0.58) {
      if (Math.abs(z - s.z) < 0.8) continue;
      out.push([x, z, row]);
    }
  }
  return out;
})();

/** Energy path (chevrons) from the gate, around the centre pavilion, to the audience. */
export const ENERGY_ROUTES: [number, number][][] = [
  [[55.5, 46], [50.8, 50.5], [26, 50.5], [24.8, 42.2]],
  [[55.5, 46], [50.8, 37], [40, 33], [26, 33]],
  [[26, 50.5], [-2.2, 50.5]], // branch to the banks avenue
];

/** Sports Village neighbours in the layout frame (x < 0 is beyond the straight edge). */
export const VILLAGE = {
  walkway: { x0: -7, x1: 0, z0: -8, z1: 66 },
  padel: { court: { x: -14.4, z: 0.5, w: 10, d: 20 }, pad: { x0: -27, x1: -7.5, z0: -14, z1: 14 } },
  basketball: { court: { x: -20.5, z: 39.7, w: 15, d: 28 }, pad: { x0: -33, x1: -8.5, z0: 20, z1: 60 }, border: { x0: -35, x1: -7.5, z0: 18, z1: 62 } },
  stands: { x0: -58, x1: -38, z0: -30, z1: 90 },
  pitch: { x: -92, z: 30, w: 64, d: 100 },
};

export const FLOODLIGHTS: [number, number][] = [[-3.5, 4], [-3.5, 24], [-3.5, 36], [-36, 0], [-36, 40], [-36, 80], [-124, 0], [-124, 60]];
export const STREET_LAMPS: [number, number][] = [[20, 4.6], [44, 14.2], [58, 27.5], [50, 59.5], [24, 63], [2, 61]];

export const CHARGERS_V2 = 12 * 2;

/** Zones as the menu lists them, with v2 sizes. */
const TIER_NOTE: Record<Tier, { ar: string; en: string }> = {
  premium: { ar: "جناح بريميوم: أفضل موقع، جدار خلفي أسود لامع بارتفاع مضاعف، منصة مرتفعة وإضاءة LED.", en: "Premium pavilion: a top spot, double-height gloss-black back wall, raised platform and LED edge lighting." },
  golden: { ar: "جناح ذهبي: واجهة وحواف بلمسة ذهبية وجدار خلفي يحمل الاسم.", en: "Golden pavilion: gold-finish fascia and trims with a branded back wall." },
  regular: { ar: "جناح عادي: هيكل أبيض قياسي مع لوحة اسم وجدار خلفي.", en: "Regular pavilion: standard white shell with a name board and back wall." },
};

const BANK_ZONES: Zone[] = Array.from({ length: 6 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return {
    id: `b${i + 1}`, group: "bank", tag: `B${n}`, x: 0, y: 0, w: 3, d: 3, swatch: BANK_COLOR,
    name: { ar: `بنك ${n}`, en: `Bank ${n}` },
    sub: { ar: "تمويل السيارات · متاح للحجز", en: "Car finance · Available to book" },
    note: {
      ar: "كشك بنكي 3 × 3 م في ممر البنوك بجانب الملاعب: مكتب استقبال، مقعدان وشاشة لعروض تمويل السيارات الكهربائية.",
      en: "A 3 × 3 m bank kiosk on the banks avenue beside the courts: a desk, two seats and a screen for EV finance offers.",
    },
  };
});

export const ZONES_V2: Zone[] = [
  ...ZONES.map((z) => {
    const p = PLACES[z.id];
    const tier = TIERS[z.id];
    const sized = p ? { ...z, w: p.w, d: p.d } : z;
    if (!tier) return sized;
    const label = TIER_LABEL[tier];
    return {
      ...sized, tier, swatch: TIER_COLOR[tier],
      sub: { ar: `${label.ar} · متاح للحجز`, en: `${label.en} · Available to book` },
      note: z.id === "p1" ? { ar: `${TIER_NOTE.premium.ar} في المركز مقابل المدخل، بمنصة دوّارة.`, en: `${TIER_NOTE.premium.en} Centre of the yard facing the entrance, with a turntable.` } : TIER_NOTE[tier],
    };
  }),
  ...BANK_ZONES,
];
