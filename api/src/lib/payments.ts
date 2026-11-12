import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, desc, eq, inArray, isNull, lt, lte, ne, sql } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";
import { db, type DbOrTx } from "../db/index.js";
import { conversations, creditEntries, helperAcceptances, needs, users } from "../db/schema.js";
import { env } from "../env.js";
import { conflict, forbidden, notFound, unavailable } from "./errors.js";
import { CURRENCY, dollars, FEE_CENTS, REWARD_CENTS, splitFee } from "./fees.js";
import { FEEDBACK_WINDOW_MS, landingSchedule } from "./landing.js";
import { choiceMail, sendMail, simpleMail, type Mail } from "./mailer.js";
import { firstName } from "./posts.js";
import { isBlocked } from "./social.js";
import { createCheckoutSession, createRefund, type StripeConfig, type StripeEvent } from "./stripe.js";

// Paid help (api/ROUTES.md "Paid help").
//
//   accept (poster) ──► pending_payment ──(Stripe webhook, or credit covers it)──► confirmed
//         │                    └──(session expired / abandoned)──► cancelled, credit restored
//   last leg lands + 4 h ──► email poster "Did <helper> help?" (Yes / No)
//         Yes, or no answer in 48 h ──► helper gets $5 credit (unless they declined it)
//         No ──► the whole $10 comes back as TransitVault credit (not a card refund:
//                Stripe keeps its fee on refunds), no helper credit, +1 strike on the helper.
//                A card refund of the cash part is an ops-only action (refundToCard).
//
// Everything is idempotent conditional updates, so the hourly sweep, webhook
// retries and double clicks can overlap safely. Every email is fail-soft.

export type Acceptance = typeof helperAcceptances.$inferSelect;

const MINUTE = 60_000;
/** Stripe's minimum Checkout expiry. A pending acceptance can't be paid after this. */
const CHECKOUT_TTL_MS = 30 * MINUTE;
/** Pending acceptances older than this are cancelled (missed `expired` webhook). */
const PENDING_STALE_MS = 2 * 60 * MINUTE;
const SWEEP_MS = 60 * MINUTE;

const stripeCfg = (): StripeConfig | null =>
  env.STRIPE_SECRET_KEY ? { secretKey: env.STRIPE_SECRET_KEY, apiBase: env.STRIPE_API_BASE } : null;

export function paymentsConfig() {
  return { enabled: env.PAYMENTS_ENABLED, feeCents: FEE_CENTS, rewardCents: REWARD_CENTS, currency: CURRENCY };
}

export function logPaymentsMode(log: FastifyBaseLogger) {
  if (env.PAYMENTS_ENABLED) log.info("paid help: ON");
  else if (env.PAYMENTS_FLAG_SET) log.warn("paid help: PAYMENTS_ENABLED is set but STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET are missing, so it stays OFF");
}

// ---- credit ----------------------------------------------------------------

export async function creditBalance(userId: string, q: DbOrTx = db): Promise<number> {
  const [r] = await q
    .select({ n: sql<number>`coalesce(sum(${creditEntries.amountCents}), 0)::int` })
    .from(creditEntries)
    .where(eq(creditEntries.userId, userId));
  return r?.n ?? 0;
}

export async function creditSummary(userId: string) {
  const entries = await db
    .select()
    .from(creditEntries)
    .where(eq(creditEntries.userId, userId))
    .orderBy(desc(creditEntries.createdAt))
    .limit(50);
  return {
    balanceCents: await creditBalance(userId),
    entries: entries.map((e) => ({ id: e.id, amountCents: e.amountCents, reason: e.reason, needId: e.needId, createdAt: e.createdAt })),
  };
}

// ---- views -----------------------------------------------------------------

