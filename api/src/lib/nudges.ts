import { and, eq, isNull, lt, sql } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";
import { db } from "../db/index.js";
import { needs, users } from "../db/schema.js";
import { sendMail, simpleMail } from "./mailer.js";

// "Did you find a companion?" (api/ROUTES.md "Nudges"). Hourly, in the API
// process: a plain idempotent DB sweep, like BorrowVault's worker sweeps. The
// conditional update claims each need before mailing, so it goes out once
// even if two sweeps overlap.

const SWEEP_MS = 60 * 60_000;

export async function nudgeStaleNeeds(log: FastifyBaseLogger): Promise<number> {
  const claimed = await db
    .update(needs)
    .set({ nudgedAt: new Date() })
    .where(and(eq(needs.status, "open"), isNull(needs.nudgedAt), lt(needs.travelDate, sql`current_date`)))
    .returning();
  if (!claimed.length) return 0;
  const mails = [];
  for (const n of claimed) {
    const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, n.userId)).limit(1);
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

export function startNudges(log: FastifyBaseLogger): void {
  const tick = () => {
    void nudgeStaleNeeds(log)
      .then((n) => {
        if (n) log.info(`nudged ${n} stale need(s)`);
      })
      .catch((err) => log.warn({ err }, "nudge sweep failed"));
  };
  setTimeout(tick, 60_000).unref();
  setInterval(tick, SWEEP_MS).unref();
}
