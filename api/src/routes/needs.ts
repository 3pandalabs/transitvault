import { and, asc, desc, eq, isNull, notInArray, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireAuth } from "../auth/plugin.js";
import { db } from "../db/index.js";
import { needs, users } from "../db/schema.js";
import { alertForNewNeed } from "../lib/alerts.js";
import { notFound } from "../lib/errors.js";
import { flightSummaries, flightsMatching, needSummaries, publicNeed, routeColumns } from "../lib/posts.js";
import { blockedWith } from "../lib/social.js";
import { registerRateLimit } from "../plugins/rateLimit.js";

// The needs board (api/ROUTES.md "Needs") and its public share preview.

export const legSchema = z.object({
  flightNumber: z.string().trim().min(3).max(10),
  from: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "IATA airport code"),
  to: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "IATA airport code"),
  departsAt: z.string().datetime({ offset: true }),
  arrivesAt: z.string().datetime({ offset: true }),
});
export const languagesSchema = z.array(z.string().trim().min(1).max(40)).min(1).max(8);

const needInput = z.object({
  travelerLabel: z.string().trim().min(1).max(80),
  travelerAge: z.number().int().min(1).max(120).optional(),
  languages: languagesSchema,
  assistance: z.string().trim().max(1000).optional(),
  legs: z.array(legSchema).min(1).max(4),
  notes: z.string().trim().max(2000).optional(),
});

const withPoster = () => db.select({ post: needs, posterName: users.name }).from(needs).innerJoin(users, eq(users.id, needs.userId));

/**
 * One need as the viewer may see it. Closed or report-hidden needs are the
 * owner's business only, and blocked pairs can't see each other's posts.
 */
export async function loadNeedFor(id: string, viewerId: string) {
  const [row] = await withPoster().where(eq(needs.id, id)).limit(1);
  if (!row) throw notFound();
  const n = row.post;
  if (n.userId !== viewerId && (n.status === "closed" || n.hiddenAt || (await blockedWith(viewerId)).has(n.userId))) throw notFound();
  return row;
}

export async function needDetail(id: string, viewerId: string) {
  const row = await loadNeedFor(id, viewerId);
  const [s] = await needSummaries([row], viewerId);
  return { ...s, assistance: row.post.assistance, notes: row.post.notes };
}

export async function needRoutes(fastify: FastifyInstance) {
  await registerRateLimit(fastify);
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const params = z.object({ id: z.string().uuid() });

  // Public share preview: open, visible needs only, and only the route, date,
  // flights, languages and the "who" label. No age, notes or poster name.
  app.get("/public/needs/:id", { config: { rateLimit: { max: 120, timeWindow: 60_000 } }, schema: { params } }, async (req) => {
    const [n] = await db
      .select()
      .from(needs)
      .where(and(eq(needs.id, req.params.id), eq(needs.status, "open"), isNull(needs.hiddenAt)))
      .limit(1);
    if (!n) throw notFound();
    return publicNeed(n);
  });

  await app.register(async (authed) => {
    const a = authed.withTypeProvider<ZodTypeProvider>();
    a.addHook("preHandler", requireAuth);

    a.get("/needs", async (req) => {
      const blocked = [...(await blockedWith(req.userId!))];
      const rows = await withPoster()
        .where(
          and(
            eq(needs.status, "open"),
            isNull(needs.hiddenAt),
            sql`${needs.travelDate} >= current_date - 1`,
            blocked.length ? notInArray(needs.userId, blocked) : undefined,
          ),
        )
        .orderBy(asc(needs.travelDate), asc(needs.createdAt))
        .limit(200);
      return needSummaries(rows, req.userId!);
    });

    a.get("/needs/mine", async (req) => {
      const rows = await withPoster().where(eq(needs.userId, req.userId!)).orderBy(desc(needs.travelDate));
      return needSummaries(rows, req.userId!);
    });

    a.post(
      "/needs",
      { config: { rateLimit: { max: 20, timeWindow: 60 * 60_000, keyGenerator: (r) => r.userId ?? r.ip } }, schema: { body: needInput } },
      async (req, reply) => {
        const { legs, ...rest } = req.body;
        const [n] = await db
          .insert(needs)
          .values({ ...rest, ...routeColumns(legs), userId: req.userId! })
          .returning();
        void alertForNewNeed(n, req.log);
        return reply.code(201).send(await needDetail(n.id, req.userId!));
      },
    );

    a.get("/needs/:id", { schema: { params } }, async (req) => needDetail(req.params.id, req.userId!));

    a.patch(
      "/needs/:id",
      { schema: { params, body: needInput.partial().extend({ status: z.enum(["open", "found", "closed"]).optional() }) } },
      async (req) => {
        const { legs, ...rest } = req.body;
        const updated = await db
          .update(needs)
          .set({ ...rest, ...(legs ? routeColumns(legs) : {}), updatedAt: new Date() })
          .where(and(eq(needs.id, req.params.id), eq(needs.userId, req.userId!)))
          .returning({ id: needs.id });
        if (!updated.length) throw notFound();
        return needDetail(req.params.id, req.userId!);
      },
    );

    // "People on your flight": open flight posts matching the owner's need.
    a.get("/needs/:id/matches", { schema: { params } }, async (req) => {
      const [n] = await db
        .select()
        .from(needs)
        .where(and(eq(needs.id, req.params.id), eq(needs.userId, req.userId!)))
        .limit(1);
      if (!n) throw notFound();
      const matches = await flightsMatching(n);
      const cards = await flightSummaries(matches, req.userId!);
      return cards.map((c, i) => ({ ...c, matchReason: matches[i].matchReason }));
    });
  });
}
