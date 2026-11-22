// Facts for the public site, derived from the venue model so the site and the 3D plan never disagree.
import type { Tier } from "./expo";
import { CHARGERS_V2, PLACES, SEATS_V2, TIERS, YARD_AREA } from "./venue";

type L = { ar: string; en: string };

export const STATS = {
  days: 7,
  pavilions: 12,
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
  p10: { ar: "الممر الجنوبي", en: "South aisle" },
  p11: { ar: "الممر الجنوبي", en: "South aisle" },
  p12: { ar: "الممر الجنوبي، آخر محطة قبل الخروج", en: "South aisle, the last stop before the exit" },
};

export type BoothInfo = { id: string; tag: string; tier: Tier; w: number; d: number; area: number; where: L; hub: boolean };

export const BOOTHS: BoothInfo[] = Object.keys(TIERS).map((id) => {
  const p = PLACES[id];
  const n = id.slice(1).padStart(2, "0");
  return { id, tag: `P${n}`, tier: TIERS[id], w: p.w, d: p.d, area: Math.round(p.w * p.d), where: WHERE[id], hub: p.kind === "hub" };
}).sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));

export const TIER_ORDER: Tier[] = ["premium", "golden", "regular"];

/** Built spec per tier, as modelled in the 3D plan. */
export const TIER_SPEC: Record<Tier, { wall: number; platform: number; cars: number; chargers: L }> = {
  premium: { wall: 4.6, platform: 0.34, cars: 2, chargers: { ar: "نقطتا شحن (والجناح المركزي: شاحنان سريعان DC)", en: "2 charging posts (centre pavilion: 2 DC fast chargers)" } },
  golden: { wall: 3.6, platform: 0.22, cars: 2, chargers: { ar: "نقطتا شحن", en: "2 charging posts" } },
  regular: { wall: 3.4, platform: 0.18, cars: 2, chargers: { ar: "نقطتا شحن", en: "2 charging posts" } },
};
