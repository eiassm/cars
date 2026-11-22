import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Rotate3d } from "lucide-react";
import { Countdown } from "@/components/Countdown";
import { Programme } from "@/components/Programme";
import { RegisterForm } from "@/components/RegisterForm";
import { Rings } from "@/components/site/ExpoMark";
import { FloorMap } from "@/components/site/FloorMap";
import { JourneySteps, SectionHead, StatsStrip, TierCards } from "@/components/site/Sections";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { PracticalGrid } from "@/components/site/Practical";
import { getDictionary, hasLocale } from "@/lib/i18n";
import { getSite } from "@/lib/site-i18n";

const CARD_IMAGES: Record<string, string> = {
  booths: "/images/shot-booth-card.webp",
  banks: "/images/shot-banks.webp",
  stage: "/images/shot-stage.webp",
  food: "/images/shot-food.webp",
};

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);
  const s = getSite(lang);
  const h = s.home;
  const Forward = t.dir === "rtl" ? ArrowLeft : ArrowRight;
  const base = `/${lang}`;
  const hrefOf = (k: string) => (k === "program" ? `${base}#program` : `${base}/${k}`);

  return (
    <>
      <SiteHeader lang={lang} t={t} s={s} page="home" />
      <main id="main">
        <section className="hero">
          <Rings className="hero__rings" />
          <div className="container hero__body">
            <span className="chip">{h.hero.kicker}</span>
            <h1>{h.hero.title}</h1>
            <p className="hero__line">{h.hero.line}</p>
            <p className="hero__text">{h.hero.body}</p>
            <div className="hero__ctas">
              <Link href={`${base}/booths#enquiry`} className="btn btn-primary">{s.cta.book}<Forward size={18} aria-hidden="true" /></Link>
              <Link href={`${base}/ev`} className="btn btn-ghost"><Rotate3d size={18} aria-hidden="true" />{s.cta.plan3d}</Link>
            </div>
            <Countdown t={t.countdown} />
          </div>
        </section>

        <StatsStrip s={s} />

        <section className="section container" id="inside">
          <SectionHead kicker={h.inside.kicker} title={h.inside.title} body={h.inside.body} />
          <div className="cards">
            {h.inside.cards.map((c) => (
              <Link key={c.key} href={hrefOf(c.href)} className="card">
                <span className="card__media"><Image src={CARD_IMAGES[c.key]} alt="" fill sizes="(max-width: 700px) 100vw, 300px" /></span>
                <span className="card__body">
                  <h3>{c.title}</h3>
                  <p>{c.body}</p>
                  <span className="card__more">{s.nav[c.href as keyof typeof s.nav] ?? c.title}<Forward size={15} aria-hidden="true" /></span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="section section--band" id="map">
          <div className="container">
            <SectionHead kicker={h.map.kicker} title={h.map.title} body={h.map.body} />
            <FloorMap lang={lang} s={s.map} tiers={s.tiers} />
            <Link href={`${base}/ev`} className="render-pair" aria-label={s.cta.plan3d}>
              <span className="render-pair__img"><Image src="/images/venue-day.webp" alt="" fill sizes="(max-width: 700px) 100vw, 600px" /></span>
              <span className="render-pair__img"><Image src="/images/venue-night.webp" alt="" fill sizes="(max-width: 700px) 100vw, 600px" /></span>
              <span className="render-pair__label"><Rotate3d size={18} aria-hidden="true" />{h.map.render}<Forward size={16} aria-hidden="true" /></span>
            </Link>
          </div>
        </section>

        <section className="section container" id="tiers">
          <SectionHead kicker={h.tiers.kicker} title={h.tiers.title} body={h.tiers.body} />
          <TierCards lang={lang} s={s} />
          <div className="center-cta"><Link href={`${base}/booths`} className="btn btn-ghost">{s.cta.allBooths}<Forward size={16} aria-hidden="true" /></Link></div>
        </section>

        <section className="section section--band" id="journey">
          <div className="container">
            <SectionHead kicker={h.journey.kicker} title={h.journey.title} body={h.journey.body} />
            <JourneySteps lang={lang} t={t} s={s} />
          </div>
        </section>

        <section className="section container" id="program">
          <SectionHead kicker={h.program.kicker} title={h.program.title} body={h.program.body} />
          <Programme t={t} />
        </section>

        <section className="section container" id="visit">
          <SectionHead kicker={h.visit.kicker} title={h.visit.title} />
          <PracticalGrid s={s} />
          <div className="center-cta"><Link href={`${base}/visit`} className="btn btn-ghost">{s.cta.visit}<Forward size={16} aria-hidden="true" /></Link></div>
        </section>

        <section className="section section--band" id="register">
          <div className="container split">
            <SectionHead kicker={h.register.kicker} title={h.register.title} body={h.register.body} />
            <div className="panel"><RegisterForm t={t} /></div>
          </div>
        </section>
      </main>
      <SiteFooter lang={lang} s={s} />
    </>
  );
}
