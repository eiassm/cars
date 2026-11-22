import Link from "next/link";
import { ExpoLogo } from "./ExpoMark";
import type { Locale } from "@/lib/i18n";
import type { SiteDictionary } from "@/lib/site-i18n";

export function SiteFooter({ lang, s }: { lang: Locale; s: SiteDictionary }) {
  const base = `/${lang}`;
  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div className="site-footer__brand">
          <ExpoLogo lang={lang} />
          <p>{s.footer.about}</p>
          <span className="site-footer__dates">{s.footer.dates}</span>
        </div>
        <nav aria-label={s.footer.explore} className="site-footer__links">
          <strong>{s.footer.explore}</strong>
          <Link href={`${base}/booths`}>{s.nav.booths}</Link>
          <Link href={`${base}/banks`}>{s.nav.banks}</Link>
          <Link href={`${base}/visit`}>{s.nav.visit}</Link>
          <Link href={`${base}#program`}>{s.nav.program}</Link>
          <Link href={`${base}/ev`}>{s.nav.plan3d}</Link>
        </nav>
      </div>
      <div className="container site-footer__base"><small>{s.footer.rights}</small></div>
    </footer>
  );
}
