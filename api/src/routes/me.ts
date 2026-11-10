import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireAuth } from "../auth/plugin.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { notFound } from "../lib/errors.js";
import { phoneSchema } from "./auth.js";

// GET/PATCH /me (api/ROUTES.md "Me").

export function userView(u: typeof users.$inferSelect) {
  return { id: u.id, email: u.email, name: u.name, phone: u.phone, alertsEnabled: u.alertsEnabled, createdAt: u.createdAt };
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0];

export async function meRoutes(fastify: FastifyInstance) {
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
}
