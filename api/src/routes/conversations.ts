import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, isNull, or, type SQL } from "drizzle-orm";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireAuth } from "../auth/plugin.js";
import { db } from "../db/index.js";
import { conversations, messages, needs, users } from "../db/schema.js";
import { conflict, forbidden, invalid, notFound } from "../lib/errors.js";
import { FLIGHT, normalizeFlightNumber } from "../lib/legs.js";
import { sendMail, simpleMail } from "../lib/mailer.js";
import { acceptanceView, acceptHelper, liveAcceptances, resolveOutcome, rewardCredited } from "../lib/payments.js";
import { firstName, type Need } from "../lib/posts.js";
import { isBlocked, thanksCounts } from "../lib/social.js";
import { registerRateLimit } from "../plugins/rateLimit.js";
import { loadNeedFor } from "./needs.js";

// Reaching out and the private conversation that follows (api/ROUTES.md
// "Reaching out"). Phones and emails are never returned: people share contact
// details in the conversation when they choose to.

const HOUR = 60 * 60_000;
const body = z.string().trim().min(1).max(2000);
const poster = alias(users, "poster");
const helper = alias(users, "helper");

/** Every conversation the caller is in, as poster or helper, with both names. */
function conversationQuery(userId: string, extra?: SQL) {
  return db
    .select({ c: conversations, n: needs, posterName: poster.name, helperName: helper.name, posterDeleted: poster.deletedAt, helperDeleted: helper.deletedAt })
    .from(conversations)
    .innerJoin(needs, eq(needs.id, conversations.needId))
    .innerJoin(poster, eq(poster.id, needs.userId))
    .innerJoin(helper, eq(helper.id, conversations.helperId))
    .where(and(or(eq(needs.userId, userId), eq(conversations.helperId, userId)), extra));
}

type Row = Awaited<ReturnType<typeof conversationQuery>>[number];

async function views(rows: Row[], userId: string) {
  const [thanks, accepted] = await Promise.all([
    thanksCounts(rows.map((r) => (r.n.userId === userId ? r.c.helperId : r.n.userId))),
    liveAcceptances(rows.map((r) => r.n.id)),
  ]);
  const credited = await rewardCredited([...accepted.values()].map((a) => a.id));
  return Promise.all(
    rows.map(async (r) => {
      const [last] = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, r.c.id))
        .orderBy(desc(messages.createdAt))
        .limit(1);
      const isPoster = r.n.userId === userId;
      const otherId = isPoster ? r.c.helperId : r.n.userId;
      return {
        id: r.c.id,
        need: {
          id: r.n.id,
          travelerLabel: r.n.travelerLabel,
          origin: r.n.origin,
          destination: r.n.destination,
          travelDate: r.n.travelDate,
          flightNumbers: r.n.flightNumbers,
          status: r.n.status,
        },
        role: isPoster ? "poster" : "helper",
        otherParty: {
          id: otherId,
          firstName: firstName(isPoster ? r.helperName : r.posterName),
          thanksCount: thanks.get(otherId) ?? 0,
          deleted: (isPoster ? r.helperDeleted : r.posterDeleted) !== null,
        },
        lastMessage: last ? { body: last.body, at: last.createdAt, mine: last.senderId === userId } : null,
        helperFlightNumbers: r.c.helperFlightNumbers,
        thankedAt: r.c.thankedAt,
        thankNote: r.c.thankNote,
        blocked: await isBlocked(r.n.userId, r.c.helperId),
        // Paid help (null/false when it was never used).
        rewardDeclined: r.c.rewardDeclined,
        acceptance: (() => {
          const a = accepted.get(r.n.id);
          return a && a.conversationId === r.c.id ? acceptanceView(a, userId, r.c.rewardDeclined, credited.get(a.id) ?? 0) : null;
        })(),
        needHasHelper: accepted.has(r.n.id),
        createdAt: r.c.createdAt,
      };
    }),
  );
}

async function viewOne(r: Row, userId: string) {
  return (await views([r], userId))[0];
}

/** The other person in this conversation deleted their account (api/ROUTES.md "Account deletion"). */
function otherPartyDeleted(r: Row, userId: string): boolean {
  return (r.n.userId === userId ? r.helperDeleted : r.posterDeleted) !== null;
}

async function load(id: string, userId: string): Promise<Row> {
  const [r] = await conversationQuery(userId, eq(conversations.id, id));
  if (!r) throw notFound();
  return r;
}

async function post(conversationId: string, senderId: string, text: string) {
  return db.transaction(async (tx) => {
    const [m] = await tx.insert(messages).values({ conversationId, senderId, body: text }).returning();
    await tx.update(conversations).set({ lastMessageAt: m.createdAt }).where(eq(conversations.id, conversationId));
    return m;
  });
}

