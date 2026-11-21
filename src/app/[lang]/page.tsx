import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Accessibility, ArrowLeft, ArrowRight, Calendar, Clock, Mail, MapPin, MicVocal, Phone, Rotate3d, SquareParking, Store, Ticket,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Countdown } from "@/components/Countdown";
import { Programme } from "@/components/Programme";
import { RegisterForm } from "@/components/RegisterForm";
import { BOOTH_RECTS, BOOTH_WHERE, EXHIBITORS, GOLD, LOT } from "@/lib/expo";
import { getDictionary, hasLocale } from "@/lib/i18n";

const ICONS = { calendar: Calendar, store: Store, mic: MicVocal, pin: MapPin, clock: Clock, ticket: Ticket, parking: SquareParking, access: Accessibility };
type IconKey = keyof typeof ICONS;

const MAP_ZONES = [
  { tag: "ST", x: 23, y: 1.5, w: 16, d: 8, fill: GOLD, stroke: GOLD, text: "#0A0A0A", fs: 2.6 },
  { tag: "", x: 19, y: 12.5, w: 24, d: 12, fill: "#3a3220", stroke: "#8C7A4E", text: "#e9dcb6", fs: 2.2 },
  { tag: "VIP", x: 1.5, y: 1.5, w: 11, d: 7.5, fill: "#2a2a2a", stroke: "#C9C2B0", text: "#e9e9e9", fs: 2 },
  { tag: "BS", x: 47, y: 1.5, w: 14, d: 7.5, fill: "#2a2a2a", stroke: "#C9C2B0", text: "#e9e9e9", fs: 2 },
  { tag: "IN", x: 20.5, y: 53.5, w: 15.5, d: 7, fill: "#2a2a2a", stroke: "#C9C2B0", text: "#e9e9e9", fs: 2.2 },
  ...BOOTH_RECTS.map(([x, y, w, d], i) => ({
    tag: `P${String(i + 1).padStart(2, "0")}`, x, y, w, d,
    fill: i === 0 ? GOLD : "#e3e3e3", stroke: i === 0 ? "#e2c26a" : "#ffffff", text: "#0A0A0A", fs: 1.9,
  })),
];

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);
  const Forward = t.dir === "rtl" ? ArrowLeft : ArrowRight;
  const floorPlan = `/${lang}/ev`;

  return (
    <>
      <SiteHeader lang={lang} t={t} />
      <main id="top">
        <section className="hero">
          <Image src="/images/hero.webp" alt="" fill priority sizes="100vw" className="hero__img" />
          <div className="hero__shade" />
          <div className="container hero__body">
            <span className="chip"><Calendar size={16} aria-hidden="true" />{t.hero.eyebrow}</span>
            <h1>{t.hero.title}</h1>
            <p>{t.hero.sub}</p>
            <div className="hero__ctas">
              <a href="#register" className="btn btn-gold">{t.cta}<Forward size={18} aria-hidden="true" /></a>
              <Link href={floorPlan} className="btn btn-ghost"><Rotate3d size={18} aria-hidden="true" />{t.cta3d}</Link>
            </div>
            <Countdown t={t.countdown} />
          </div>
        </section>

        <section aria-label={t.factsLabel} className="container">
          <div className="facts">
            {t.facts.map((f) => {
              const Icon = ICONS[f.icon as IconKey];
              return (
                <div key={f.label} className="fact">
                  <Icon size={20} aria-hidden="true" />
                  <span className="fact__value" dir="ltr" style={{ textAlign: t.dir === "rtl" ? "right" : "left" }}>{f.value}</span>
                  <span className="fact__label">{f.label}</span>
                  <span className="fact__sub">{f.sub}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section id="exhibitors" className="section container" style={{ paddingTop: 40 }}>
          <div className="section__head">
            <span className="kicker">{t.exhibitors.kicker}</span>
            <h2>{t.exhibitors.title}</h2>
            <p className="lead">{t.exhibitors.body}</p>
          </div>
          <div className="grid-cards">
            {EXHIBITORS.map((ex, i) => (
              <article key={ex.id} className={`ex-card${i === 0 ? " ex-card--featured" : ""}`}>
                <div className="ex-card__media">
                  <Image src={ex.image} alt={ex.name[lang]} fill sizes="(max-width: 600px) 100vw, 320px" />
                  <span className="ex-card__tag latin">{t.exhibitors.booth} P{String(i + 1).padStart(2, "0")}</span>
                </div>
                <div className="ex-card__body">
                  <h3>{ex.name[lang]}</h3>
                  <span className="ex-card__brands" dir="ltr" style={{ textAlign: t.dir === "rtl" ? "right" : "left" }}>{ex.brands}</span>
                  <span className="ex-card__meta">
                    <MapPin size={13} aria-hidden="true" />{ex.city[lang]}<span style={{ color: "#444" }}>·</span>{BOOTH_WHERE[i][lang]}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="plan" className="section section--band">
          <div className="container plan">
            <div className="plan__text">
              <span className="kicker">{t.plan.kicker}</span>
              <h2>{t.plan.title}</h2>
              <p className="lead">{t.plan.body}</p>
              <ul className="plan__list">
                {t.plan.bullets.map((b) => (
                  <li key={b.tag}><span className="tag" dir="ltr" style={{ background: b.color }}>{b.tag}</span>{b.label}</li>
                ))}
              </ul>
              <Link href={floorPlan} className="btn btn-gold"><Rotate3d size={18} aria-hidden="true" />{t.plan.cta}</Link>
            </div>
            <figure className="plan__map">
              <svg viewBox="-4 -4 72 70" role="img" aria-label={t.plan.mapLabel} style={{ direction: "ltr" }}>
                <polygon points={LOT.map((p) => p.join(",")).join(" ")} fill="#1b1c1f" stroke="#d8ccb2" strokeWidth="0.5" />
                {MAP_ZONES.map((z, i) => (
                  <g key={i}>
                    <rect x={z.x} y={z.y} width={z.w} height={z.d} rx="0.6" fill={z.fill} stroke={z.stroke} strokeWidth="0.25" />
                    {z.tag && (
                      <text x={z.x + z.w / 2} y={z.y + z.d / 2 + 0.15} textAnchor="middle" dominantBaseline="middle" fontFamily="Montserrat, sans-serif" fontWeight="700" fontSize={z.fs} fill={z.text}>{z.tag}</text>
                    )}
                  </g>
                ))}
                <path d="M28.2 66 L28.2 62.4 M26.6 63.8 L28.2 62.2 L29.8 63.8" stroke={GOLD} strokeWidth="0.6" fill="none" strokeLinecap="round" />
                <text x="58" y="-0.8" fontFamily="Montserrat, sans-serif" fontWeight="700" fontSize="2.4" fill="#8f8f8f">N ↑</text>
              </svg>
              <figcaption>{t.plan.mapCaption}</figcaption>
            </figure>
          </div>
        </section>

        <section id="program" className="section container">
          <div className="section__head">
            <span className="kicker">{t.program.kicker}</span>
            <h2>{t.program.title}</h2>
            <p className="lead">{t.program.body}</p>
          </div>
          <Programme t={t} />
        </section>

        <section id="visit" className="visit">
          <Image src="/images/visit.webp" alt="" fill sizes="100vw" className="visit__img" />
          <div className="visit__shade" />
          <div className="container">
            <div className="section__head">
              <span className="kicker">{t.visit.kicker}</span>
              <h2 style={{ margin: "6px 0 0", fontSize: "clamp(28px, 3.6vw, 44px)", fontWeight: 800, lineHeight: 1.2 }}>{t.visit.title}</h2>
            </div>
            <div className="grid-cards">
              {t.visit.cards.map((c) => {
                const Icon = ICONS[c.icon as IconKey];
                return (
                  <div key={c.title} className="info-card">
                    <span className="info-card__icon"><Icon size={20} aria-hidden="true" /></span>
                    <h3>{c.title}</h3>
                    <p>{c.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="sponsors" className="section container">
          <div className="section__head">
            <span className="kicker">{t.sponsors.kicker}</span>
            <h2>{t.sponsors.title}</h2>
          </div>
          <div className="tiers">
            {(["main", "gold", "partner"] as const).map((tier, ti) => (
              <div key={tier} className={`tier tier--${tier}`}>
                <span className="tier__label">{t.sponsors.tiers[ti]}</span>
                <div className="tier__slots">
                  {Array.from({ length: [1, 4, 5][ti] }, (_, i) => <div key={i} className="tier__slot">{t.sponsors.logo}</div>)}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="register" className="section section--band">
          <div className="container register">
            <div className="register__intro">
              <span className="kicker">{t.register.kicker}</span>
              <h2>{t.register.title}</h2>
              <p className="lead">{t.register.body}</p>
            </div>
            <div className="register__card">
              <RegisterForm t={t} />
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container">
          <div className="site-footer__brand">
            <strong>{t.brand}</strong>
            <span>{t.footer.dates}</span>
          </div>
          <div className="site-footer__contact">
            <span><Mail size={14} aria-hidden="true" />{t.footer.email}</span>
            <span><Phone size={14} aria-hidden="true" />{t.footer.phone}</span>
          </div>
          <small>© 2027</small>
        </div>
      </footer>
    </>
  );
}
