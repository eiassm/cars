"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Globe, Menu, X } from "lucide-react";
import { LogoMark } from "./Logo";
import type { Dictionary, Locale } from "@/lib/i18n";

const SECTIONS = ["exhibitors", "plan", "program", "visit", "sponsors"] as const;

export function SiteHeader({ lang, t }: { lang: Locale; t: Dictionary }) {
  const [open, setOpen] = useState(false);
  const other: Locale = lang === "ar" ? "en" : "ar";
  const Forward = t.dir === "rtl" ? ArrowLeft : ArrowRight;
  const close = () => setOpen(false);

  return (
    <header className="site-header">
      <div className="site-header__bar">
        <div className="site-header__row">
          <Link href={`/${lang}`} className="brand" aria-label={t.brand}>
            <LogoMark className="brand__mark" />
            <span className="brand__rule" />
            <span className="brand__text">
              <span className="brand__ar">معرض فلسطين للسيارات</span>
              <span className="brand__en" dir="ltr">PALESTINE AUTO EXPO 2027</span>
            </span>
          </Link>
          <nav className="site-nav" aria-label={t.navLabel}>
            {SECTIONS.map((id) => (
              <a key={id} href={`#${id}`}>{t.nav[id]}</a>
            ))}
          </nav>
          <span className="spacer" />
          <Link href={`/${other}`} className="lang-link" hrefLang={other} lang={other} aria-label={t.switchLang}>
            <Globe size={15} color="#777" aria-hidden="true" />
            {t.switchLangShort}
          </Link>
          <a href="#register" className="btn btn-gold btn-sm site-header__cta">
            {t.cta}
            <Forward size={16} aria-hidden="true" />
          </a>
          <button
            type="button"
            className="menu-btn"
            aria-label={open ? t.closeMenu : t.menu}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </div>
        {open && (
          <nav id="mobile-nav" className="mobile-nav" aria-label={t.navLabel}>
            {SECTIONS.map((id, i) => (
              <a key={id} href={`#${id}`} className="mobile-nav__item" onClick={close}>
                {t.nav[id]}
                <span className="mobile-nav__num" dir="ltr">{String(i + 1).padStart(2, "0")}</span>
              </a>
            ))}
            <a href="#register" className="btn btn-gold" onClick={close}>
              {t.cta}
              <Forward size={16} aria-hidden="true" />
            </a>
          </nav>
        )}
      </div>
    </header>
  );
}
