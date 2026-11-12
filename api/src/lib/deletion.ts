// Pure pieces of self-service account deletion (api/ROUTES.md "Account
// deletion"). No env or db import, so they're unit-tested directly; the
// transaction itself is lib/accountDeletion.ts.

export const DELETED_NAME = "Deleted user";

/** Reserved TLD (RFC 2606): an address here can never route anywhere. */
export const TOMBSTONE_DOMAIN = "transitvault.invalid";

/** The unique, non-routable placeholder that replaces a deleted user's email. */
export const tombstoneEmail = (userId: string) => `deleted+${userId}@${TOMBSTONE_DOMAIN}`;

/** True for a deleted account's placeholder address (sendMail's last guard). */
export const isTombstoneEmail = (email: string) => email.trim().toLowerCase().endsWith(`@${TOMBSTONE_DOMAIN}`);

/** Not a bcrypt hash, so verifySecret is always false: nobody can sign in as a deleted user. */
export const UNUSABLE_PASSWORD_HASH = "!deleted";

/** First name as shown to other people; a deleted account shows as "Deleted user". */
export const firstName = (name: string) => (name === DELETED_NAME ? DELETED_NAME : name.trim().split(/\s+/)[0]);

export type BlockerKind = "pending_payment" | "trip_unresolved";

/**
 * Does this paid-help acceptance stop its poster or helper from deleting their
 * account? Yes while the checkout is open, or while a confirmed trip has no
 * outcome yet (the "did they help?" answer or the 48 h default decides who gets
 * credit, and both sides may still get emails about it).
 */
export function blockerKind(a: { status: "pending_payment" | "confirmed" | "cancelled"; outcome: string | null }): BlockerKind | null {
  if (a.status === "pending_payment") return "pending_payment";
  if (a.status === "confirmed" && !a.outcome) return "trip_unresolved";
  return null;
}

/** The ledger entry that zeroes a balance on deletion, or null when it's already 0. */
export function forfeitAmount(balanceCents: number): number | null {
  return balanceCents === 0 ? null : -balanceCents;
}
