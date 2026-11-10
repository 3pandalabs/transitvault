import { and, asc, desc, eq, isNull, notInArray, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireAuth } from "../auth/plugin.js";
import { db } from "../db/index.js";
import { flightPosts, needs, users } from "../db/schema.js";
import { alertForNewFlight } from "../lib/alerts.js";
import { conflict, forbidden, notFound } from "../lib/errors.js";
import { firstName, flightSummaries, needSummaries, needsMatching, routeColumns } from "../lib/posts.js";
import { blockedWith, isBlocked } from "../lib/social.js";
import { boardFilters, boardQuery } from "../lib/filters.js";
import { registerRateLimit } from "../plugins/rateLimit.js";
import { openConversation } from "./conversations.js";
import { languagesSchema, legSchema } from "./needs.js";

// "I'm flying" posts (api/ROUTES.md): a traveller offers to help on their own
// flight, matching needs get an alert, and a need's owner can message them.

const HOUR = 60 * 60_000;
const perUser = (max: number) => ({ rateLimit: { max, timeWindow: HOUR, keyGenerator: (r: { userId?: string; ip: string }) => r.userId ?? r.ip } });

const flightInput = z.object({
  legs: z.array(legSchema).min(1).max(4),
  languages: languagesSchema,
  note: z.string().trim().max(1000).optional(),
});

const withPoster = () =>
  db.select({ post: flightPosts, posterName: users.name }).from(flightPosts).innerJoin(users, eq(users.id, flightPosts.userId));

async function loadFlightFor(id: string, viewerId: string) {
  const [row] = await withPoster().where(eq(flightPosts.id, id)).limit(1);
  if (!row) throw notFound();
  const f = row.post;
  if (f.userId !== viewerId && (f.status === "closed" || f.hiddenAt || (await blockedWith(viewerId)).has(f.userId))) throw notFound();
  return row;
}

async function flightDetail(id: string, viewerId: string) {
  const [s] = await flightSummaries([await loadFlightFor(id, viewerId)], viewerId);
  return s;
}

async function matchesFor(flight: typeof flightPosts.$inferSelect, viewerId: string) {
  const matches = await needsMatching(flight);
  const cards = await needSummaries(matches, viewerId);
  return cards.map((c, i) => ({ ...c, matchReason: matches[i].matchReason }));
}

export async function flightRoutes(fastify: FastifyInstance) {
  await registerRateLimit(fastify);
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  app.addHook("preHandler", requireAuth);
  const params = z.object({ id: z.string().uuid() });

  app.get("/flights", { schema: { querystring: boardQuery } }, async (req) => {
    const blocked = [...(await blockedWith(req.userId!))];
    const rows = await withPoster()
      .where(
        and(
          eq(flightPosts.status, "open"),
          isNull(flightPosts.hiddenAt),
          sql`${flightPosts.travelDate} >= current_date - 1`,
          blocked.length ? notInArray(flightPosts.userId, blocked) : undefined,
          boardFilters(flightPosts, req.query),
        ),
      )
      .orderBy(asc(flightPosts.travelDate), asc(flightPosts.createdAt))
      .limit(200);
    return flightSummaries(rows, req.userId!);
  });

  app.get("/flights/mine", async (req) => {
    const rows = await withPoster().where(eq(flightPosts.userId, req.userId!)).orderBy(desc(flightPosts.travelDate));
    return flightSummaries(rows, req.userId!);
  });

  app.post("/flights", { config: perUser(20), schema: { body: flightInput } }, async (req, reply) => {
    const { legs, ...rest } = req.body;
    const [f] = await db
      .insert(flightPosts)
      .values({ ...rest, ...routeColumns(legs), userId: req.userId! })
      .returning();
    const [me] = await db.select({ name: users.name }).from(users).where(eq(users.id, req.userId!)).limit(1);
    void alertForNewFlight(f, firstName(me.name), req.log);
    return reply.code(201).send({ flight: await flightDetail(f.id, req.userId!), matches: await matchesFor(f, req.userId!) });
  });

  app.get("/flights/:id", { schema: { params } }, async (req) => flightDetail(req.params.id, req.userId!));

  app.patch(
    "/flights/:id",
    { schema: { params, body: flightInput.partial().extend({ status: z.enum(["open", "closed"]).optional() }) } },
    async (req) => {
      const { legs, ...rest } = req.body;
      const updated = await db
        .update(flightPosts)
        .set({ ...rest, ...(legs ? routeColumns(legs) : {}), updatedAt: new Date() })
        .where(and(eq(flightPosts.id, req.params.id), eq(flightPosts.userId, req.userId!)))
        .returning({ id: flightPosts.id });
      if (!updated.length) throw notFound();
      return flightDetail(req.params.id, req.userId!);
    },
  );

  app.get("/flights/:id/matches", { schema: { params } }, async (req) => {
    const [f] = await db
      .select()
      .from(flightPosts)
      .where(and(eq(flightPosts.id, req.params.id), eq(flightPosts.userId, req.userId!)))
      .limit(1);
    if (!f) throw notFound();
    return matchesFor(f, req.userId!);
  });

  // The need's owner asks the traveller for help: opens (or reuses) the
  // (need, helper) conversation with the traveller as helper.
  app.post(
    "/flights/:id/contact",
    { config: perUser(30), schema: { params, body: z.object({ needId: z.string().uuid(), message: z.string().trim().min(1).max(2000) }) } },
    async (req, reply) => {
      const userId = req.userId!;
      const { post: f } = await loadFlightFor(req.params.id, userId);
      if (f.userId === userId) throw conflict("own_flight");
      if (f.status !== "open") throw conflict("flight_not_open");
      const [n] = await db
        .select()
        .from(needs)
        .where(and(eq(needs.id, req.body.needId), eq(needs.userId, userId)))
        .limit(1);
      if (!n) throw notFound();
      if (n.status !== "open") throw conflict("need_not_open");
      if (await isBlocked(userId, f.userId)) throw forbidden("blocked");
      const { conversation, created } = await openConversation({
        need: n,
        helperId: f.userId,
        helperFlightNumbers: f.flightNumbers,
        senderId: userId,
        message: req.body.message,
        log: req.log,
      });
      return reply.code(created ? 201 : 200).send(conversation);
    },
  );
}
