// Facts for the public site, derived from the venue model so the site and the 3D plan never disagree.
import type { Tier } from "./expo";
import { CARS_PER_TIER, CHARGERS_V2, PLACES, SEATS_V2, STAND_HEIGHT, TIERS, YARD_AREA } from "./venue";

type L = { ar: string; en: string };

export const STATS = {
  days: 7,
  pavilions: Object.keys(TIERS).length,
  banks: 6,
  chargers: CHARGERS_V2,
  seats: SEATS_V2.length,
  area: YARD_AREA,
};

/** Where each pavilion sits on the visitor loop. */
const WHERE: Record<string, L> = {
  p1: { ar: "وسط الساحة على المحور الرئيسي، مقابل المدخل", en: "Centre of the yard on the main axis, facing the gate" },
  p2: { ar: "بجانب البوابة مباشرة، عند الدخول والخروج", en: "Right beside the gate, on the way in and out" },
  p3: { ar: "الممر الشمالي، أقرب جناح إلى المدخل", en: "North aisle, the closest to the gate" },
  p4: { ar: "الممر الشمالي، على الطريق إلى ساحة الطعام", en: "North aisle, on the way to the food court" },
  p5: { ar: "الممر الشمالي، على الطريق إلى ساحة الطعام", en: "North aisle, on the way to the food court" },
  p6: { ar: "الممر الشمالي، بجانب ساحة الطعام", en: "North aisle, beside the food court" },
  p7: { ar: "الجزيرة الوسطى، يواجه الممر الشمالي", en: "Central island, facing the north aisle" },
  p8: { ar: "الجزيرة الوسطى، يواجه الممر الجنوبي", en: "Central island, facing the south aisle" },
  p9: { ar: "الممر الجنوبي، قرب المسرح والخدمات", en: "South aisle, near the stage and services" },
  p10: { ar: "الممر الجنوبي، قرب المسرح", en: "South aisle, near the stage" },
  p11: { ar: "الممر الجنوبي", en: "South aisle" },
  p12: { ar: "الممر الجنوبي", en: "South aisle" },
  p13: { ar: "الممر الجنوبي، آخر محطة قبل الخروج", en: "South aisle, the last stop before the exit" },
};

export type BoothInfo = { id: string; tag: string; tier: Tier; w: number; d: number; area: number; where: L };

export const BOOTHS: BoothInfo[] = Object.keys(TIERS).map((id) => {
  const p = PLACES[id];
  const n = id.slice(1).padStart(2, "0");
  return { id, tag: `P${n}`, tier: TIERS[id], w: p.w, d: p.d, area: Math.round(p.w * p.d), where: WHERE[id] };
}).sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));

export const TIER_ORDER: Tier[] = ["premium", "golden", "regular"];

/** Built spec per tier, as modelled in the 3D plan. Every stand is 5 m deep and 3.5 m high. */
const SIZE: Record<Tier, { w: number; d: number }> = { premium: { w: 10, d: 5 }, golden: { w: 8, d: 5 }, regular: { w: 6, d: 5 } };
const TWO_POSTS = { ar: "نقطتا شحن", en: "2 charging posts" };

export const TIER_SPEC: Record<Tier, { size: string; area: number; wall: number; platform: number; cars: number; chargers: L }> = {
  premium: { size: "10 × 5 m", area: SIZE.premium.w * SIZE.premium.d, wall: STAND_HEIGHT, platform: 0.22, cars: CARS_PER_TIER.premium, chargers: TWO_POSTS },
  golden: { size: "8 × 5 m", area: SIZE.golden.w * SIZE.golden.d, wall: STAND_HEIGHT, platform: 0.18, cars: CARS_PER_TIER.golden, chargers: TWO_POSTS },
  regular: { size: "6 × 5 m", area: SIZE.regular.w * SIZE.regular.d, wall: STAND_HEIGHT, platform: 0.15, cars: CARS_PER_TIER.regular, chargers: TWO_POSTS },
};
