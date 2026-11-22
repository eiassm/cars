import { Accessibility, Calendar, Clock, MapPin, SquareParking, Ticket } from "lucide-react";
import type { SiteDictionary } from "@/lib/site-i18n";

const ICONS = { pin: MapPin, calendar: Calendar, clock: Clock, ticket: Ticket, parking: SquareParking, access: Accessibility };

export function PracticalGrid({ s }: { s: SiteDictionary }) {
  return (
    <div className="info-grid">
      {s.visit.practical.items.map((it) => {
        const Icon = ICONS[it.key as keyof typeof ICONS];
        return (
          <div key={it.key} className="info">
            <span className="info__icon"><Icon size={20} aria-hidden="true" /></span>
            <h3>{it.title}</h3>
            <p>{it.body}</p>
          </div>
        );
      })}
    </div>
  );
}
