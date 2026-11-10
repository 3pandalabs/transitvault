import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireAuth } from "../auth/plugin.js";
import { db } from "../db/index.js";
import { conversations, needs, users } from "../db/schema.js";
import { invalid, notFound } from "../lib/errors.js";
import { deriveRoute, LegError, type LegInput } from "../lib/legs.js";
import { registerRateLimit } from "../plugins/rateLimit.js";
import { firstName } from "./me.js";

// The needs board (api/ROUTES.md "Needs"). Signed-in only: a need describes an
// elderly person travelling alone, so nothing here is ever public.

type Need = typeof needs.$inferSelect;

const legSchema = z.object({
  flightNumber: z.string().trim().min(3).max(10),
  from: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "IATA airport code"),
  to: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "IATA airport code"),
  departsAt: z.string().datetime({ offset: true }),
  arrivesAt: z.string().datetime({ offset: true }),
});

const needInput = z.object({
  travelerLabel: z.string().trim().min(1).max(80),
  travelerAge: z.number().int().min(1).max(120).optional(),
  languages: z.array(z.string().trim().min(1).max(40)).min(1).max(8),
  assistance: z.string().trim().max(1000).optional(),
  legs: z.array(legSchema).min(1).max(4),
  notes: z.string().trim().max(2000).optional(),
});

/** Legs → the stored route columns, with leg errors as 400s. */
export function routeColumns(legs: LegInput[]) {
  try {
    const r = deriveRoute(legs);
    return {
      legs: r.legs,
      origin: r.origin,
      destination: r.destination,
      layovers: r.layovers,
      flightNumbers: r.flightNumbers,
      // Local wall-clock, so the date part is the local departure date.
      travelDate: r.legs[0].departsAt.slice(0, 10),
    };
  } catch (err) {
    if (err instanceof LegError) throw invalid(err.message);
    throw err;
  }
}

function summary(n: Need, poster: string, viewerId: string, responseCount = 0, myConversationId: string | null = null) {
  const mine = n.userId === viewerId;
  return {
    id: n.id,
    travelerLabel: n.travelerLabel,
    travelerAge: n.travelerAge,
    languages: n.languages,
    travelDate: n.travelDate,
    origin: n.origin,
    destination: n.destination,
    layovers: n.layovers,
    flightNumbers: n.flightNumbers,
    legs: n.legs,
    status: n.status,
    postedBy: { firstName: firstName(poster) },
    mine,
    responseCount: mine ? responseCount : 0,
    myConversationId: mine ? null : myConversationId,
    createdAt: n.createdAt,
  };
}

/** The viewer's conversation per need, for needs they reached out to (the board's "You responded" marker). */
async function myConversations(needIds: string[], viewerId: string): Promise<Map<string, string>> {
  if (!needIds.length) return new Map();
  const rows = await db
    .select({ needId: conversations.needId, id: conversations.id })
    .from(conversations)
    .where(and(inArray(conversations.needId, needIds), eq(conversations.helperId, viewerId)));
  return new Map(rows.map((r) => [r.needId, r.id]));
}

async function responseCounts(needIds: string[]): Promise<Map<string, number>> {
  if (!needIds.length) return new Map();
  const rows = await db
    .select({ needId: conversations.needId, n: sql<number>`count(*)::int` })
    .from(conversations)
    .where(inArray(conversations.needId, needIds))
    .groupBy(conversations.needId);
  return new Map(rows.map((r) => [r.needId, r.n]));
}

export async function needDetail(id: string, viewerId: string) {
  const [row] = await db
    .select({ need: needs, poster: users.name })
    .from(needs)
    .innerJoin(users, eq(users.id, needs.userId))
    .where(eq(needs.id, id))
    .limit(1);
  // A closed need is only the owner's business.
  if (!row || (row.need.status === "closed" && row.need.userId !== viewerId)) throw notFound();
  const mine = row.need.userId === viewerId;
  const counts = mine ? await responseCounts([id]) : new Map<string, number>();
  const convs = mine ? new Map<string, string>() : await myConversations([id], viewerId);
  return {
    ...summary(row.need, row.poster, viewerId, counts.get(id) ?? 0, convs.get(id) ?? null),
    assistance: row.need.assistance,
    notes: row.need.notes,
  };
}

export async function needRoutes(fastify: FastifyInstance) {
  await registerRateLimit(fastify);
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  app.addHook("preHandler", requireAuth);
  const params = z.object({ id: z.string().uuid() });

  app.get("/needs", async (req) => {
    const rows = await db
      .select({ need: needs, poster: users.name })
      .from(needs)
      .innerJoin(users, eq(users.id, needs.userId))
      .where(and(eq(needs.status, "open"), sql`${needs.travelDate} >= current_date - 1`))
      .orderBy(asc(needs.travelDate), asc(needs.createdAt))
      .limit(200);
    const [counts, convs] = await Promise.all([
      responseCounts(rows.filter((r) => r.need.userId === req.userId).map((r) => r.need.id)),
      myConversations(rows.filter((r) => r.need.userId !== req.userId).map((r) => r.need.id), req.userId!),
    ]);
    return rows.map((r) => summary(r.need, r.poster, req.userId!, counts.get(r.need.id), convs.get(r.need.id) ?? null));
  });

  app.get("/needs/mine", async (req) => {
    const rows = await db
      .select({ need: needs, poster: users.name })
      .from(needs)
      .innerJoin(users, eq(users.id, needs.userId))
      .where(eq(needs.userId, req.userId!))
      .orderBy(desc(needs.travelDate));
    const counts = await responseCounts(rows.map((r) => r.need.id));
    return rows.map((r) => summary(r.need, r.poster, req.userId!, counts.get(r.need.id)));
  });

  app.post(
    "/needs",
    { config: { rateLimit: { max: 20, timeWindow: 60 * 60_000, keyGenerator: (r) => r.userId ?? r.ip } }, schema: { body: needInput } },
    async (req, reply) => {
      const { legs, ...rest } = req.body;
      const [n] = await db
        .insert(needs)
        .values({ ...rest, ...routeColumns(legs), userId: req.userId! })
        .returning({ id: needs.id });
      return reply.code(201).send(await needDetail(n.id, req.userId!));
    },
  );

  app.get("/needs/:id", { schema: { params } }, async (req) => needDetail(req.params.id, req.userId!));

  app.patch(
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
}
