// Facts about the event and the venue, shared by the website and the 3D floor plan.
// Venue geometry is in metres, taken from the 1:250 site plan: x runs west→east,
// y runs north→south (the entrance is on the south side). Values are approximate
// until the photographer's scan and the CAD drawing arrive.

export const GOLD = "#A8883A";

/** 1 May 2027 00:00 and 8 May 2027 00:00, Palestine summer time (UTC+3). */
export const EXPO_OPENS = Date.parse("2027-05-01T00:00:00+03:00");
export const EXPO_CLOSES = Date.parse("2027-05-08T00:00:00+03:00");
export const EXPO_DAYS = 7;

export type Bilingual = { ar: string; en: string };

export type Exhibitor = {
  id: string;
  name: Bilingual;
  city: Bilingual;
  brands: string;
  image: string;
};

// No dealer is confirmed yet, so pavilions stay unbranded. Fill this with the signed exhibitors
// (dealer name, city, brands) and the signs, list and search pick them up.
export const EXHIBITORS: Exhibitor[] = Array.from({ length: 12 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return {
    id: `pavilion-${n}`,
    name: { ar: `جناح ${n}`, en: `Pavilion ${n}` },
    city: { ar: "", en: "" },
    brands: "",
    image: "",
  };
});

/** Outline of the yard (curb line), clockwise from the north-west corner. */
export const LOT: [number, number][] = [
  [0, 0.4], [62, 0], [63, 1.2], [63, 19.6], [57.3, 30.8], [51.6, 42], [50, 44.8], [48.4, 46.6],
  [47.6, 52.8], [36.6, 52.8], [36.2, 61.2], [20, 61.2], [20, 52.8], [12, 52.8], [8.5, 51.5],
  [6, 49], [4.6, 45], [4.4, 41.2],
];

