import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import { db, type DbOrTx } from "../db/index.js";
import { creditEntries, flightPosts, helperAcceptances, needs, passwordResetTokens, sessions, userBlocks, users } from "../db/schema.js";
import { blockerKind, DELETED_NAME, forfeitAmount, tombstoneEmail, UNUSABLE_PASSWORD_HASH, type BlockerKind } from "./deletion.js";
import { creditBalance } from "./payments.js";

// Self-service account deletion (api/ROUTES.md "Account deletion"). The user
// row is anonymised rather than deleted: conversations, messages, paid-help
// acceptances and the credit ledger point at it, and the other people in those
// conversations keep their history.

export type DeletionBlocker = {
  kind: BlockerKind;
  role: "poster" | "helper";
  conversationId: string;
  needId: string;
  origin: string;
  destination: string;
  travelDate: string;
};

/** Paid-help acceptances (either side) that must resolve before the account can go. */
export async function blockersFor(userId: string, q: DbOrTx = db): Promise<DeletionBlocker[]> {
  const rows = await q
    .select({ a: helperAcceptances, origin: needs.origin, destination: needs.destination, travelDate: needs.travelDate })
    .from(helperAcceptances)
    .innerJoin(needs, eq(needs.id, helperAcceptances.needId))
    .where(
      and(
        or(eq(helperAcceptances.posterId, userId), eq(helperAcceptances.helperId, userId)),
        ne(helperAcceptances.status, "cancelled"),
      ),
    );
  return rows.flatMap((r) => {
    const kind = blockerKind(r.a);
    if (!kind) return [];
    return [
      {
        kind,
        role: r.a.posterId === userId ? "poster" : "helper",
        conversationId: r.a.conversationId,
        needId: r.a.needId,
        origin: r.origin,
        destination: r.destination,
        travelDate: r.travelDate,
      } satisfies DeletionBlocker,
    ];
  });
}

export type DeleteResult =
  | { ok: true; forfeitedCents: number }
  | { ok: false; reason: "blocked"; blockers: DeletionBlocker[] }
  | { ok: false; reason: "already_deleted" };

/** Everything in one transaction; blockers re-checked under the user row lock. */
export async function deleteAccount(userId: string): Promise<DeleteResult> {
  return db.transaction(async (tx) => {
    // acceptHelper locks the poster (for update) and the helper (for share), so
    // no acceptance involving this user can commit between here and the end.
    const locked = await tx.execute(sql`select id, deleted_at from users where id = ${userId} for update`);
    const u = locked.rows[0] as { id: string; deleted_at: Date | null } | undefined;
    if (!u || u.deleted_at) return { ok: false, reason: "already_deleted" } as const;

    const blockers = await blockersFor(userId, tx);
    if (blockers.length) return { ok: false, reason: "blocked", blockers } as const;

    const now = new Date();
    await tx
      .update(needs)
      .set({ status: "closed", updatedAt: now })
      .where(and(eq(needs.userId, userId), inArray(needs.status, ["open", "found"])));
    await tx.update(flightPosts).set({ status: "closed", updatedAt: now }).where(and(eq(flightPosts.userId, userId), eq(flightPosts.status, "open")));

    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
    await tx.delete(userBlocks).where(or(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, userId)));

    const forfeit = forfeitAmount(await creditBalance(userId, tx));
    if (forfeit !== null) await tx.insert(creditEntries).values({ userId, amountCents: forfeit, reason: "account_deleted" });

    await tx
      .update(users)
      .set({
        name: DELETED_NAME,
        email: tombstoneEmail(userId),
        phone: "",
        passwordHash: UNUSABLE_PASSWORD_HASH,
        alertsEnabled: false,
        deletedAt: now,
      })
      .where(eq(users.id, userId));
    return { ok: true, forfeitedCents: forfeit === null ? 0 : -forfeit } as const;
  });
}
