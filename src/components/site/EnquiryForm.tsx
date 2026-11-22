"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CircleCheck, Info } from "lucide-react";
import type { Tier } from "@/lib/expo";
import type { SiteDictionary } from "@/lib/site-i18n";

type Kind = "booth" | "bank";
const EMPTY = { company: "", contact: "", phone: "", email: "", interest: "any", message: "" };

/**
 * Exhibitor / bank enquiry. There is no backend yet (the database comes in a later stage),
 * so a valid submission only shows the confirmation state on this device.
 */
export function EnquiryForm({ s, kind, dir, initialTier }: { s: SiteDictionary["enquiry"]; kind: Kind; dir: "rtl" | "ltr"; initialTier?: Tier }) {
  const [form, setForm] = useState({ ...EMPTY, interest: kind === "bank" ? "bank" : initialTier ?? "any" });
  const [error, setError] = useState<"company" | "contact" | "phone" | null>(null);
  const [done, setDone] = useState(false);
  const Forward = dir === "rtl" ? ArrowLeft : ArrowRight;
  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) => { setForm((f) => ({ ...f, [key]: e.target.value })); setError(null); };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (form.company.trim().length < 2) return setError("company");
    if (form.contact.trim().length < 3) return setError("contact");
    if (form.phone.replace(/\D/g, "").length < 9) return setError("phone");
    // TODO: send to the enquiries API once the database is in place.
    setDone(true);
  };

  if (done) {
    return (
      <div className="done" role="status">
        <span className="done__icon"><CircleCheck size={24} aria-hidden="true" /></span>
        <h3>{s.doneTitle}</h3>
        <p>{s.doneBody} <span dir="ltr">{form.phone}</span>.</p>
        <button type="button" onClick={() => { setForm({ ...EMPTY, interest: kind === "bank" ? "bank" : "any" }); setDone(false); }}>{s.again}</button>
      </div>
    );
  }

  const ltr = { textAlign: dir === "rtl" ? "right" : "left" } as const;
  return (
    <form className="form" onSubmit={submit} noValidate>
      <label className="field">{s.company}<input type="text" autoComplete="organization" value={form.company} onChange={set("company")} aria-invalid={error === "company"} /></label>
      <label className="field">{s.contact}<input type="text" autoComplete="name" value={form.contact} onChange={set("contact")} aria-invalid={error === "contact"} /></label>
      <label className="field">{s.phone}<input type="tel" dir="ltr" inputMode="tel" autoComplete="tel" placeholder="05X XXX XXXX" value={form.phone} onChange={set("phone")} aria-invalid={error === "phone"} style={ltr} /></label>
      <label className="field">{s.email}<input type="email" dir="ltr" autoComplete="email" value={form.email} onChange={set("email")} style={ltr} /></label>
      <label className="field field--wide">
        {s.interest}
        <select value={form.interest} onChange={set("interest")}>
          {kind === "bank" ? <option value="bank">{s.bank}</option> : (
            (["premium", "golden", "regular", "any"] as const).map((k) => <option key={k} value={k}>{s.booths[k]}</option>)
          )}
        </select>
      </label>
      <label className="field field--wide">{s.message}<textarea rows={3} value={form.message} onChange={set("message")} /></label>
      {error && <p className="form__error" role="alert"><Info size={16} aria-hidden="true" />{error === "company" ? s.errCompany : error === "contact" ? s.errContact : s.errPhone}</p>}
      <button type="submit" className="btn btn-primary">{s.submit}<Forward size={16} aria-hidden="true" /></button>
    </form>
  );
}
