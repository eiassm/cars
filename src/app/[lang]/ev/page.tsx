import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import { notFound } from "next/navigation";
import { EvPlanner } from "@/components/ev/EvPlanner";
import { getDictionary, hasLocale } from "@/lib/i18n";
import "@/components/ev/ev.css";

const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-grotesk", display: "swap" });

export const viewport: Viewport = { themeColor: "#050a10" };

export async function generateMetadata({ params }: PageProps<"/[lang]/ev">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const e = getDictionary(lang).ev;
  return { title: `${e.title} · ${e.edition}`, description: e.place };
}

/** Interactive 3D plan, EV & plug-in edition. Stands alone from the website. */
export default async function EvPage({ params }: PageProps<"/[lang]/ev">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <main className={grotesk.variable}>
      <EvPlanner lang={lang} t={getDictionary(lang)} />
    </main>
  );
}
