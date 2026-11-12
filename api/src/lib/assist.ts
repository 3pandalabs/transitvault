import { AIRLINES } from "../data/airlines.js";
import { AIRPORT_ASSISTANCE, type AirportAssistEntry, type Journey } from "../data/airportAssistance.js";

// Official airport assistance (api/ROUTES.md "Airport assistance"). Pure: no
// env, no DB, so the unit tests and the web payload use the same selection.

export type RouteRole = "origin" | "layover" | "destination";

/** What the traveller does at an airport in that role, and so what the service must cover. */
const JOURNEY: Record<RouteRole, Journey> = { origin: "departure", layover: "transit", destination: "arrival" };

export type AirportAssist = {
  iata: string;
  role: RouteRole;
  airport: string;
  provider: string;
  operator: string;
  authority: string;
  covers: Journey[];
  priceNote: string;
  /** Path on the API host (`/go/assist/:iata?need=`): logs the click, then 302s to the provider. */
  bookPath: string;
};

export type AirlineAssist = { code: string; name: string | null };

export type AirportHelp = { airports: AirportAssist[]; airlines: AirlineAssist[] };

type Route = { origin: string; layovers: string[]; destination: string };

/** Origin, layovers, destination in travel order, each airport once (first role wins). */
export function routeAirports(r: Route): { iata: string; role: RouteRole }[] {
  const all: { iata: string; role: RouteRole }[] = [
    { iata: r.origin, role: "origin" },
    ...r.layovers.map((iata) => ({ iata, role: "layover" as const })),
    { iata: r.destination, role: "destination" },
  ];
  const seen = new Set<string>();
  return all.filter((a) => (seen.has(a.iata) ? false : (seen.add(a.iata), true)));
}

/**
 * The airports on this route that have an official service covering what the
 * traveller does there (departing at the origin, transferring at a layover,
 * arriving at the destination).
 */
export function assistForRoute(r: Route, table: Record<string, AirportAssistEntry> = AIRPORT_ASSISTANCE) {
  return routeAirports(r).flatMap(({ iata, role }) => {
    const e = table[iata];
    return e && e.covers.includes(JOURNEY[role]) ? [{ entry: e, role }] : [];
  });
}

export function bookPath(iata: string, needId?: string | null): string {
  return `/go/assist/${iata}${needId ? `?need=${encodeURIComponent(needId)}` : ""}`;
}

/** The provider URL with the referral parameter (e.g. `ref=transitvault`) appended when one is set. */
export function providerUrl(e: Pick<AirportAssistEntry, "url" | "affiliateParam">): string {
  const param = e.affiliateParam.trim().replace(/^[?&]+/, "");
  if (!param) return e.url;
  const hashAt = e.url.indexOf("#");
  const base = hashAt >= 0 ? e.url.slice(0, hashAt) : e.url;
  const hash = hashAt >= 0 ? e.url.slice(hashAt) : "";
  const sep = base.includes("?") ? (base.endsWith("?") || base.endsWith("&") ? "" : "&") : "?";
  return `${base}${sep}${param}${hash}`;
}

/** Airlines on the trip, from the flight numbers' two-character prefix ("LH761" → Lufthansa). */
export function airlinesFor(flightNumbers: string[]): AirlineAssist[] {
  const codes = [...new Set(flightNumbers.map((f) => f.slice(0, 2).toUpperCase()))];
  return codes.map((code) => ({ code, name: AIRLINES[code] ?? null }));
}

export function airportHelp(r: Route & { flightNumbers: string[] }, needId: string | null): AirportHelp {
  return {
    airports: assistForRoute(r).map(({ entry: e, role }) => ({
      iata: e.iata,
      role,
      airport: e.airport,
      provider: e.provider,
      operator: e.operator,
      authority: e.authority,
      covers: e.covers,
      priceNote: e.priceNote,
      bookPath: bookPath(e.iata, needId),
    })),
    airlines: airlinesFor(r.flightNumbers),
  };
}

const airlineNames = (airlines: AirlineAssist[]) =>
  airlines.map((a) => a.name ?? a.code).join(" and ") || "the airline";

const htmlEsc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The email block: the free airline line, then one line per airport with an
 * official paid service, linking through the API's click redirect.
 */
export function assistMailBlock(r: Route & { flightNumbers: string[] }, needId: string, apiBase: string): { text: string; html: string } {
  const help = airportHelp(r, needId);
  const base = apiBase.replace(/\/$/, "");
  const airline = `Ask ${airlineNames(help.airlines)} for free wheelchair / special assistance, at least 48 hours before the flight.`;
  const lines = help.airports.map((a) => ({
    label: `Book official airport assistance at ${a.airport} (${a.iata}): ${a.provider} (paid, ${a.authority}). ${a.priceNote}`,
    url: `${base}${a.bookPath}`,
  }));
  const disclaimer = "These are third-party paid services; TransitVault doesn't operate them and isn't paid for them.";
  const text = [airline, ...lines.map((l) => `${l.label}\n${l.url}`), ...(lines.length ? [disclaimer] : [])].join("\n\n");
  const html = `<div style="font-size:14px;line-height:1.6;border-top:1px solid #e5e7eb;margin-top:16px;padding-top:12px;">
  <p style="margin:0 0 8px;">${htmlEsc(airline)}</p>
  ${lines.map((l) => `<p style="margin:0 0 8px;"><a href="${htmlEsc(l.url)}">${htmlEsc(l.label)}</a></p>`).join("\n  ")}
  ${lines.length ? `<p style="margin:0;color:#6b7280;font-size:13px;">${htmlEsc(disclaimer)}</p>` : ""}
</div>`;
  return { text, html };
}
