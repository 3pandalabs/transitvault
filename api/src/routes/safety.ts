import { and, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireAuth } from "../auth/plugin.js";
import { db } from "../db/index.js";
import { flightPosts, needs, reports, userBlocks, users } from "../db/schema.js";
import { env } from "../env.js";
import { invalid, notFound } from "../lib/errors.js";
import { sendMail, simpleMail } from "../lib/mailer.js";
import { firstName } from "../lib/posts.js";
import { registerRateLimit } from "../plugins/rateLimit.js";

// Reports and blocks (api/ROUTES.md "Safety").

/** A need or flight post reported by this many different people is hidden. */
export const HIDE_AFTER_REPORTS = 3;

export async function safetyRoutes(fastify: FastifyInstance) {
  await registerRateLimit(fastify);
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  app.addHook("preHandler", requireAuth);
  const params = z.object({ id: z.string().uuid() });

  app.post(
    "/reports",
    {
      config: { rateLimit: { max: 20, timeWindow: 60 * 60_000, keyGenerator: (r) => r.userId ?? r.ip } },
      schema: {
        body: z.object({
          targetType: z.enum(["need", "flight", "user"]),
          targetId: z.string().uuid(),
          reason: z.enum(["spam", "inappropriate", "scam", "other"]),
          note: z.string().trim().max(1000).optional(),
        }),
      },
    },
    async (req, reply) => {
      const b = req.body;
      const table = b.targetType === "need" ? needs : b.targetType === "flight" ? flightPosts : users;
      const [target] = await db.select({ id: table.id }).from(table).where(eq(table.id, b.targetId)).limit(1);
      if (!target) throw notFound();
      if (b.targetType === "user" && b.targetId === req.userId) throw invalid("cannot_report_self");

      const [row] = await db
        .insert(reports)
        .values({ reporterId: req.userId!, targetType: b.targetType, targetId: b.targetId, reason: b.reason, note: b.note })
        .onConflictDoNothing()
        .returning({ id: reports.id });
      if (!row) return reply.code(200).send({ ok: true });

      // Hide a post once enough different people have reported it.
      if (b.targetType !== "user") {
        const [{ n }] = await db
          .select({ n: sql<number>`count(distinct ${reports.reporterId})::int` })
          .from(reports)
          .where(and(eq(reports.targetType, b.targetType), eq(reports.targetId, b.targetId)));
        if (n >= HIDE_AFTER_REPORTS) {
          if (b.targetType === "need") await db.update(needs).set({ hiddenAt: new Date() }).where(eq(needs.id, b.targetId));
          else await db.update(flightPosts).set({ hiddenAt: new Date() }).where(eq(flightPosts.id, b.targetId));
        }
      }

      void sendMail(
        [
          simpleMail(
            env.OPS_EMAIL,
            `TransitVault report: ${b.targetType} (${b.reason})`,
            `Report ${row.id}: ${b.targetType} ${b.targetId}, reason ${b.reason}, by user ${req.userId}.${b.note ? ` Note: ${b.note}` : ""}`,
          ),
        ],
        (m) => req.log.info(m),
      ).catch((err) => req.log.warn({ err }, "report mail failed"));
      return reply.code(201).send({ ok: true });
    },
  );

  app.get("/blocks", async (req) => {
    const rows = await db
      .select({ userId: userBlocks.blockedId, name: users.name })
      .from(userBlocks)
      .innerJoin(users, eq(users.id, userBlocks.blockedId))
      .where(eq(userBlocks.blockerId, req.userId!));
    return rows.map((r) => ({ userId: r.userId, firstName: firstName(r.name) }));
  });

  app.post("/users/:id/block", { schema: { params } }, async (req, reply) => {
    if (req.params.id === req.userId) throw invalid("cannot_block_self");
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, req.params.id)).limit(1);
    if (!u) throw notFound();
    await db.insert(userBlocks).values({ blockerId: req.userId!, blockedId: u.id }).onConflictDoNothing();
    return reply.code(204).send();
  });

  app.delete("/users/:id/block", { schema: { params } }, async (req, reply) => {
    await db.delete(userBlocks).where(and(eq(userBlocks.blockerId, req.userId!), eq(userBlocks.blockedId, req.params.id)));
    return reply.code(204).send();
  });
}
