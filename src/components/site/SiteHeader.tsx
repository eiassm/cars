"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Globe, Menu, Rotate3d, X } from "lucide-react";
import { ExpoLogo } from "./ExpoMark";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { SiteDictionary } from "@/lib/site-i18n";

export type PageKey = "home" | "booths" | "banks" | "visit";

export function SiteHeader({ lang, t, s, page }: { lang: Locale; t: Dictionary; s: SiteDictionary; page: PageKey }) {
  const [open, setOpen] = useState(false);
  const other: Locale = lang === "ar" ? "en" : "ar";
  const Forward = t.dir === "rtl" ? ArrowLeft : ArrowRight;
  const base = `/${lang}`;
  const links: { key: string; href: string; label: string; active: boolean }[] = [
    { key: "booths", href: `${base}/booths`, label: s.nav.booths, active: page === "booths" },
    { key: "banks", href: `${base}/banks`, label: s.nav.banks, active: page === "banks" },
    { key: "visit", href: `${base}/visit`, label: s.nav.visit, active: page === "visit" },
    { key: "program", href: `${base}#program`, label: s.nav.program, active: false },
  ];
  const otherHref = `/${other}${page === "home" ? "" : `/${page}`}`;

  return (
    <header className="site-header">
      <a href="#main" className="skip">{s.skip}</a>
      <div className="container site-header__row">
        <Link href={base} className="site-header__brand" aria-label={t.brand}>
          <ExpoLogo lang={lang} />
        </Link>
        <nav className="site-nav" aria-label={s.navLabel}>
          {links.map((l) => (
            <Link key={l.key} href={l.href} aria-current={l.active ? "page" : undefined}>{l.label}</Link>
          ))}
          <Link href={`${base}/ev`} className="site-nav__3d"><Rotate3d size={15} aria-hidden="true" />{s.nav.plan3d}</Link>
        </nav>
        <span className="spacer" />
        <Link href={otherHref} className="lang-link" hrefLang={other} lang={other} aria-label={t.switchLang}>
          <Globe size={15} aria-hidden="true" />{t.switchLangShort}
        </Link>
        <Link href={`${base}/booths#enquiry`} className="btn btn-primary btn-sm site-header__cta">
          {s.cta.book}<Forward size={16} aria-hidden="true" />
        </Link>
        <button type="button" className="menu-btn" aria-label={open ? s.closeMenu : s.menu} aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen((v) => !v)}>
          {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" className="mobile-nav" aria-label={s.navLabel}>
          {[...links, { key: "3d", href: `${base}/ev`, label: s.nav.plan3d, active: false }].map((l, i) => (
            <Link key={l.key} href={l.href} className="mobile-nav__item" aria-current={l.active ? "page" : undefined} onClick={() => setOpen(false)}>
              {l.label}<span className="mobile-nav__num" dir="ltr">{String(i + 1).padStart(2, "0")}</span>
            </Link>
          ))}
          <Link href={`${base}/booths#enquiry`} className="btn btn-primary" onClick={() => setOpen(false)}>{s.cta.book}<Forward size={16} aria-hidden="true" /></Link>
        </nav>
      )}
    </header>
  );
}