/**
 * Opens (or reuses) the one conversation for (need, helper) and posts the first
 * message. Used both when a helper reaches out to a need and when a need's
 * owner contacts a traveller's "I'm flying" post. The other party gets an
 * email when the conversation is new (fail-soft).
 */
export async function openConversation(o: {
  need: Need;
  helperId: string;
  helperFlightNumbers: string[];
  senderId: string;
  message: string;
  log: FastifyBaseLogger;
  /** Helper's "I'm helping for free" choice; undefined leaves it as is. */
  declineReward?: boolean;
}) {
  const [created] = await db
    .insert(conversations)
    .values({ needId: o.need.id, helperId: o.helperId, helperFlightNumbers: o.helperFlightNumbers, rewardDeclined: o.declineReward ?? false })
    .onConflictDoNothing({ target: [conversations.needId, conversations.helperId] })
    .returning({ id: conversations.id });
  const [conv] = created
    ? [created]
    : await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(and(eq(conversations.needId, o.need.id), eq(conversations.helperId, o.helperId)))
        .limit(1);
  await post(conv.id, o.senderId, o.message);
  if (!created && o.declineReward !== undefined) await setRewardChoice(conv.id, o.declineReward);

  if (created) {
    const recipientId = o.senderId === o.helperId ? o.need.userId : o.helperId;
    const [[recipient], [sender]] = await Promise.all([
      db.select({ email: users.email }).from(users).where(and(eq(users.id, recipientId), isNull(users.deletedAt))).limit(1),
      db.select({ name: users.name }).from(users).where(eq(users.id, o.senderId)).limit(1),
    ]);
    const n = o.need;
    if (!recipient) return { conversation: await viewOne(await load(conv.id, o.senderId), o.senderId), created: true };
    const who = firstName(sender.name);
    const mail =
      o.senderId === o.helperId
        ? simpleMail(
            recipient.email,
            `${who} can help with ${n.origin} → ${n.destination} on ${n.travelDate}`,
            `${who} saw your TransitVault post for ${n.travelerLabel} (${n.flightNumbers.join(", ")}) and sent you a message. Reply on TransitVault.`,
            `/messages/${conv.id}`,
          )
        : simpleMail(
            recipient.email,
            `${who} asked if you can help on ${n.origin} → ${n.destination} on ${n.travelDate}`,
            `You offered to help on TransitVault. ${who}'s ${n.travelerLabel.toLowerCase()} is flying ${n.origin} → ${n.destination} (${n.flightNumbers.join(", ")}) and they sent you a message. Reply on TransitVault.`,
            `/messages/${conv.id}`,
          );
    void sendMail([mail], (m) => o.log.info(m)).catch((err) => o.log.warn({ err }, "conversation mail failed"));
  }

  return { conversation: await viewOne(await load(conv.id, o.senderId), o.senderId), created: Boolean(created) };
}

/** The helper's "helping for free" choice: locked once the reward is released or the trip resolved. */
async function setRewardChoice(conversationId: string, declined: boolean) {
  const [c] = await db.select({ needId: conversations.needId }).from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  const a = (await liveAcceptances([c.needId])).get(c.needId);
  if (a && a.conversationId === conversationId && (a.outcome || a.rewardReleasedAt)) throw conflict("reward_released");
  await db.update(conversations).set({ rewardDeclined: declined }).where(eq(conversations.id, conversationId));
}

