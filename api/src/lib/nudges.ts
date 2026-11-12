import { and, between, eq, isNull, lt, notExists, sql } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";
import { db } from "../db/index.js";
import { conversations, needs, users } from "../db/schema.js";
import { noHelperEmailDue, travelerPhrase } from "./landing.js";
import { sendMail, simpleMail } from "./mailer.js";

// The two poster nudges (api/ROUTES.md "Nudges"). Hourly, in the API process:
// plain idempotent DB sweeps, like BorrowVault's worker sweeps. A conditional
// update claims each need before mailing, so each email goes out once even if
// two sweeps overlap, and a need gets at most one of the two.

const SWEEP_MS = 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

const noConversations = notExists(db.select({ one: sql`1` }).from(conversations).where(eq(conversations.needId, needs.id)));

/** "Did you find a companion?" the day after travel, unless the "sorry" email already went out. */
export async function nudgeStaleNeeds(log: FastifyBaseLogger): Promise<number> {
  const claimed = await db
    .update(needs)
    .set({ nudgedAt: new Date() })
    .where(
      and(eq(needs.status, "open"), isNull(needs.nudgedAt), isNull(needs.noHelperEmailedAt), lt(needs.travelDate, sql`current_date`)),
    )
    .returning();
  if (!claimed.length) return 0;
  const mails = [];
  for (const n of claimed) {
    const [u] = await db.select({ email: users.email }).from(users).where(and(eq(users.id, n.userId), isNull(users.deletedAt))).limit(1);
    if (!u) continue;
    mails.push(
      simpleMail(
        u.email,
        `Did ${n.travelerLabel.toLowerCase()} find a companion? (${n.origin} → ${n.destination})`,
        `Your TransitVault post for ${n.travelerLabel} (${n.flightNumbers.join(", ")}, ${n.travelDate}) is still open. If someone helped, mark it as found and say thank you; otherwise close it so it leaves the board.`,
        `/needs/${n.id}`,
      ),
    );
  }
  await sendMail(mails, (m) => log.info(m));
  return claimed.length;
}

const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * "Sorry, no one offered to help": ~6 h before the first departure, for an
 * open, visible need nobody reached out about. The exact timing is the pure
 * `noHelperEmailDue` (lib/landing.ts); the query only narrows to travel dates
 * around today. Status is left as it is.
 */
export async function emailNoHelperNeeds(log: FastifyBaseLogger, now = new Date()): Promise<number> {
  const open = and(eq(needs.status, "open"), isNull(needs.hiddenAt), isNull(needs.noHelperEmailedAt), isNull(needs.nudgedAt), noConversations);
  const candidates = await db
    .select({ id: needs.id, legs: needs.legs, createdAt: needs.createdAt })
    .from(needs)
    .where(and(open, between(needs.travelDate, isoDate(now.getTime() - 2 * DAY_MS), isoDate(now.getTime() + 2 * DAY_MS))))
    .limit(500);
  const mails = [];
  for (const c of candidates) {
    if (!noHelperEmailDue(c.legs, c.createdAt, now)) continue;
    // Claim it; re-checks "nobody reached out" in case someone just did.
    const [n] = await db
      .update(needs)
      .set({ noHelperEmailedAt: new Date() })
      .where(and(eq(needs.id, c.id), open))
      .returning();
    if (!n) continue;
    const [u] = await db.select({ email: users.email }).from(users).where(and(eq(users.id, n.userId), isNull(users.deletedAt))).limit(1);
    if (!u) continue;
    mails.push(noHelperMail(u.email, n));
  }
  await sendMail(mails, (m) => log.info(m));
  return mails.length;
}

export function noHelperMail(to: string, n: Pick<typeof needs.$inferSelect, "travelerLabel" | "origin" | "destination" | "flightNumbers" | "travelDate">) {
  const who = travelerPhrase(n.travelerLabel);
  return simpleMail(
    to,
    `Sorry, no one offered to help on ${n.origin} → ${n.destination}`,
    `We're sorry: no one on ${who}'s flights (${n.flightNumbers.join(", ")}, ${n.origin} → ${n.destination}, ${n.travelDate}) offered to help this time. ` +
      `Two things that make flying alone easier: ask the airline for wheelchair or meet-and-assist service (it's free on most airlines; book it with the airline at least 48 hours ahead), ` +
      `and keep a copy of the itinerary and a phone number to call written down in ${who}'s bag. ` +
      `Safe travels. When there's a next trip, post it again on TransitVault and share the link early.`,
    `/needs/new`,
  );
}

export async function sweepNudges(log: FastifyBaseLogger): Promise<{ noHelper: number; nudged: number }> {
  // "Sorry" first, so a need never gets both in one sweep.
  const noHelper = await emailNoHelperNeeds(log);
  const nudged = await nudgeStaleNeeds(log);
  return { noHelper, nudged };
}

export function startNudges(log: FastifyBaseLogger): void {
  const tick = () => {
    void sweepNudges(log)
      .then((c) => {
        if (c.noHelper || c.nudged) log.info(c, "nudge sweep");
      })
      .catch((err) => log.warn({ err }, "nudge sweep failed"));
  };
  setTimeout(tick, 60_000).unref();
  setInterval(tick, SWEEP_MS).unref();
}
