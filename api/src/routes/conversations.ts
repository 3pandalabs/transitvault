import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, or, type SQL } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireAuth } from "../auth/plugin.js";
import { db } from "../db/index.js";
import { conversations, messages, needs, users } from "../db/schema.js";
import { conflict, invalid, notFound } from "../lib/errors.js";
import { normalizeFlightNumber, FLIGHT } from "../lib/legs.js";
import { sendMail, simpleMail } from "../lib/mailer.js";
import { registerRateLimit } from "../plugins/rateLimit.js";
import { firstName } from "./me.js";

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
    .select({ c: conversations, n: needs, posterName: poster.name, helperName: helper.name })
    .from(conversations)
    .innerJoin(needs, eq(needs.id, conversations.needId))
    .innerJoin(poster, eq(poster.id, needs.userId))
    .innerJoin(helper, eq(helper.id, conversations.helperId))
    .where(and(or(eq(needs.userId, userId), eq(conversations.helperId, userId)), extra));
}

type Row = Awaited<ReturnType<typeof conversationQuery>>[number];

async function view(r: Row, userId: string) {
  const [last] = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, r.c.id))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  const isPoster = r.n.userId === userId;
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
    otherParty: { firstName: firstName(isPoster ? r.helperName : r.posterName) },
    lastMessage: last ? { body: last.body, at: last.createdAt, mine: last.senderId === userId } : null,
    helperFlightNumbers: r.c.helperFlightNumbers,
    createdAt: r.c.createdAt,
  };
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
      schema: { params, body: z.object({ message: body, myFlightNumbers: z.array(z.string().trim().max(10)).max(4).optional() }) },
    },
    async (req, reply) => {
      const userId = req.userId!;
      const [n] = await db.select().from(needs).where(eq(needs.id, req.params.id)).limit(1);
      if (!n) throw notFound();
      if (n.userId === userId) throw conflict("own_need");
      if (n.status !== "open") throw conflict("need_not_open");
      const flights = (req.body.myFlightNumbers ?? []).filter(Boolean).map(normalizeFlightNumber);
      if (flights.some((f) => !FLIGHT.test(f))) throw invalid("invalid_flight_number");

      // One conversation per (need, helper): reaching out again just adds a message.
      const [created] = await db
        .insert(conversations)
        .values({ needId: n.id, helperId: userId, helperFlightNumbers: flights })
        .onConflictDoNothing({ target: [conversations.needId, conversations.helperId] })
        .returning({ id: conversations.id });
      const [existing] = created
        ? [created]
        : await db
            .select({ id: conversations.id })
            .from(conversations)
            .where(and(eq(conversations.needId, n.id), eq(conversations.helperId, userId)))
            .limit(1);
      await post(existing.id, userId, req.body.message);

      if (created) {
        // Tell the poster. Fail-soft: the reach-out stands even if mail doesn't go.
        const [[owner], [me]] = await Promise.all([
          db.select({ email: users.email }).from(users).where(eq(users.id, n.userId)).limit(1),
          db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1),
        ]);
        void sendMail(
          [
            simpleMail(
              owner.email,
              `${firstName(me.name)} can help with ${n.origin} → ${n.destination} on ${n.travelDate}`,
              `${firstName(me.name)} saw your TransitVault post for ${n.travelerLabel} (${n.flightNumbers.join(", ")}) and sent you a message. Reply on TransitVault.`,
              `/messages/${existing.id}`,
            ),
          ],
          (m) => req.log.info(m),
        ).catch((err) => req.log.warn({ err }, "reach-out mail failed"));
      }

      return reply.code(created ? 201 : 200).send(await view(await load(existing.id, userId), userId));
    },
  );

  app.get("/conversations", async (req) => {
    const rows = await conversationQuery(req.userId!).orderBy(desc(conversations.lastMessageAt));
    return Promise.all(rows.map((r) => view(r, req.userId!)));
  });

  app.get("/conversations/:id", { schema: { params } }, async (req) => view(await load(req.params.id, req.userId!), req.userId!));

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
      await load(req.params.id, req.userId!);
      const m = await post(req.params.id, req.userId!, req.body.body);
      return reply.code(201).send({ id: m.id, body: m.body, createdAt: m.createdAt, mine: true });
    },
  );
}