export function acceptanceView(a: Acceptance, viewerId: string, rewardDeclined: boolean, rewardCreditedCents: number) {
  const isPoster = a.posterId === viewerId;
  return {
    id: a.id,
    status: a.status,
    feeCents: a.feeCents,
    // The poster's payment is theirs to see; the helper sees the reward side.
    creditAppliedCents: isPoster ? a.creditAppliedCents : null,
    cashCents: isPoster ? a.cashCents : null,
    checkoutUrl: isPoster && a.status === "pending_payment" ? a.checkoutUrl : null,
    confirmedAt: a.confirmedAt,
    landsAt: a.landsAt,
    feedbackDueAt: a.feedbackDueAt,
    canAnswer: isPoster && a.status === "confirmed" && !a.outcome && a.feedbackDueAt !== null && a.feedbackDueAt.getTime() <= Date.now(),
    outcome: a.outcome,
    outcomeAt: a.outcomeAt,
    rewardDeclined,
    rewardReleasedAt: a.rewardReleasedAt,
    rewardCreditedCents,
    refundedAt: isPoster ? a.refundedAt : null,
  };
}

export type AcceptanceView = ReturnType<typeof acceptanceView>;

/** Live (pending/confirmed) acceptances for these needs, keyed by need id. */
export async function liveAcceptances(needIds: string[]): Promise<Map<string, Acceptance>> {
  if (!needIds.length) return new Map();
  const rows = await db
    .select()
    .from(helperAcceptances)
    .where(and(inArray(helperAcceptances.needId, [...new Set(needIds)]), ne(helperAcceptances.status, "cancelled")));
  return new Map(rows.map((a) => [a.needId, a]));
}

export async function rewardCredited(acceptanceIds: string[]): Promise<Map<string, number>> {
  if (!acceptanceIds.length) return new Map();
  const rows = await db
    .select({ id: creditEntries.acceptanceId, n: creditEntries.amountCents })
    .from(creditEntries)
    .where(and(inArray(creditEntries.acceptanceId, acceptanceIds), eq(creditEntries.reason, "helper_reward")));
  return new Map(rows.map((r) => [r.id!, r.n]));
}

// ---- accept ----------------------------------------------------------------

async function insertCredit(q: DbOrTx, v: typeof creditEntries.$inferInsert) {
  if (!v.amountCents) return;
  await q.insert(creditEntries).values(v).onConflictDoNothing();
}

/** pending_payment → cancelled, giving back any credit it spent. Idempotent. */
async function cancelPending(q: DbOrTx, a: Acceptance): Promise<boolean> {
  const [done] = await q
    .update(helperAcceptances)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(helperAcceptances.id, a.id), eq(helperAcceptances.status, "pending_payment")))
    .returning({ id: helperAcceptances.id });
  if (!done) return false;
  await insertCredit(q, { userId: a.posterId, amountCents: a.creditAppliedCents, reason: "fee_restored", needId: a.needId, acceptanceId: a.id });
  return true;
}

/**
 * The poster accepts the helper of this conversation. Returns the Stripe
 * Checkout URL to send them to, or null when their credit covered the fee
 * and the helper is already confirmed.
 */