export async function conversationRoutes(fastify: FastifyInstance) {
  await registerRateLimit(fastify);
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  app.addHook("preHandler", requireAuth);
  const params = z.object({ id: z.string().uuid() });
  const perUser = (max: number) => ({ rateLimit: { max, timeWindow: HOUR, keyGenerator: (r: { userId?: string; ip: string }) => r.userId ?? r.ip } });

  app.post(
    "/needs/:id/reach-out",
    {
      config: perUser(30),
      schema: {
        params,
        body: z.object({ message: body, myFlightNumbers: z.array(z.string().trim().max(10)).max(4).optional(), declineReward: z.boolean().optional() }),
      },
    },
    async (req, reply) => {
      const userId = req.userId!;
      const { post: n } = await loadNeedFor(req.params.id, userId);
      if (n.userId === userId) throw conflict("own_need");
      if (n.status !== "open") throw conflict("need_not_open");
      const flights = (req.body.myFlightNumbers ?? []).filter(Boolean).map(normalizeFlightNumber);
      if (flights.some((f) => !FLIGHT.test(f))) throw invalid("invalid_flight_number");
      const { conversation, created } = await openConversation({
        need: n,
        helperId: userId,
        helperFlightNumbers: flights,
        senderId: userId,
        message: req.body.message,
        log: req.log,
        declineReward: req.body.declineReward,
      });
      return reply.code(created ? 201 : 200).send(conversation);
    },
  );

  app.get("/conversations", async (req) => {
    const rows = await conversationQuery(req.userId!).orderBy(desc(conversations.lastMessageAt));
    return views(rows, req.userId!);
  });

  app.get("/conversations/:id", { schema: { params } }, async (req) => viewOne(await load(req.params.id, req.userId!), req.userId!));

  app.get("/conversations/:id/messages", { schema: { params } }, async (req) => {
    await load(req.params.id, req.userId!);
    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, req.params.id))
      .orderBy(desc(messages.createdAt))
      .limit(500);
    return rows.reverse().map((m) => ({ id: m.id, body: m.body, createdAt: m.createdAt, mine: m.senderId === req.userId }));
  });

  app.post(
    "/conversations/:id/messages",
    { config: perUser(120), schema: { params, body: z.object({ body }) } },
    async (req, reply) => {
      const r = await load(req.params.id, req.userId!);
      if (otherPartyDeleted(r, req.userId!)) throw conflict("other_party_deleted");
      if (await isBlocked(r.n.userId, r.c.helperId)) throw forbidden("blocked");
      const m = await post(req.params.id, req.userId!, req.body.body);
      return reply.code(201).send({ id: m.id, body: m.body, createdAt: m.createdAt, mine: true });
    },
  );

  // The poster thanks the helper, once. Shown as "Thanked by N families".
  app.post(
    "/conversations/:id/thanks",
    { schema: { params, body: z.object({ note: z.string().trim().max(500).optional() }) } },
    async (req) => {
      const r = await load(req.params.id, req.userId!);
      if (r.n.userId !== req.userId) throw notFound();
      if (otherPartyDeleted(r, req.userId!)) throw conflict("other_party_deleted");
      const [done] = await db
        .update(conversations)
        .set({ thankedAt: new Date(), thankNote: req.body.note || null })
        .where(and(eq(conversations.id, r.c.id), isNull(conversations.thankedAt)))
        .returning({ id: conversations.id });
      if (!done) throw conflict("already_thanked");
      const [h] = await db.select({ email: users.email }).from(users).where(and(eq(users.id, r.c.helperId), isNull(users.deletedAt))).limit(1);
      if (!h) return viewOne(await load(r.c.id, req.userId!), req.userId!);
      const note = req.body.note ? ` They wrote: "${req.body.note}"` : "";
      void sendMail(
        [
          simpleMail(
            h.email,
            `${firstName(r.posterName)} thanked you on TransitVault`,
            `${firstName(r.posterName)} thanked you for helping ${r.n.travelerLabel.toLowerCase()} on ${r.n.origin} → ${r.n.destination}.${note}`,
            `/messages/${r.c.id}`,
          ),
        ],
        (m) => req.log.info(m),
      ).catch((err) => req.log.warn({ err }, "thanks mail failed"));
      return viewOne(await load(r.c.id, req.userId!), req.userId!);
    },
  );

  // ---- paid help (api/ROUTES.md "Paid help") ----

  // The poster accepts this conversation's helper: $10 by card (minus credit).
  app.post("/conversations/:id/accept", { config: perUser(20), schema: { params } }, async (req) => {
    const r = await load(req.params.id, req.userId!);
    if (r.n.userId !== req.userId) throw notFound();
    if (otherPartyDeleted(r, req.userId!)) throw conflict("other_party_deleted");
    const { checkoutUrl } = await acceptHelper({ conversationId: r.c.id, posterId: req.userId!, log: req.log });
    return { checkoutUrl, conversation: await viewOne(await load(r.c.id, req.userId!), req.userId!) };
  });

  // The helper's "I'm helping for free" switch.
  app.put("/conversations/:id/reward", { schema: { params, body: z.object({ declined: z.boolean() }) } }, async (req) => {
    const r = await load(req.params.id, req.userId!);
    if (r.c.helperId !== req.userId) throw notFound();
    await setRewardChoice(r.c.id, req.body.declined);
    return viewOne(await load(r.c.id, req.userId!), req.userId!);
  });

  // "Did they help?" answered in the app (the email links use POST /feedback).
  app.post("/conversations/:id/outcome", { schema: { params, body: z.object({ helped: z.boolean() }) } }, async (req) => {
    const r = await load(req.params.id, req.userId!);
    if (r.n.userId !== req.userId) throw notFound();
    const a = (await liveAcceptances([r.n.id])).get(r.n.id);
    if (!a || a.conversationId !== r.c.id || a.status !== "confirmed") throw conflict("not_accepted");
    if (a.outcome) throw conflict("already_answered");
    if (!a.feedbackDueAt || a.feedbackDueAt.getTime() > Date.now()) throw conflict("too_early");
    if (!(await resolveOutcome(a.id, req.body.helped ? "helped" : "no_show", "poster", req.log))) throw conflict("already_answered");
    return viewOne(await load(r.c.id, req.userId!), req.userId!);
  });
}
