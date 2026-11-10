import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { needs } from "../src/db/schema.js";
import { boardFilters, boardQuery } from "../src/lib/filters.js";

const render = (q: Record<string, string>) => {
  const where = boardFilters(needs, boardQuery.parse(q));
  return where ? new PgDialect().sqlToQuery(where) : null;
};

describe("board filters", () => {
  it("ignores blanks and normalises values", () => {
    expect(boardQuery.parse({ from: " del ", to: "", flight: "lh 0761", language: " " })).toEqual({ from: "DEL", flight: "LH761" });
    expect(render({})).toBeNull();
    expect(render({ to: "" })).toBeNull();
  });

  it("rejects malformed values", () => {
    expect(boardQuery.safeParse({ from: "DELHI" }).success).toBe(false);
    expect(boardQuery.safeParse({ date: "1 Dec" }).success).toBe(false);
    expect(boardQuery.safeParse({ flight: "???" }).success).toBe(false);
  });

  it("builds one AND clause with bound parameters", () => {
    const q = render({ from: "DEL", to: "ORD", via: "FRA", date: "2026-12-01", flight: "LH761", language: "hindi" })!;
    expect(q.sql).toContain('"needs"."origin" = $1');
    expect(q.sql).toContain('"needs"."destination" = $2');
    expect(q.sql).toContain('"needs"."layovers" @> array[$3]::text[]');
    expect(q.sql).toContain('"needs"."travel_date" = $4');
    expect(q.sql).toContain('"needs"."flight_numbers" @> array[$5]::text[]');
    expect(q.sql).toContain('lower(l) = lower($6)');
    expect(q.params).toEqual(["DEL", "ORD", "FRA", "2026-12-01", "LH761", "hindi"]);
  });
});
