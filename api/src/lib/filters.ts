import { and, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { flightPosts, needs } from "../db/schema.js";
import { FLIGHT, normalizeFlightNumber } from "./legs.js";

// Board filters for GET /needs and GET /flights (api/ROUTES.md "Board filters").
// Every filter is optional; blank values are ignored so the web form can send
// its fields as-is.

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const airport = z.preprocess(blank, z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "IATA airport code").optional());

export const boardQuery = z.object({
  from: airport,
  to: airport,
  via: airport,
  date: z.preprocess(blank, z.string().date().optional()),
  flight: z.preprocess(
    blank,
    z
      .string()
      .trim()
      .max(10)
      .transform(normalizeFlightNumber)
      .refine((f) => FLIGHT.test(f), "flight number like AI101")
      .optional(),
  ),
  language: z.preprocess(blank, z.string().trim().max(40).optional()),
});

export type BoardQuery = z.infer<typeof boardQuery>;

type Table = typeof needs | typeof flightPosts;

export function boardFilters(t: Table, q: BoardQuery): SQL | undefined {
  return and(
    q.from ? eq(t.origin, q.from) : undefined,
    q.to ? eq(t.destination, q.to) : undefined,
    q.via ? sql`${t.layovers} @> array[${q.via}]::text[]` : undefined,
    q.date ? eq(t.travelDate, q.date) : undefined,
    q.flight ? sql`${t.flightNumbers} @> array[${q.flight}]::text[]` : undefined,
    q.language ? sql`exists (select 1 from unnest(${t.languages}) l where lower(l) = lower(${q.language}))` : undefined,
  );
}