export async function acceptHelper(o: { conversationId: string; posterId: string; log: FastifyBaseLogger }): Promise<{ checkoutUrl: string | null }> {
  if (!env.PAYMENTS_ENABLED) throw conflict("payments_disabled");
  const [row] = await db
    .select({ c: conversations, n: needs, email: users.email })
    .from(conversations)
    .innerJoin(needs, eq(needs.id, conversations.needId))
    .innerJoin(users, eq(users.id, needs.userId))
    .where(eq(conversations.id, o.conversationId))
    .limit(1);
  if (!row || row.n.userId !== o.posterId) throw notFound();
  if (row.n.status === "closed") throw conflict("need_not_open");
  if (await isBlocked(row.n.userId, row.c.helperId)) throw forbidden("blocked");

  const now = Date.now();
  const result = await db.transaction(async (tx) => {
    // Serialises this poster's credit spending and their accepts.
    await tx.execute(sql`select id from users where id = ${o.posterId} for update`);
    // Account deletion locks the user row for update; this share lock makes it
    // wait for (or be seen by) a deletion of the helper (api/ROUTES.md "Account deletion").
    const h = await tx.execute(sql`select deleted_at from users where id = ${row.c.helperId} for share`);
    if ((h.rows[0] as { deleted_at: Date | null } | undefined)?.deleted_at) throw conflict("other_party_deleted");
    const [existing] = await tx
      .select()
      .from(helperAcceptances)
      .where(and(eq(helperAcceptances.needId, row.n.id), ne(helperAcceptances.status, "cancelled")))
      .limit(1);
    if (existing) {
      if (existing.status === "confirmed") throw conflict("helper_already_confirmed");
      const age = now - existing.createdAt.getTime();
      if (age < CHECKOUT_TTL_MS + MINUTE) {
        // Still payable: same helper → resume the same checkout; another → wait.
        if (existing.conversationId === row.c.id && existing.checkoutUrl) return { acceptance: existing, resumed: true };
        throw conflict("acceptance_pending");
      }
      await cancelPending(tx, existing);
    }
    const { creditAppliedCents, cashCents } = splitFee(await creditBalance(o.posterId, tx));
    const [a] = await tx
      .insert(helperAcceptances)
      .values({
        needId: row.n.id,
        conversationId: row.c.id,
        posterId: o.posterId,
        helperId: row.c.helperId,
        feeCents: FEE_CENTS,
        creditAppliedCents,
        cashCents,
      })
      .returning();
    await insertCredit(tx, { userId: o.posterId, amountCents: -creditAppliedCents, reason: "fee_applied", needId: row.n.id, acceptanceId: a.id });
    return { acceptance: a, resumed: false };
  });

  const a = result.acceptance;
  if (result.resumed) return { checkoutUrl: a.checkoutUrl };
  if (a.cashCents === 0) {
    await confirmAcceptance(a.id, null, o.log);
    return { checkoutUrl: null };
  }

  const cfg = stripeCfg();
  try {
    if (!cfg) throw new Error("stripe not configured");
    const back = `${env.WEB_ORIGIN}/messages/${row.c.id}`;
    const session = await createCheckoutSession(cfg, {
      acceptanceId: a.id,
      amountCents: a.cashCents,
      currency: CURRENCY,
      productName: `TransitVault helper fee: ${row.n.origin} → ${row.n.destination}, ${row.n.travelDate}`,
      customerEmail: row.email,
      successUrl: `${back}?paid=1`,
      cancelUrl: `${back}?paid=0`,
      expiresAt: new Date(now + CHECKOUT_TTL_MS),
    });
    if (!session.url) throw new Error("checkout session has no url");
    await db
      .update(helperAcceptances)
      .set({ stripeSessionId: session.id, checkoutUrl: session.url, updatedAt: new Date() })
      .where(eq(helperAcceptances.id, a.id));
    return { checkoutUrl: session.url };
  } catch (err) {
    o.log.error({ err }, "stripe checkout failed");
    await db.transaction((tx) => cancelPending(tx, a));
    throw unavailable("payment_unavailable");
  }
}

// ---- confirm (paid or fully covered by credit) ----------------------------

async function people(a: Acceptance) {
  const [[poster], [helper], [n]] = await Promise.all([
    db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, a.posterId)).limit(1),
    db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, a.helperId)).limit(1),
    db.select().from(needs).where(eq(needs.id, a.needId)).limit(1),
  ]);
  return { poster, helper, n };
}

function mailSoft(mails: Mail[], log: FastifyBaseLogger) {
  void sendMail(mails, (m) => log.info(m)).catch((err) => log.warn({ err }, "paid-help mail failed"));
}

