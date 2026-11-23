import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, BatteryCharging, CalendarDays, Landmark, MapPinned, Rotate3d, Route } from "lucide-react";
import { EnquiryForm } from "@/components/site/EnquiryForm";
import { FloorMap } from "@/components/site/FloorMap";
import { PageHero, SectionHead, TierCards } from "@/components/site/Sections";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getDictionary, hasLocale } from "@/lib/i18n";
import { BOOTHS, TIER_ORDER, TIER_SPEC } from "@/lib/site";
import { getSite } from "@/lib/site-i18n";
import { TIER_COLOR } from "@/lib/venue";

const BENEFIT_ICONS = [Route, BatteryCharging, Landmark, BadgeCheck, CalendarDays, MapPinned];

export async function generateMetadata({ params }: PageProps<"/[lang]/booths">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const s = getSite(lang);
  return { title: s.booths.title, description: s.booths.hero.body };
}

export default async function Booths({ params }: PageProps<"/[lang]/booths">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);
  const s = getSite(lang);
  const b = s.booths;
  const R = b.compare.rows;
  const cell = (tier: (typeof TIER_ORDER)[number], key: keyof typeof R) => {
    const spec = TIER_SPEC[tier];
    const spots = BOOTHS.filter((x) => x.tier === tier);
    switch (key) {
      case "size": return spec.size;
      case "area": return `${spec.area} m²`;
      case "wall": return `${spec.wall} m`;
      case "platform": return `${Math.round(spec.platform * 100)} cm`;
      case "finish": return b.compare.finish[tier];
      case "cars": return String(spec.cars);
      case "charging": return spec.chargers[lang];
      case "spots": return `${spots.length} · ${spots.map((x) => x.tag).join(", ")}`;
      case "price": return s.tiers.price;
    }
  };

  return (
    <>
      <SiteHeader lang={lang} t={t} s={s} page="booths" />
      <main id="main">
        <PageHero kicker={b.hero.kicker} title={b.hero.title} body={b.hero.body}>
          <a href="#enquiry" className="btn btn-primary">{s.cta.enquire}</a>
          <Link href={`/${lang}/ev?zone=p1`} className="btn btn-ghost"><Rotate3d size={18} aria-hidden="true" />{s.cta.plan3d}</Link>
        </PageHero>

        <section className="section container">
          <SectionHead kicker={b.benefits.kicker} title={b.benefits.title} />
          <div className="benefits">
            {b.benefits.items.map((it, i) => {
              const Icon = BENEFIT_ICONS[i];
              return (
                <div key={it.title} className="benefit">
                  <span className="benefit__icon"><Icon size={20} aria-hidden="true" /></span>
                  <h3>{it.title}</h3>
                  <p>{it.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="section section--band">
          <div className="container">
            <SectionHead kicker={s.home.tiers.kicker} title={s.home.tiers.title} body={s.home.tiers.body} />
            <TierCards lang={lang} s={s} link />
            <figure className="shot">
              <Image src="/images/shot-booth.webp" alt="" fill sizes="(max-width: 900px) 100vw, 1200px" />
            </figure>
          </div>
        </section>

        <section className="section container">
          <SectionHead kicker={b.compare.kicker} title={b.compare.title} />
          <div className="table-wrap">
            <table className="compare">
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">{b.compare.kicker}</span></th>
                  {TIER_ORDER.map((tier) => <th key={tier} scope="col" style={{ color: TIER_COLOR[tier] }}>{s.tiers[tier].name}</th>)}
                </tr>
              </thead>
              <tbody>
                {(Object.keys(R) as (keyof typeof R)[]).map((key) => (
                  <tr key={key}>
                    <th scope="row">{R[key]}</th>
                    {TIER_ORDER.map((tier) => <td key={tier} dir={["size", "area", "wall", "platform", "cars"].includes(key) ? "ltr" : undefined}>{cell(tier, key)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="section section--band" id="map">
          <div className="container">
            <SectionHead kicker={b.list.kicker} title={b.list.title} body={b.list.body} />
            <FloorMap lang={lang} s={s.map} tiers={s.tiers} filters={["all", "premium", "golden", "regular"]} />
            <div className="table-wrap">
              <table className="booth-list">
                <thead>
                  <tr>{(["tag", "tier", "size", "where", "status"] as const).map((k) => <th key={k} scope="col">{b.list.cols[k]}</th>)}<th scope="col"><span className="sr-only">3D</span></th></tr>
                </thead>
                <tbody>
                  {BOOTHS.map((x) => (
                    <tr key={x.id}>
                      <th scope="row" dir="ltr">{x.tag}</th>
                      <td><span className="pill" style={{ ["--c" as string]: TIER_COLOR[x.tier] }}>{s.tiers[x.tier].name}</span></td>
                      <td dir="ltr">{x.w} × {x.d} m</td>
                      <td>{x.where[lang]}</td>
                      <td className="fmap__free">{s.map.available}</td>
                      <td><Link href={`/${lang}/ev?zone=${x.id}`} className="icon-link" aria-label={`${s.cta.viewIn3d} ${x.tag}`}><Rotate3d size={16} aria-hidden="true" /></Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="section container">
          <SectionHead kicker={b.steps.kicker} title={b.steps.title} />
          <ol className="steps">
            {b.steps.items.map((it, i) => (
              <li key={it.title}><span className="steps__n" dir="ltr">{i + 1}</span><h3>{it.title}</h3><p>{it.body}</p></li>
            ))}
          </ol>
        </section>

        <section className="section section--band" id="enquiry">
          <div className="container split">
            <SectionHead kicker={b.enquiry.kicker} title={b.enquiry.title} body={b.enquiry.body} />
            <div className="panel"><EnquiryForm s={s.enquiry} kind="booth" dir={t.dir} /></div>
          </div>
        </section>
      </main>
      <SiteFooter lang={lang} s={s} />
    </>
  );
}
