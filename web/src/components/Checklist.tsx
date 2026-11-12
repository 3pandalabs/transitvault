import { ClipboardCheck } from "lucide-react";
import type { AirportHelp } from "@/lib/types";
import { AirportHelpList } from "./AirportHelp";

// Day-of checklist (static). Shown to the family on their need and in conversations.
// With the need's `airportHelp`, the airline line becomes the route-specific
// airline + official airport-assistance block (api/ROUTES.md "Airport assistance").
const AIRLINE_ITEM = "Book wheelchair or special assistance with the airline: it's free, but ask at least 48 hours before the flight.";
const ITEMS = [
  "Exchange WhatsApp numbers here once you're both comfortable.",
  "Share a recent photo of your parent with the helper, and ask for one of the helper.",
  "Agree on a meeting point: the departure gate, the layover gate, or arrivals.",
  "Give your parent the helper's name and number on paper, not just on a phone.",
  "Tell the helper about medicines, dietary needs or anything your parent finds hard.",
  "Keep boarding passes and passport handy in one easy-to-reach pouch.",
];

export function Checklist({ defaultOpen = false, help }: { defaultOpen?: boolean; help?: AirportHelp }) {
  const items = help ? ITEMS : [AIRLINE_ITEM, ...ITEMS];
  return (
    <details open={defaultOpen} className="group rounded-2xl border border-line bg-white p-5 shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-fg">
        <ClipboardCheck className="size-5 text-accent" /> Before the flight
        <span className="ml-auto text-sm font-normal text-fg-muted group-open:hidden">Show</span>
        <span className="ml-auto hidden text-sm font-normal text-fg-muted group-open:inline">Hide</span>
      </summary>
      {help ? (
        <div className="mt-3 rounded-xl bg-emerald-50/60 p-3">
          <AirportHelpList help={help} />
        </div>
      ) : null}
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" aria-label={item} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