/** pending_payment → confirmed; the need becomes `found`. Idempotent: false if it wasn't pending. */
export async function confirmAcceptance(id: string, paymentIntentId: string | null, log: FastifyBaseLogger): Promise<boolean> {
  const [a0] = await db.select().from(helperAcceptances).where(eq(helperAcceptances.id, id)).limit(1);
  if (!a0) return false;
  const [n] = await db.select().from(needs).where(eq(needs.id, a0.needId)).limit(1);
  const { landsAt, feedbackDueAt } = landingSchedule(n.legs);
  const now = new Date();
  const confirmed = await db.transaction(async (tx) => {
    const [a] = await tx
      .update(helperAcceptances)
      .set({
        status: "confirmed",
        confirmedAt: now,
        paidAt: a0.cashCents > 0 ? now : null,
        stripePaymentIntentId: paymentIntentId,
        landsAt,
        feedbackDueAt,
        updatedAt: now,
      })
      .where(and(eq(helperAcceptances.id, id), eq(helperAcceptances.status, "pending_payment")))
      .returning();
    if (!a) return null;
    await tx.update(needs).set({ status: "found", updatedAt: now }).where(eq(needs.id, a.needId));
    return a;
  });
  if (!confirmed) return false;

  const { poster, helper } = await people(confirmed);
  const [conv] = await db.select({ declined: conversations.rewardDeclined }).from(conversations).where(eq(conversations.id, confirmed.conversationId)).limit(1);
  const trip = `${n.travelerLabel.toLowerCase()} on ${n.origin} → ${n.destination} (${n.flightNumbers.join(", ")}, ${n.travelDate})`;
  const paid =
    confirmed.cashCents > 0
      ? `You paid ${dollars(confirmed.cashCents)} by card${confirmed.creditAppliedCents ? ` and ${dollars(confirmed.creditAppliedCents)} from your TransitVault credit` : ""}.`
      : `Your TransitVault credit covered the ${dollars(confirmed.feeCents)} fee.`;
  mailSoft(
    [
      simpleMail(
        poster.email,
        `${firstName(helper.name)} is confirmed as the helper for ${n.origin} → ${n.destination}`,
        `${firstName(helper.name)} is confirmed as the helper for ${trip}. ${paid} After the flight lands we'll ask you whether they helped; if they didn't show, the fee comes back as TransitVault credit.`,
        `/messages/${confirmed.conversationId}`,
      ),
      simpleMail(
        helper.email,
        `${firstName(poster.name)} accepted your help on ${n.origin} → ${n.destination}`,
        `${firstName(poster.name)} accepted you as the helper for ${trip}. ${
          conv?.declined
            ? "You chose to help for free, so no credit will be issued."
            : `Once the trip is done you'll get ${dollars(REWARD_CENTS)} TransitVault credit as a thank-you.`
        } You're a fellow traveller lending a hand, not a hired escort.`,
        `/messages/${confirmed.conversationId}`,
      ),
    ],
    log,
  );
  return true;
}

// ---- Stripe webhook --------------------------------------------------------

async function acceptanceForSession(obj: StripeEvent["data"]["object"]): Promise<Acceptance | undefined> {
  const id = obj.metadata?.acceptance_id ?? obj.client_reference_id ?? null;
  if (id && /^[0-9a-f-]{36}$/i.test(id)) {
    const [a] = await db.select().from(helperAcceptances).where(eq(helperAcceptances.id, id)).limit(1);
    if (a) return a;
  }
  const [a] = await db.select().from(helperAcceptances).where(eq(helperAcceptances.stripeSessionId, obj.id)).limit(1);
  return a;
}

