import type { Metadata, Viewport } from "next";
import { Cairo, Montserrat } from "next/font/google";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale, LOCALES } from "@/lib/i18n";
import "../globals.css";

const cairo = Cairo({ subsets: ["arabic", "latin"], weight: ["400", "500", "600", "700", "800", "900"], variable: "--font-cairo", display: "swap" });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-montserrat", display: "swap" });

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = getDictionary(lang);
  return {
    title: { default: t.brand, template: `%s · ${t.brand}` },
    description: t.hero.sub,
    alternates: { languages: { ar: "/ar", en: "/en" } },
  };
}

export const viewport: Viewport = { themeColor: "#0a0a0a", colorScheme: "dark" };

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);
  return (
    <html lang={lang} dir={t.dir} className={`${cairo.variable} ${montserrat.variable}`}>
      <body>{children}</body>
    </html>
  );
}
