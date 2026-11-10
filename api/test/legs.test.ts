import { describe, expect, it } from "vitest";
import { deriveRoute, LegError, normalizeFlightNumber } from "../src/lib/legs.js";

// DEL → FRA → ORD, the "mom flying Delhi to Chicago" case. Local wall-clock times.
const legs = [
  { flightNumber: "lh 0761", from: "del", to: "FRA", departsAt: "2026-12-01T02:30:00Z", arrivesAt: "2026-12-01T07:15:00Z" },
  { flightNumber: "LH430", from: "FRA", to: "ORD", departsAt: "2026-12-01T10:05:00Z", arrivesAt: "2026-12-01T12:20:00Z" },
];

describe("legs", () => {
  it("normalises flight numbers", () => {
    expect(normalizeFlightNumber("ai 0127")).toBe("AI127");
    expect(normalizeFlightNumber("6e-2134")).toBe("6E2134");
  });

  it("derives origin, destination, layovers and flights from a connecting itinerary", () => {
    expect(deriveRoute(legs)).toMatchObject({
      origin: "DEL",
      destination: "ORD",
      layovers: ["FRA"],
      flightNumbers: ["LH761", "LH430"],
    });
  });

  it("treats a single leg as a direct flight", () => {
    expect(deriveRoute([legs[0]]).layovers).toEqual([]);
  });

  it("rejects legs that don't connect", () => {
    expect(() => deriveRoute([legs[0], { ...legs[1], from: "MUC" }])).toThrow(LegError);
  });

  it("rejects a connection that leaves before the first flight lands", () => {
    expect(() => deriveRoute([legs[0], { ...legs[1], departsAt: "2026-12-01T06:00:00Z" }])).toThrow("legs_overlap_in_time");
  });

  it("accepts a westbound date-line flight that lands 'before' it departs (local times)", () => {
    const hnd = { flightNumber: "NH106", from: "HND", to: "LAX", departsAt: "2026-12-01T17:00:00Z", arrivesAt: "2026-12-01T10:30:00Z" };
    expect(() => deriveRoute([hnd])).not.toThrow();
  });

  it("rejects more than four legs or a bad airport code", () => {
    expect(() => deriveRoute([...legs, ...legs, legs[0]])).toThrow("legs_count");
    expect(() => deriveRoute([{ ...legs[0], to: "FRANKFURT" }])).toThrow(LegError);
  });
});