/** Handles one verified event. Unknown events and replays are no-ops. */
export async function handleStripeEvent(event: StripeEvent, log: FastifyBaseLogger): Promise<string> {
  const obj = event.data?.object;
  if (!obj) return "ignored";
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    if (obj.payment_status !== "paid" && obj.payment_status !== "no_payment_required") return "not_paid";
    const a = await acceptanceForSession(obj);
    if (!a) {
      log.warn({ session: obj.id }, "stripe: paid session for an unknown acceptance");
      return "unknown";
    }
    const pi = obj.payment_intent ?? null;
    if (a.status === "pending_payment") return (await confirmAcceptance(a.id, pi, log)) ? "confirmed" : "noop";
    if (a.status === "cancelled" && pi && !a.refundedAt) {
      // Paid after we gave up on it (shouldn't happen: sessions expire first). Give the money back.
      log.warn({ acceptance: a.id }, "stripe: payment for a cancelled acceptance, refunding");
      await db.update(helperAcceptances).set({ stripePaymentIntentId: pi }).where(eq(helperAcceptances.id, a.id));
      await refund({ ...a, stripePaymentIntentId: pi }, log);
      return "refunded";
    }
    return "noop";
  }
  if (event.type === "checkout.session.expired") {
    const a = await acceptanceForSession(obj);
    if (a?.status === "pending_payment") return (await db.transaction((tx) => cancelPending(tx, a))) ? "cancelled" : "noop";
    return "noop";
  }
  return "ignored";
}

// ---- refunds ---------------------------------------------------------------

async function refund(a: Acceptance, log: FastifyBaseLogger): Promise<boolean> {
  const cfg = stripeCfg();
  const fail = async (msg: string) => {
    log.error({ acceptance: a.id, msg }, "refund failed");
    await db.update(helperAcceptances).set({ refundError: msg.slice(0, 500), updatedAt: new Date() }).where(eq(helperAcceptances.id, a.id));
    return false;
  };
  if (!a.stripePaymentIntentId) return fail("no payment intent recorded");
  if (!cfg) return fail("STRIPE_SECRET_KEY not set");
  try {
    const r = await createRefund(cfg, { paymentIntentId: a.stripePaymentIntentId, acceptanceId: a.id });
    await db
      .update(helperAcceptances)
      .set({ refundedAt: new Date(), stripeRefundId: r.id, refundError: null, updatedAt: new Date() })
      .where(eq(helperAcceptances.id, a.id));
    return true;
  } catch (err) {
    return fail(String(err));
  }
}

/**
 * Ops only (POST /ops/acceptances/:id/card-refund): a poster who reported a
 * no-show asked for their card money back instead of credit. Takes the cash
 * part back out of their credit (a `card_refund` entry, once per acceptance,
 * so it can't be refunded twice) and refunds it to the card via Stripe.
 */
export async function refundToCard(id: string, log: FastifyBaseLogger) {
  const [a] = await db.select().from(helperAcceptances).where(eq(helperAcceptances.id, id)).limit(1);
  if (!a) throw notFound();
  if (a.outcome !== "no_show") throw conflict("not_a_no_show");
  if (a.cashCents <= 0 || !a.stripePaymentIntentId) throw conflict("nothing_paid_by_card");
  if (a.refundedAt) throw conflict("already_refunded");
  if (!stripeCfg()) throw unavailable("payments_not_configured");
  const reversed = await db.transaction(async (tx) => {
    await tx.execute(sql`select id from users where id = ${a.posterId} for update`);
    if ((await creditBalance(a.posterId, tx)) < a.cashCents) throw conflict("credit_already_spent");
    const [e] = await tx
      .insert(creditEntries)
      .values({ userId: a.posterId, amountCents: -a.cashCents, reason: "card_refund", needId: a.needId, acceptanceId: a.id })
      .onConflictDoNothing()
      .returning({ id: creditEntries.id });
    return e;
  });
  if (!reversed) throw conflict("already_refunded");
  if (!(await refund(a, log))) {
    // Give the credit back so the poster isn't left with neither.
    await db.delete(creditEntries).where(eq(creditEntries.id, reversed.id));
    throw unavailable("refund_failed");
  }
  const [done] = await db.select().from(helperAcceptances).where(eq(helperAcceptances.id, id)).limit(1);
  return { id: done.id, refundedCents: done.cashCents, stripeRefundId: done.stripeRefundId, refundedAt: done.refundedAt };
}