export const LOT_AREA = (() => {
  let a = 0;
  for (let i = 0; i < LOT.length; i++) {
    const p = LOT[i];
    const q = LOT[(i + 1) % LOT.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a / 2);
})();

/** Which side of the booth is open to visitors. "c" = centre pavilion, open on all sides. */
export type Facing = "e" | "w" | "n" | "c";

/** Booth rectangles [x, y, width (E–W), depth (N–S), open side]. Index 0 is the centre pavilion. */
export const BOOTH_RECTS: [number, number, number, number, Facing][] = [
  [26, 36.5, 8, 6.5, "c"],
  [5, 11, 8, 6.5, "e"], [5, 19, 8, 6.5, "e"], [5, 27, 8, 6.5, "e"],
  [49, 11, 8, 6.5, "w"], [49, 19, 8, 6.5, "w"], [46.5, 27, 8, 6.5, "w"],
  [5, 36.5, 7, 6.5, "n"], [14.5, 36.5, 8, 6.5, "n"], [37.5, 36.5, 8, 6.5, "n"],
  [12.5, 45, 7.5, 6.5, "n"], [38, 45, 8, 6.5, "n"],
];

export const BOOTH_WHERE: Bilingual[] = [
  { ar: "الجناح المركزي", en: "Centre pavilion" },
  { ar: "الجهة الغربية", en: "West row" }, { ar: "الجهة الغربية", en: "West row" }, { ar: "الجهة الغربية", en: "West row" },
  { ar: "الجهة الشرقية", en: "East row" }, { ar: "الجهة الشرقية", en: "East row" }, { ar: "الجهة الشرقية", en: "East row" },
  { ar: "الممر الجنوبي", en: "South row" }, { ar: "الممر الجنوبي", en: "South row" }, { ar: "الممر الجنوبي", en: "South row" },
  { ar: "قرب المدخل", en: "By the entrance" }, { ar: "قرب المدخل", en: "By the entrance" },
];

export const SEAT_AREA = { x0: 19, x1: 43, y0: 12.5, y1: 24.5, aisle: 31 };

/** Seat positions [x, y, row] in front of the stage, with a central aisle. */
export const SEATS: [number, number, number][] = (() => {
  const out: [number, number, number][] = [];
  let row = 0;
  for (let y = 13.1; y <= 24.2; y += 0.95, row++) {
    for (let x = 19.35; x <= 42.7; x += 0.6) {
      if (Math.abs(x - SEAT_AREA.aisle) < 0.85) continue;
      out.push([x, y, row]);
    }
  }
  return out;
})();

export type ZoneGroup = "prog" | "booth" | "bank" | "svc";
export type Tier = "premium" | "golden" | "regular";

export type Zone = {
  id: string;
  group: ZoneGroup;
  tag: string;
  x: number;
  y: number;
  w: number;
  d: number;
  name: Bilingual;
  sub: Bilingual;
  note: Bilingual;
  swatch: string;
  facing?: Facing;
  exhibitor?: Exhibitor;
  tier?: Tier;
};

const pad = (n: number) => String(n).padStart(2, "0");

export const ZONES: Zone[] = [
  {
    id: "stage", group: "prog", tag: "ST", x: 23, y: 1.5, w: 16, d: 8, swatch: GOLD,
    name: { ar: "المسرح الرئيسي", en: "Main stage" }, sub: { ar: "Main stage", en: "المسرح الرئيسي" },
    note: {
      ar: "منصة بارتفاع 1.2 م وعرض 16 م، شاشة LED خلفية 12 × 5 م وشاشتان جانبيتان، وتواجه الجمهور نحو الجنوب.",
      en: "A 1.2 m high, 16 m wide platform with a 12 × 5 m LED wall and two side screens, facing the audience to the south.",
    },
  },
  {
    id: "seats", group: "prog", tag: "CR", x: 19, y: 12.5, w: 24, d: 12, swatch: "#8C7A4E",
    name: { ar: "جلوس جمهور المسرح", en: "Stage audience seating" }, sub: { ar: "Stage audience seating", en: "جلوس جمهور المسرح" },
    note: {
      ar: `حوالي ${SEATS.length} مقعداً مع ممر وسطي لمتابعة العروض اليومية، والصفّان الأماميان للضيوف.`,
      en: `About ${SEATS.length} seats with a central aisle for the daily shows; the first two rows are for guests.`,
    },
  },
  {
    id: "foh", group: "prog", tag: "FOH", x: 29, y: 26.5, w: 4, d: 2.5, swatch: "#6E6E6E",
    name: { ar: "التحكم بالصوت والإضاءة", en: "FOH control desk" }, sub: { ar: "FOH control desk", en: "التحكم بالصوت والإضاءة" },
    note: { ar: "منصة التحكم خلف الجمهور في محور المسرح.", en: "Sound and lighting control behind the audience, on the stage axis." },
  },
  {
    id: "vip", group: "svc", tag: "VIP", x: 1.5, y: 1.5, w: 11, d: 7.5, swatch: "#C9C2B0",
    name: { ar: "صالة كبار الضيوف", en: "VIP lounge" }, sub: { ar: "VIP lounge", en: "صالة كبار الضيوف" },
    note: { ar: "خيمة مغطاة بجوار المسرح مع جلسات.", en: "Covered lounge tent beside the stage." },
  },
  {
    id: "media", group: "svc", tag: "BS", x: 47, y: 1.5, w: 14, d: 7.5, swatch: "#C9C2B0",
    name: { ar: "الكواليس والإعلام", en: "Backstage & media" }, sub: { ar: "Backstage & media", en: "الكواليس والإعلام" },
    note: { ar: "غرف التحضير ومنطقة الصحافة والمقابلات خلف المسرح.", en: "Green rooms, press and interview area behind the stage." },
  },
  {
    id: "gate", group: "svc", tag: "IN", x: 20, y: 52.8, w: 16.4, d: 8.4, swatch: "#C9C2B0",
    name: { ar: "المدخل والتسجيل", en: "Entrance & registration" }, sub: { ar: "Entrance & registration", en: "المدخل والتسجيل" },
    note: {
      ar: "المدخل الوحيد للساحة (عرض 17 م) — بوابة الحدث ومكاتب التسجيل والتذاكر.",
      en: "The yard's only entrance (17 m wide) — event gate, registration and ticket desks.",
    },
  },
  ...BOOTH_RECTS.map(([x, y, w, d, facing], i): Zone => {
    const ex = EXHIBITORS[i];
    const area = Math.round(w * d);
    return {
      id: `p${i + 1}`, group: "booth", tag: `P${pad(i + 1)}`, x, y, w, d, facing, exhibitor: ex,
      swatch: i === 0 ? GOLD : "#D9D9D9",
      name: ex.name,
      sub: { ar: "متاح للحجز", en: "Available to book" },
      note: i === 0
        ? { ar: "الجناح المركزي المميز مقابل المدخل مباشرة، بمنصة دوّارة — مقترح للراعي الرئيسي.", en: "The featured centre pavilion facing the entrance, with a turntable — proposed for the main sponsor." }
        : { ar: `جناح وكيل بمساحة ${area} م² مع جدار خلفي يحمل الاسم ومنصة لسيارتين.`, en: `A ${area} m² dealer pavilion with a branded back wall and a platform for two cars.` },
    };
  }),
];

export const ZONE_MAP: Record<string, Zone> = Object.fromEntries(ZONES.map((z) => [z.id, z]));
