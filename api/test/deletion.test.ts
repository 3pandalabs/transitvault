import { describe, expect, it } from "vitest";
import {
  blockerKind,
  DELETED_NAME,
  firstName,
  forfeitAmount,
  isTombstoneEmail,
  tombstoneEmail,
  UNUSABLE_PASSWORD_HASH,
} from "../src/lib/deletion.js";
import { verifySecret } from "../src/auth/password.js";

const ID = "7d3c5a8e-1f2b-4c6d-9e0a-123456789abc";

describe("account deletion", () => {
  it("replaces the email with a unique address on a reserved, non-routable TLD", () => {
    const e = tombstoneEmail(ID);
    expect(e).toBe(`deleted+${ID}@transitvault.invalid`);
    expect(isTombstoneEmail(e)).toBe(true);
    expect(isTombstoneEmail(e.toUpperCase())).toBe(true);
    expect(tombstoneEmail(ID)).not.toBe(tombstoneEmail("00000000-0000-4000-8000-000000000000"));
  });

  it("never treats a real address as a tombstone", () => {
    expect(isTombstoneEmail("asha@example.com")).toBe(false);
    expect(isTombstoneEmail("someone@transitvault.invalid.example.com")).toBe(false);
    expect(isTombstoneEmail("support@3pandalabs.com")).toBe(false);
  });

  it("shows a deleted account as 'Deleted user', not 'Deleted'", () => {
    expect(firstName(DELETED_NAME)).toBe("Deleted user");
    expect(firstName("  Asha Mehta ")).toBe("Asha");
  });

  it("blocks deletion while a paid-help acceptance is in flight, on either side", () => {
    expect(blockerKind({ status: "pending_payment", outcome: null })).toBe("pending_payment");
    expect(blockerKind({ status: "confirmed", outcome: null })).toBe("trip_unresolved");
    expect(blockerKind({ status: "confirmed", outcome: "helped" })).toBeNull();
    expect(blockerKind({ status: "confirmed", outcome: "no_show" })).toBeNull();
    expect(blockerKind({ status: "cancelled", outcome: null })).toBeNull();
  });

  it("zeroes the credit balance with one ledger entry, none when already 0", () => {
    expect(forfeitAmount(500)).toBe(-500);
    expect(forfeitAmount(1500)).toBe(-1500);
    expect(forfeitAmount(0)).toBeNull();
  });

  it("leaves a password hash that no password can match", async () => {
    expect(await verifySecret("", UNUSABLE_PASSWORD_HASH)).toBe(false);
    expect(await verifySecret("!deleted", UNUSABLE_PASSWORD_HASH)).toBe(false);
  });
});
