"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CircleCheck, Info } from "lucide-react";
import { EXPO_DAYS } from "@/lib/expo";
import type { Dictionary } from "@/lib/i18n";

const FIRST_WEEKDAY = 6;
const EMPTY = { name: "", phone: "", day: "any", count: "1" };

/**
 * Visit registration. There is no backend yet (database comes in a later stage),
 * so a valid submission only shows the confirmation state on this device.
 */
export function RegisterForm({ t }: { t: Dictionary }) {
  const r = t.register;
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<"name" | "phone" | null>(null);
  const [done, setDone] = useState(false);
  const Forward = t.dir === "rtl" ? ArrowLeft : ArrowRight;

  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setError(null);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 3) return setError("name");
    if (form.phone.replace(/\D/g, "").length < 9) return setError("phone");
    // TODO: send to the registration API once the database is in place.
    setDone(true);
  };

  if (done) {
    return (
      <div className="done" role="status">
        <span className="done__icon"><CircleCheck size={24} aria-hidden="true" /></span>
        <h3>{r.doneTitle}</h3>
        <p>{r.doneBody} <span dir="ltr">{form.phone}</span>.</p>
        <button type="button" onClick={() => { setForm(EMPTY); setDone(false); }}>{r.again}</button>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <label className="field field--wide">
        {r.name}
        <input type="text" autoComplete="name" value={form.name} onChange={set("name")} aria-invalid={error === "name"} />
      </label>
      <label className="field field--wide">
        {r.phone}
        <input
          type="tel"
          dir="ltr"
          inputMode="tel"
          autoComplete="tel"
          placeholder="05X XXX XXXX"
          value={form.phone}
          onChange={set("phone")}
          aria-invalid={error === "phone"}
          style={{ textAlign: t.dir === "rtl" ? "right" : "left" }}
        />
      </label>
      <label className="field">
        {r.day}
        <select value={form.day} onChange={set("day")}>
          <option value="any">{r.anyDay}</option>
          {Array.from({ length: EXPO_DAYS }, (_, i) => (
            <option key={i} value={String(i)}>{t.weekdays[(FIRST_WEEKDAY + i) % 7]} {i + 1} {t.month}</option>
          ))}
        </select>
      </label>
      <label className="field">
        {r.count}
        <select value={form.count} onChange={set("count")}>
          {["1", "2", "3", "4", "5", "6"].map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      {error && (
        <p className="form__error" role="alert"><Info size={16} aria-hidden="true" />{error === "name" ? r.errName : r.errPhone}</p>
      )}
      <button type="submit" className="btn btn-gold">{r.submit}<Forward size={16} aria-hidden="true" /></button>
    </form>
  );
}
