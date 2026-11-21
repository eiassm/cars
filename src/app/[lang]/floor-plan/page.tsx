import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { VenueViewer } from "@/components/venue/VenueViewer";
import { getDictionary, hasLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/floor-plan">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: getDictionary(lang).venue.title };
}

export default async function FloorPlanPage({ params }: PageProps<"/[lang]/floor-plan">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);
  const v = t.venue;

  return (
    <main className="venue">
      <header className="venue__head">
        <Link href={`/${lang}`} className="venue__title" aria-label={t.brand}>
          <LogoMark className="brand__mark" />
          <span className="brand__rule" />
          <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <h1>{v.title}</h1>
            <span className="brand__en">{v.eyebrow}</span>
          </span>
        </Link>
        <div className="venue__meta">
          <MapPin size={16} aria-hidden="true" />
          <span>{v.place}</span>
          <span style={{ color: "#555" }}>·</span>
          <span>{v.dates}</span>
          <Link href={`/${lang}`} className="btn btn-ghost btn-sm">{v.back}</Link>
        </div>
      </header>
      <VenueViewer lang={lang} t={t} />
    </main>
  );
}
