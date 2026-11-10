import { and, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { conversations, userBlocks } from "../db/schema.js";

// Blocks and thank-you counts, shared by every route that shows people.

/** Everyone the user has blocked or been blocked by. */
export async function blockedWith(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ a: userBlocks.blockerId, b: userBlocks.blockedId })
    .from(userBlocks)
    .where(or(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, userId)));
  return new Set(rows.map((r) => (r.a === userId ? r.b : r.a)));
}

export async function isBlocked(a: string, b: string): Promise<boolean> {
  const [row] = await db
    .select({ x: userBlocks.blockerId })
    .from(userBlocks)
    .where(
      or(
        and(eq(userBlocks.blockerId, a), eq(userBlocks.blockedId, b)),
        and(eq(userBlocks.blockerId, b), eq(userBlocks.blockedId, a)),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** How many families have thanked each helper. */
export async function thanksCounts(userIds: string[]): Promise<Map<string, number>> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return new Map();
  const rows = await db
    .select({ helperId: conversations.helperId, n: sql<number>`count(*)::int` })
    .from(conversations)
    .where(and(inArray(conversations.helperId, ids), isNotNull(conversations.thankedAt)))
    .groupBy(conversations.helperId);
  return new Map(rows.map((r) => [r.helperId, r.n]));
}
