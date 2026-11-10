import type { Leg } from "./types";

export function date(iso: string): string {
  // Date-only strings are calendar dates: format in UTC so they don't shift a day.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = dateOnly ? new Date(`${iso}T00:00:00Z`) : new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(dateOnly ? { timeZone: "UTC" } : {}),
  });
}

/** Real timestamps (messages): local to the viewer. */
export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** "DEL → FRA → ORD" */
export function route(legs: Leg[]): string {
  if (!legs.length) return "";
  return [legs[0].from, ...legs.map((l) => l.to)].join(" → ");
}

// Leg times are the wall-clock times printed on the ticket, local to each
// airport, sent as `YYYY-MM-DDTHH:mm:00Z` with no real offset (api/ROUTES.md).
// Display them by slicing, never via Date, or they shift by the viewer's zone.
export const wallToInput = (iso: string) => iso.slice(0, 16);
export const inputToWall = (v: string) => (v ? `${v}:00Z` : "");
export const wallTime = (iso: string) => iso.slice(11, 16);
export function wallDateTime(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return `${d.toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" })}, ${wallTime(iso)}`;
}

/** International-friendly: optional +, 10–15 digits (matches the API). */
export const PHONE_RE = /^\+?[0-9]{10,15}$/;
