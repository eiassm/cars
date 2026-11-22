import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, Check, Store, Waypoints, Zap, Rotate3d } from "lucide-react";
import { EnquiryForm } from "@/components/site/EnquiryForm";
import { FloorMap } from "@/components/site/FloorMap";
import { PageHero, SectionHead } from "@/components/site/Sections";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getDictionary, hasLocale } from "@/lib/i18n";
import { getSite } from "@/lib/site-i18n";

const ICONS = [Waypoints, Store, Zap, CalendarDays];

export async function generateMetadata({ params }: PageProps<"/[lang]/banks">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const s = getSite(lang);
  return { title: s.banks.title, description: s.banks.hero.body };
}

export default async function Banks({ params }: PageProps<"/[lang]/banks">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);
  const s = getSite(lang);
  const k = s.banks;

  return (
    <>
      <SiteHeader lang={lang} t={t} s={s} page="banks" />
      <main id="main">
        <PageHero kicker={k.hero.kicker} title={k.hero.title} body={k.hero.body}>
          <a href="#enquiry" className="btn btn-primary">{s.cta.enquire}</a>
          <Link href={`/${lang}/ev?zone=b2`} className="btn btn-ghost"><Rotate3d size={18} aria-hidden="true" />{s.cta.viewIn3d}</Link>
        </PageHero>

        <section className="section container">
          <SectionHead kicker={k.benefits.kicker} title={k.benefits.title} />
          <div className="benefits benefits--4">
            {k.benefits.items.map((it, i) => {
              const Icon = ICONS[i];
              return (
                <div key={it.title} className="benefit benefit--bank">
                  <span className="benefit__icon"><Icon size={20} aria-hidden="true" /></span>
                  <h3>{it.title}</h3>
                  <p>{it.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="section section--band">
          <div className="container kiosk">
            <figure className="kiosk__img"><Image src="/images/shot-banks.webp" alt="" fill sizes="(max-width: 900px) 100vw, 640px" /></figure>
            <div>
              <SectionHead kicker={k.kiosk.kicker} title={k.kiosk.title} body={k.kiosk.layout} />
              <ul className="checks">
                {k.kiosk.items.map((it) => <li key={it}><Check size={16} aria-hidden="true" />{it}</li>)}
              </ul>
            </div>
          </div>
        </section>

        <section className="section container">
          <SectionHead kicker={k.map.kicker} title={k.map.title} />
          <FloorMap lang={lang} s={s.map} tiers={s.tiers} filters={["all", "bank"]} initial="bank" initialSel="b2" />
        </section>

        <section className="section section--band" id="enquiry">
          <div className="container split">
            <SectionHead kicker={k.enquiry.kicker} title={k.enquiry.title} body={k.enquiry.body} />
            <div className="panel"><EnquiryForm s={s.enquiry} kind="bank" dir={t.dir} /></div>
          </div>
        </section>
      </main>
      <SiteFooter lang={lang} s={s} />
    </>
  );
}
