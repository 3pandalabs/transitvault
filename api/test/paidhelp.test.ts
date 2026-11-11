import { describe, expect, it } from "vitest";
import { FEE_CENTS, splitFee } from "../src/lib/fees.js";
import { FEEDBACK_DELAY_MS, landingSchedule, wallClockToUtc } from "../src/lib/landing.js";
import { formEncode, signPayload, verifySignature } from "../src/lib/stripe.js";

const HOUR = 60 * 60_000;

describe("landing time", () => {
  it("reads the wall-clock in the arrival airport's zone (DST aware)", () => {
    // Chicago is UTC-6 in December, UTC-5 in July.
    expect(new Date(wallClockToUtc("2026-12-01T12:20:00Z", "ORD").utcMs).toISOString()).toBe("2026-12-01T18:20:00.000Z");
    expect(new Date(wallClockToUtc("2026-07-01T12:20:00Z", "ORD").utcMs).toISOString()).toBe("2026-07-01T17:20:00.000Z");
    // Delhi is UTC+5:30, no DST.
    expect(new Date(wallClockToUtc("2026-12-01T23:45:00Z", "DEL").utcMs).toISOString()).toBe("2026-12-01T18:15:00.000Z");
  });

  it("falls back to the latest possible instant for unknown airports", () => {
    const r = wallClockToUtc("2026-12-01T12:00:00Z", "XYZ");
    expect(r.exact).toBe(false);
    expect(new Date(r.utcMs).toISOString()).toBe("2026-12-02T00:00:00.000Z");
  });

  it("asks a few hours after the LAST leg lands", () => {
    const legs = [
      { flightNumber: "LH761", from: "DEL", to: "FRA", departsAt: "2026-12-01T02:30:00Z", arrivesAt: "2026-12-01T07:15:00Z" },
      { flightNumber: "LH430", from: "FRA", to: "ORD", departsAt: "2026-12-01T10:05:00Z", arrivesAt: "2026-12-01T12:20:00Z" },
    ];
    const s = landingSchedule(legs);
    expect(s.landsAt.toISOString()).toBe("2026-12-01T18:20:00.000Z");
    expect(s.feedbackDueAt.getTime() - s.landsAt.getTime()).toBe(FEEDBACK_DELAY_MS);
    expect(FEEDBACK_DELAY_MS).toBe(4 * HOUR);
  });
});

describe("fee split", () => {
  it("applies credit first, card pays the rest", () => {
    expect(splitFee(0)).toEqual({ creditAppliedCents: 0, cashCents: FEE_CENTS });
    expect(splitFee(500)).toEqual({ creditAppliedCents: 500, cashCents: 500 });
    expect(splitFee(1500)).toEqual({ creditAppliedCents: 1000, cashCents: 0 });
    expect(splitFee(-200)).toEqual({ creditAppliedCents: 0, cashCents: 1000 });
  });
});

describe("stripe webhook signature", () => {
  const secret = "whsec_test_123";
  const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
  const now = 1_800_000_000;

  it("accepts a correctly signed, fresh payload", () => {
    expect(verifySignature(body, signPayload(body, secret, now), secret, now)).toBe(true);
    // Extra v1 entries (secret rotation) and a v0 are fine.
    const h = `${signPayload(body, secret, now)},v1=deadbeef,v0=abc`;
    expect(verifySignature(body, h, secret, now)).toBe(true);
  });

  it("rejects tampering, wrong secret, staleness and junk", () => {
    expect(verifySignature(body + " ", signPayload(body, secret, now), secret, now)).toBe(false);
    expect(verifySignature(body, signPayload(body, "whsec_other", now), secret, now)).toBe(false);
    expect(verifySignature(body, signPayload(body, secret, now - 301), secret, now)).toBe(false);
    expect(verifySignature(body, undefined, secret, now)).toBe(false);
    expect(verifySignature(body, "garbage", secret, now)).toBe(false);
    expect(verifySignature(body, signPayload(body, secret, now), "", now)).toBe(false);
  });
});

describe("stripe form encoding", () => {
  it("nests objects and arrays the Stripe way", () => {
    const s = formEncode({ mode: "payment", line_items: [{ quantity: 1, price_data: { unit_amount: 500 } }], metadata: { a: "b" }, x: undefined }).toString();
    expect(decodeURIComponent(s)).toBe("mode=payment&line_items[0][quantity]=1&line_items[0][price_data][unit_amount]=500&metadata[a]=b");
  });
});
