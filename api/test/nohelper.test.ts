import { describe, expect, it } from "vitest";
import { departureSchedule, NO_HELPER_LEAD_MS, noHelperEmailDue, travelerPhrase, wallClockToUtc } from "../src/lib/landing.js";

const HOUR = 60 * 60_000;
const at = (iso: string) => new Date(iso);

// DEL → FRA → ORD. Departs Delhi 02:30 local on 1 Dec = 2026-11-30T21:00Z (UTC+5:30).
const legs = [
  { flightNumber: "LH761", from: "DEL", to: "FRA", departsAt: "2026-12-01T02:30:00Z", arrivesAt: "2026-12-01T07:15:00Z" },
  { flightNumber: "LH430", from: "FRA", to: "ORD", departsAt: "2026-12-01T10:05:00Z", arrivesAt: "2026-12-01T12:20:00Z" },
];
const postedEarly = at("2026-11-20T10:00:00Z");

describe("no-helper email timing", () => {
  it("reads the FIRST leg's departure in the origin airport's zone", () => {
    const s = departureSchedule(legs);
    expect(s.exact).toBe(true);
    expect(s.departsAt.toISOString()).toBe("2026-11-30T21:00:00.000Z");
    expect(s.sendFrom.toISOString()).toBe("2026-11-30T15:00:00.000Z");
    expect(NO_HELPER_LEAD_MS).toBe(6 * HOUR);
  });

  it("is DST aware at the origin", () => {
    const jfk = (d: string) => [{ flightNumber: "AI102", from: "JFK", to: "DEL", departsAt: d, arrivesAt: d }];
    expect(departureSchedule(jfk("2026-12-01T11:00:00Z")).departsAt.toISOString()).toBe("2026-12-01T16:00:00.000Z"); // EST
    expect(departureSchedule(jfk("2026-07-01T11:00:00Z")).departsAt.toISOString()).toBe("2026-07-01T15:00:00.000Z"); // EDT
  });

  it("is due only inside [departure − 6 h, departure)", () => {
    expect(noHelperEmailDue(legs, postedEarly, at("2026-11-30T14:59:00Z"))).toBe(false); // 6 h 1 min before
    expect(noHelperEmailDue(legs, postedEarly, at("2026-11-30T15:00:00Z"))).toBe(true); // exactly 6 h before
    expect(noHelperEmailDue(legs, postedEarly, at("2026-11-30T20:59:00Z"))).toBe(true); // 1 min before
    expect(noHelperEmailDue(legs, postedEarly, at("2026-11-30T21:00:00Z"))).toBe(false); // departed
    expect(noHelperEmailDue(legs, postedEarly, at("2026-12-01T09:00:00Z"))).toBe(false); // the day itself, after take-off
  });

  it("skips a need posted after the window opened (no fair chance)", () => {
    expect(noHelperEmailDue(legs, at("2026-11-30T15:00:00Z"), at("2026-11-30T16:00:00Z"))).toBe(true);
    expect(noHelperEmailDue(legs, at("2026-11-30T15:30:00Z"), at("2026-11-30T16:00:00Z"))).toBe(false);
  });

  it("unknown origin → earliest possible departure (UTC+14), so never after take-off", () => {
    const xyz = [{ flightNumber: "ZZ1", from: "XYZ", to: "DEL", departsAt: "2026-12-01T12:00:00Z", arrivesAt: "2026-12-01T18:00:00Z" }];
    const s = departureSchedule(xyz);
    expect(s.exact).toBe(false);
    expect(s.departsAt.toISOString()).toBe("2026-11-30T22:00:00.000Z");
    // Whatever the real zone (UTC−12…UTC+14), the real departure is at or after this.
    for (let off = -12; off <= 14; off++) {
      const realDeparture = Date.parse("2026-12-01T12:00:00Z") - off * HOUR;
      expect(s.departsAt.getTime()).toBeLessThanOrEqual(realDeparture);
    }
    expect(noHelperEmailDue(xyz, postedEarly, at("2026-11-30T21:59:00Z"))).toBe(true);
    expect(noHelperEmailDue(xyz, postedEarly, at("2026-11-30T22:00:00Z"))).toBe(false);
  });

  it("landing keeps its LATEST fallback", () => {
    expect(new Date(wallClockToUtc("2026-12-01T12:00:00Z", "XYZ").utcMs).toISOString()).toBe("2026-12-02T00:00:00.000Z");
  });
});

describe("traveller phrase", () => {
  it("addresses the poster", () => {
    expect(travelerPhrase("My mother")).toBe("your mother");
    expect(travelerPhrase("my dad")).toBe("your dad");
    expect(travelerPhrase("Dad (72)")).toBe("dad (72)");
    expect(travelerPhrase("Mother-in-law")).toBe("mother-in-law");
    expect(travelerPhrase("Myra's grandma")).toBe("myra's grandma");
  });
});