// ---- outcome ("did they help?") --------------------------------------------

export type Outcome = "helped" | "no_show";

/** Records the poster's answer (or the 48 h default). Once only: null if already answered. */
export async function resolveOutcome(id: string, outcome: Outcome, source: "poster" | "timeout", log: FastifyBaseLogger): Promise<Acceptance | null> {
  const now = new Date();
  const res = await db.transaction(async (tx) => {
    const [a] = await tx
      .update(helperAcceptances)
      .set({ outcome, outcomeSource: source, outcomeAt: now, rewardReleasedAt: outcome === "helped" ? now : null, updatedAt: now })
      .where(and(eq(helperAcceptances.id, id), eq(helperAcceptances.status, "confirmed"), isNull(helperAcceptances.outcome)))
      .returning();
    if (!a) return null;
    let credited = 0;
    if (outcome === "helped") {
      const [c] = await tx.select({ declined: conversations.rewardDeclined }).from(conversations).where(eq(conversations.id, a.conversationId)).limit(1);
      if (!c?.declined) {
        await insertCredit(tx, { userId: a.helperId, amountCents: REWARD_CENTS, reason: "helper_reward", needId: a.needId, acceptanceId: a.id });
        credited = REWARD_CENTS;
      }
    } else {
      await insertCredit(tx, { userId: a.posterId, amountCents: a.feeCents, reason: "no_show_refund", needId: a.needId, acceptanceId: a.id });
      await tx.update(users).set({ strikeCount: sql`${users.strikeCount} + 1` }).where(eq(users.id, a.helperId));
    }
    return { a, credited };
  });
  if (!res) return null;
  const { a, credited } = res;

  const { poster, helper, n } = await people(a);
  const trip = `${n.origin} → ${n.destination} on ${n.travelDate}`;
  if (outcome === "helped") {
    mailSoft(
      [
        simpleMail(
          helper.email,
          credited ? `You earned ${dollars(credited)} TransitVault credit` : `Thank you for helping on ${trip}`,
          credited
            ? `${firstName(poster.name)}'s family confirmed you helped on ${trip}. ${dollars(credited)} TransitVault credit is now in your account. It comes off your own ${dollars(FEE_CENTS)} fee the next time you accept a helper.`
            : `${firstName(poster.name)}'s family confirmed you helped on ${trip}. You chose to help for free. Thank you!`,
          `/profile`,
        ),
      ],
      log,
    );
  } else {
    mailSoft(
      [
        simpleMail(
          poster.email,
          `Sorry ${firstName(helper.name)} didn't show on ${trip}`,
          `Thanks for telling us. The ${dollars(a.feeCents)} fee is refunded as TransitVault credit, ready for your next trip.${a.cashCents ? ` Prefer a card refund of the ${dollars(a.cashCents)} you paid? Contact support@3pandalabs.com.` : ""} If something felt unsafe, report them from the conversation.`,
          `/messages/${a.conversationId}`,
        ),
      ],
      log,
    );
  }
  return a;
}

// ---- feedback links (signed, single-use) -----------------------------------

const hashSecret = (s: string) => createHash("sha256").update(s).digest("hex");

/** `<acceptanceId>.<secret>` → the acceptance it unlocks, if still unanswered. */
export async function acceptanceForToken(token: string): Promise<Acceptance> {
  const i = token.indexOf(".");
  const id = i > 0 ? token.slice(0, i) : "";
  const secret = i > 0 ? token.slice(i + 1) : "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !secret) throw notFound("invalid_or_expired_token");
  const [a] = await db.select().from(helperAcceptances).where(eq(helperAcceptances.id, id)).limit(1);
  const want = Buffer.from(a?.feedbackTokenHash ?? "");
  const got = Buffer.from(hashSecret(secret));
  if (!a || a.status !== "confirmed" || want.length !== got.length || !timingSafeEqual(want, got)) throw notFound("invalid_or_expired_token");
  return a;
}

