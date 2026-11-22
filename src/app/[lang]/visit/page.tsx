import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footprints, MapPin } from "lucide-react";
import { RegisterForm } from "@/components/RegisterForm";
import { FloorMap } from "@/components/site/FloorMap";
import { PracticalGrid } from "@/components/site/Practical";
import { JourneySteps, PageHero, SectionHead } from "@/components/site/Sections";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getDictionary, hasLocale } from "@/lib/i18n";
import { getSite } from "@/lib/site-i18n";

const SHOTS: Record<string, string> = { food: "/images/shot-food.webp", wc: "/images/shot-wc.webp", stage: "/images/shot-stage.webp", charge: "/images/shot-charge.webp" };
const MAPS = "https://www.google.com/maps/search/?api=1&query=%D8%A7%D9%84%D9%82%D8%B1%D9%8A%D8%A9+%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6%D9%8A%D8%A9+%D8%B1%D8%A7%D9%85+%D8%A7%D9%84%D9%84%D9%87";

export async function generateMetadata({ params }: PageProps<"/[lang]/visit">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const s = getSite(lang);
  return { title: s.visit.title, description: s.visit.hero.body };
}

export default async function Visit({ params }: PageProps<"/[lang]/visit">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);
  const s = getSite(lang);
  const v = s.visit;

  return (
    <>
      <SiteHeader lang={lang} t={t} s={s} page="visit" />
      <main id="main">
        <PageHero kicker={v.hero.kicker} title={v.hero.title} body={v.hero.body}>
          <a href="#register" className="btn btn-primary">{s.cta.register}</a>
          <Link href={`/${lang}/ev?tour=1`} className="btn btn-ghost"><Footprints size={18} aria-hidden="true" />{s.cta.journey}</Link>
        </PageHero>

        <section className="section container">
          <SectionHead kicker={v.practical.kicker} title={v.practical.title} />
          <PracticalGrid s={s} />
          <div className="center-cta"><a href={MAPS} className="btn btn-ghost" target="_blank" rel="noopener noreferrer"><MapPin size={16} aria-hidden="true" />{v.practical.directions}</a></div>
        </section>

        <section className="section section--band">
          <div className="container">
            <SectionHead kicker={v.journey.kicker} title={v.journey.title} body={s.home.journey.body} />
            <FloorMap lang={lang} s={s.map} tiers={s.tiers} filters={["all", "svc"]} />
            <JourneySteps lang={lang} t={t} s={s} />
          </div>
        </section>

        <section className="section container">
          <SectionHead kicker={v.services.kicker} title={v.services.title} />
          <div className="cards">
            {v.services.items.map((it) => (
              <div key={it.key} className="card card--static">
                <span className="card__media"><Image src={SHOTS[it.key]} alt="" fill sizes="(max-width: 700px) 100vw, 300px" /></span>
                <span className="card__body"><h3>{it.title}</h3><p>{it.body}</p></span>
              </div>
            ))}
          </div>
        </section>

        <section className="section section--band" id="register">
          <div className="container split">
            <SectionHead kicker={s.home.register.kicker} title={s.home.register.title} body={s.home.register.body} />
            <div className="panel"><RegisterForm t={t} /></div>
          </div>
        </section>
      </main>
      <SiteFooter lang={lang} s={s} />
    </>
  );
}
