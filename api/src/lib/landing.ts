// When did the trip really land, and take off? (api/ROUTES.md "Paid help",
// "Nudges"). Pure: no env/db.
//
// Leg times are airport-local wall-clock encoded with a fake `Z` (lib/legs.ts),
// and we deliberately don't ask users for timezones. To know when to ask the
// poster "did they help?", the last leg's arrival is read in the arrival
// airport's IANA zone. This is the one place a wall-clock time is turned into
// a real instant, and the result never feeds back into the stored legs.
//
// Airports not in the table fall back to the LATEST possible real instant
// (wall-clock read as UTC-12), so we never ask before the plane has landed.
// The ask is then at most ~26 h late, which is fine for a 48 h window.

import type { Leg } from "../db/schema.js";

const HOUR = 60 * 60_000;

/** Hours after landing before we email "did they help?". */
export const FEEDBACK_DELAY_MS = 4 * HOUR;
/** No answer this long after the email → treated as "Yes, they helped". */
export const FEEDBACK_WINDOW_MS = 48 * HOUR;

const ZONES: Record<string, string> = {};
const add = (zone: string, codes: string) => codes.split(" ").forEach((c) => (ZONES[c] = zone));
// India and the subcontinent
add("Asia/Kolkata", "DEL BOM BLR HYD MAA AMD COK ATQ CCU TRV GOI GOX PNQ LKO JAI CCJ TRZ IXC NAG IDR BBI GAU VNS PAT IXB IXE STV BDQ VTZ CJB IXM");
add("Asia/Karachi", "KHI LHE ISB");
add("Asia/Dhaka", "DAC");
add("Asia/Kathmandu", "KTM");
add("Asia/Colombo", "CMB");
// Gulf and Middle East
add("Asia/Dubai", "DXB AUH SHJ DWC");
add("Asia/Qatar", "DOH");
add("Asia/Bahrain", "BAH");
add("Asia/Kuwait", "KWI");
add("Asia/Muscat", "MCT");
add("Asia/Riyadh", "RUH JED DMM");
add("Europe/Istanbul", "IST SAW");
// Europe
add("Europe/London", "LHR LGW MAN BHX EDI GLA STN");
add("Europe/Berlin", "FRA MUC BER DUS HAM");
add("Europe/Paris", "CDG ORY");
add("Europe/Amsterdam", "AMS");
add("Europe/Zurich", "ZRH GVA");
add("Europe/Vienna", "VIE");
add("Europe/Brussels", "BRU");
add("Europe/Madrid", "MAD");
add("Europe/Rome", "FCO MXP");
add("Europe/Helsinki", "HEL");
add("Europe/Copenhagen", "CPH");
add("Europe/Dublin", "DUB");
// North America
add("America/New_York", "JFK EWR LGA BOS IAD DCA BWI PHL ATL MIA FLL MCO TPA CLT DTW RDU PIT CLE CMH");
add("America/Chicago", "ORD MDW DFW IAH HOU MSP STL AUS SAT MCI BNA MSY");
add("America/Denver", "DEN SLC");
add("America/Phoenix", "PHX");
add("America/Los_Angeles", "SFO LAX SEA SJC SAN OAK SMF PDX LAS");
add("America/Toronto", "YYZ YOW YUL");
add("America/Vancouver", "YVR");
add("America/Edmonton", "YYC YEG");
// Asia-Pacific
add("Asia/Singapore", "SIN");
add("Asia/Kuala_Lumpur", "KUL");
add("Asia/Bangkok", "BKK");
add("Asia/Hong_Kong", "HKG");
add("Asia/Tokyo", "NRT HND");
add("Asia/Shanghai", "PVG PEK");
add("Australia/Sydney", "SYD");
add("Australia/Melbourne", "MEL");
add("Australia/Perth", "PER");
add("Pacific/Auckland", "AKL");
// Africa
add("Africa/Nairobi", "NBO");
add("Africa/Johannesburg", "JNB");
add("Africa/Addis_Ababa", "ADD");

export const airportZone = (iata: string): string | undefined => ZONES[iata];

/** Offset (ms) of `zone` from UTC at instant `utcMs`. */
function zoneOffset(zone: string, utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/**
 * A wall-clock `YYYY-MM-DDTHH:mm:00Z` at `iata` → the real instant (ms).
 * For an airport not in the table, `fallback` picks the safe side: "latest"
 * (read as UTC-12, the default) for "never before it happened", "earliest"
 * (read as UTC+14) for "never after it happened".
 */
export function wallClockToUtc(wall: string, iata: string, fallback: "latest" | "earliest" = "latest"): { utcMs: number; exact: boolean } {
  const naive = Date.parse(wall);
  const zone = airportZone(iata);
  if (!zone) return { utcMs: fallback === "latest" ? naive + 12 * HOUR : naive - 14 * HOUR, exact: false };
  // Two passes settle the offset across DST changes.
  let utc = naive - zoneOffset(zone, naive);
  utc = naive - zoneOffset(zone, utc);
  return { utcMs: utc, exact: true };
}

/** Real landing of the last leg, and when to ask "did they help?". */
export function landingSchedule(legs: Leg[]): { landsAt: Date; feedbackDueAt: Date; exact: boolean } {
  const last = legs[legs.length - 1];
  const { utcMs, exact } = wallClockToUtc(last.arrivesAt, last.to);
  return { landsAt: new Date(utcMs), feedbackDueAt: new Date(utcMs + FEEDBACK_DELAY_MS), exact };
}

// ---- travel day: "sorry, no one offered to help" (api/ROUTES.md "Nudges") ---

/** How long before the first departure the "no helper" email goes out. */
export const NO_HELPER_LEAD_MS = 6 * HOUR;

/**
 * Real departure of the first leg, read in the origin airport's zone, and the
 * start of the "no helper" window. An origin not in the table falls back to
 * the EARLIEST possible instant, so the email is never sent after departure.
 */
export function departureSchedule(legs: Leg[]): { departsAt: Date; sendFrom: Date; exact: boolean } {
  const first = legs[0];
  const { utcMs, exact } = wallClockToUtc(first.departsAt, first.from, "earliest");
  return { departsAt: new Date(utcMs), sendFrom: new Date(utcMs - NO_HELPER_LEAD_MS), exact };
}

/**
 * Is the "no helper" email due now? Only inside [departure − 6 h, departure),
 * and not for a need posted after that window opened (it never had a fair
 * chance; the day-after nudge covers it). The DB conditions (open, not hidden,
 * zero conversations, not yet emailed) live in the sweep's query.
 */
export function noHelperEmailDue(legs: Leg[], createdAt: Date, now: Date): boolean {
  const { departsAt, sendFrom } = departureSchedule(legs);
  const t = now.getTime();
  return t >= sendFrom.getTime() && t < departsAt.getTime() && createdAt.getTime() <= sendFrom.getTime();
}

/** "My mother" → "your mother", "Dad (72)" → "dad (72)": the traveller, addressed to the poster. */
export function travelerPhrase(label: string): string {
  const s = label.trim();
  if (/^my\s/i.test(s)) return `your ${s.slice(3).trimStart()}`;
  return s.charAt(0).toLowerCase() + s.slice(1);
}
