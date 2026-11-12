import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { markUserDeleted, requireAuth } from "../auth/plugin.js";
import { verifySecret } from "../auth/password.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { blockersFor, deleteAccount } from "../lib/accountDeletion.js";
import { forbidden, notFound } from "../lib/errors.js";
import { creditBalance } from "../lib/payments.js";
import { registerRateLimit } from "../plugins/rateLimit.js";
import { phoneSchema } from "./auth.js";

// GET/PATCH /me and account deletion (api/ROUTES.md "Me").

export function userView(u: typeof users.$inferSelect) {
  return { id: u.id, email: u.email, name: u.name, phone: u.phone, alertsEnabled: u.alertsEnabled, createdAt: u.createdAt };
}

export { firstName } from "../lib/deletion.js";

export async function meRoutes(fastify: FastifyInstance) {
  await registerRateLimit(fastify);
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  app.addHook("preHandler", requireAuth);

  app.get("/me", async (req) => {
    const [u] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
    if (!u) throw notFound();
    return { user: userView(u) };
  });

  app.patch(
    "/me",
    {
      schema: {
        body: z.object({ name: z.string().trim().min(1).max(120).optional(), phone: phoneSchema.optional(), alertsEnabled: z.boolean().optional() }),
      },
    },
    async (req) => {
      const [u] = await db.update(users).set(req.body).where(eq(users.id, req.userId!)).returning();
      if (!u) throw notFound();
      return { user: userView(u) };
    },
  );

  // ---- account deletion (api/ROUTES.md "Account deletion") ----

  app.get("/me/deletion", async (req) => {
    const [blockers, creditCents] = await Promise.all([blockersFor(req.userId!), creditBalance(req.userId!)]);
    return { canDelete: blockers.length === 0, blockers, creditCents };
  });

  app.post(
    "/me/delete",
    {
      config: { rateLimit: { max: 5, timeWindow: 15 * 60_000, keyGenerator: (r) => (r.userId ? `user:${r.userId}` : r.ip) } },
      schema: { body: z.object({ password: z.string().min(1).max(200) }) },
    },
    async (req, reply) => {
      const me = req.userId!;
      const [u] = await db.select({ passwordHash: users.passwordHash, deletedAt: users.deletedAt }).from(users).where(eq(users.id, me)).limit(1);
      if (!u || u.deletedAt) return reply.code(401).send({ error: "account_deleted" });
      if (!(await verifySecret(req.body.password, u.passwordHash))) throw forbidden("wrong_password");
      const res = await deleteAccount(me);
      if (!res.ok && res.reason === "blocked") {
        return reply.code(409).send({ error: "paid_help_in_progress", code: "CONFLICT", blockers: res.blockers });
      }
      if (!res.ok) return reply.code(401).send({ error: "account_deleted" });
      markUserDeleted(me);
      req.log.info({ userId: me, forfeitedCents: res.forfeitedCents }, "account deleted");
      return reply.code(204).send();
    },
  );
}
