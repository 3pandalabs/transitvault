import { describe, expect, it } from "vitest";
import { matchReason } from "../src/lib/match.js";

const need = { travelDate: "2026-12-01", flightNumbers: ["LH761", "LH430"], origin: "DEL", destination: "ORD" };

describe("need ↔ flight post matching", () => {
  it("matches on a shared flight number", () => {
    expect(matchReason(need, { travelDate: "2026-12-01", flightNumbers: ["LH761", "LH1234"], origin: "DEL", destination: "MUC" })).toBe("Same flight LH761");
  });
  it("tolerates a one-day difference for shared flights (overnight departures)", () => {
    expect(matchReason(need, { ...need, travelDate: "2026-12-02" })).toBe("Same flights LH761, LH430");
    expect(matchReason(need, { ...need, travelDate: "2026-12-03" })).toBeNull();
  });
  it("matches the same route on the same day without a shared flight", () => {
    expect(matchReason(need, { travelDate: "2026-12-01", flightNumbers: ["AI127"], origin: "DEL", destination: "ORD" })).toBe("Same route DEL → ORD on 1 Dec");
  });
  it("does not match a different route without a shared flight", () => {
    expect(matchReason(need, { travelDate: "2026-12-01", flightNumbers: ["AI127"], origin: "DEL", destination: "SFO" })).toBeNull();
    expect(matchReason(need, { travelDate: "2026-12-02", flightNumbers: ["AI127"], origin: "DEL", destination: "ORD" })).toBeNull();
  });
});