export async function feedbackView(a: Acceptance) {
  const { helper, n } = await people(a);
  return {
    helperFirstName: firstName(helper.name),
    travelerLabel: n.travelerLabel,
    origin: n.origin,
    destination: n.destination,
    travelDate: n.travelDate,
    outcome: a.outcome,
    conversationId: a.conversationId,
  };
}

async function sendFeedbackAsk(a: Acceptance, log: FastifyBaseLogger): Promise<boolean> {
  const secret = randomBytes(24).toString("hex");
  const [claimed] = await db
    .update(helperAcceptances)
    .set({ feedbackSentAt: new Date(), feedbackTokenHash: hashSecret(secret), updatedAt: new Date() })
    .where(and(eq(helperAcceptances.id, a.id), isNull(helperAcceptances.feedbackSentAt), isNull(helperAcceptances.outcome)))
    .returning({ id: helperAcceptances.id });
  if (!claimed) return false;
  const { poster, helper, n } = await people(a);
  const token = `${a.id}.${secret}`;
  const url = (answer: string) => `${env.WEB_ORIGIN}/feedback?token=${encodeURIComponent(token)}&answer=${answer}`;
  const who = firstName(helper.name);
  await sendMail(
    [
      choiceMail(
        poster.email,
        `Did ${who} help ${n.travelerLabel.toLowerCase()}? (${n.origin} → ${n.destination})`,
        `${n.travelerLabel}'s flight ${n.flightNumbers.join(", ")} should have landed. Did ${who} help as agreed? If they didn't show, the fee comes back as TransitVault credit. If we don't hear from you within 48 hours, we'll assume all went well.`,
        [
          { label: `Yes, ${who} helped`, url: url("yes") },
          { label: `No, ${who} didn't show`, url: url("no") },
        ],
        "Each link works once. You can also answer from the conversation on TransitVault.",
      ),
    ],
    (m) => log.info(m),
  );
  return true;
}

// ---- hourly sweep ------------------------------------------------------------

export async function sweepPaidHelp(log: FastifyBaseLogger) {
  const now = Date.now();
  const counts = { cancelled: 0, asked: 0, timedOut: 0 };

  const stale = await db
    .select()
    .from(helperAcceptances)
    .where(and(eq(helperAcceptances.status, "pending_payment"), lt(helperAcceptances.createdAt, new Date(now - PENDING_STALE_MS))));
  for (const a of stale) if (await db.transaction((tx) => cancelPending(tx, a))) counts.cancelled++;

  const due = await db
    .select()
    .from(helperAcceptances)
    .where(
      and(
        eq(helperAcceptances.status, "confirmed"),
        isNull(helperAcceptances.outcome),
        isNull(helperAcceptances.feedbackSentAt),
        lte(helperAcceptances.feedbackDueAt, new Date(now)),
      ),
    )
    .limit(200);
  for (const a of due) if (await sendFeedbackAsk(a, log)) counts.asked++;

  const silent = await db
    .select({ id: helperAcceptances.id })
    .from(helperAcceptances)
    .where(
      and(
        eq(helperAcceptances.status, "confirmed"),
        isNull(helperAcceptances.outcome),
        lte(helperAcceptances.feedbackSentAt, new Date(now - FEEDBACK_WINDOW_MS)),
      ),
    )
    .limit(200);
  for (const a of silent) if (await resolveOutcome(a.id, "helped", "timeout", log)) counts.timedOut++;

  return counts;
}

export function startPaidHelpSweep(log: FastifyBaseLogger): void {
  const tick = () => {
    void sweepPaidHelp(log)
      .then((c) => {
        if (c.cancelled || c.asked || c.timedOut) log.info(c, "paid-help sweep");
      })
      .catch((err) => log.warn({ err }, "paid-help sweep failed"));
  };
  setTimeout(tick, 90_000).unref();
  setInterval(tick, SWEEP_MS).unref();
}
