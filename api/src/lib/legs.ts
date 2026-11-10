// Flight legs: normalisation, validation and the flat columns derived from
// them (api/ROUTES.md "Trips"). Pure: no env/db imports, unit-tested.

import type { Leg } from "../db/schema.js";

export const IATA = /^[A-Z]{3}$/;
// Carrier designator (2 chars, letters or digit+letter like "6E") + 1-4 digits
// + optional operational suffix.
export const FLIGHT = /^[A-Z0-9]{2}[0-9]{1,4}[A-Z]?$/;

/** "ai 0101" / "AI-101" / "ai101" → "AI101". Leading zeros in the number are dropped. */
export function normalizeFlightNumber(raw: string): string {
  const s = raw.toUpperCase().replace(/[\s-]/g, "");
  const m = /^([A-Z0-9]{2})(\d{1,5})([A-Z]?)$/.exec(s);
  if (!m) return s;
  return `${m[1]}${Number(m[2])}${m[3]}`;
}

/**
 * `departsAt`/`arrivesAt` are the wall-clock times printed on the ticket, local
 * to each airport, encoded as ISO with a `Z` that does NOT mean UTC (the web
 * sends `YYYY-MM-DDTHH:mm:00Z`). That keeps entry simple and still compares
 * correctly where it matters: a layover's arrival and onward departure are
 * local to the same airport. Never convert them by timezone.
 */
export type LegInput = { flightNumber: string; from: string; to: string; departsAt: string; arrivesAt: string };

const DAY = 24 * 60 * 60_000;

export type DerivedRoute = {
  legs: Leg[];
  origin: string;
  destination: string;
  layovers: string[];
  flightNumbers: string[];
  airlineCode: string;
};

/** Thrown for bad legs; `message` is the caller-facing error code (400). */
export class LegError extends Error {}

/** Validates and normalises 1-4 contiguous legs. */
export function deriveRoute(input: LegInput[]): DerivedRoute {
  if (input.length < 1 || input.length > 4) throw new LegError("legs_count");
  const legs: Leg[] = input.map((l) => {
    const dep = new Date(l.departsAt);
    const arr = new Date(l.arrivesAt);
    if (Number.isNaN(dep.getTime()) || Number.isNaN(arr.getTime())) throw new LegError("invalid_leg_time");
    return {
      flightNumber: normalizeFlightNumber(l.flightNumber),
      from: l.from.toUpperCase().trim(),
      to: l.to.toUpperCase().trim(),
      departsAt: dep.toISOString(),
      arrivesAt: arr.toISOString(),
    };
  });
  for (const [i, l] of legs.entries()) {
    if (!FLIGHT.test(l.flightNumber)) throw new LegError("invalid_flight_number");
    if (!IATA.test(l.from) || !IATA.test(l.to)) throw new LegError("invalid_airport");
    if (l.from === l.to) throw new LegError("leg_same_airports");
    // Times are airport-local wall-clock (see LegInput), so a westbound
    // transpacific flight can land "before" it took off. Only reject what no
    // real flight does: more than a day earlier, or over 36 hours long.
    const span = Date.parse(l.arrivesAt) - Date.parse(l.departsAt);
    if (span <= -DAY || span > 1.5 * DAY) throw new LegError("leg_times_implausible");
    const next = legs[i + 1];
    if (next) {
      if (next.from !== l.to) throw new LegError("legs_not_contiguous");
      if (Date.parse(next.departsAt) < Date.parse(l.arrivesAt)) throw new LegError("legs_overlap_in_time");
    }
  }
  return {
    legs,
    origin: legs[0].from,
    destination: legs[legs.length - 1].to,
    layovers: legs.slice(0, -1).map((l) => l.to),
    flightNumbers: [...new Set(legs.map((l) => l.flightNumber))],
    airlineCode: legs[0].flightNumber.slice(0, 2),
  };
}

/** Time spent at each layover airport: [arrive, depart] in ms. */
export function layoverWindows(legs: Leg[]): Map<string, [number, number]> {
  const out = new Map<string, [number, number]>();
  for (let i = 0; i < legs.length - 1; i++) {
    out.set(legs[i].to, [Date.parse(legs[i].arrivesAt), Date.parse(legs[i + 1].departsAt)]);
  }
  return out;
}
