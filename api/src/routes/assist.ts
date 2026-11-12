import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AIRPORT_ASSISTANCE } from "../data/airportAssistance.js";
import { db } from "../db/index.js";
import { notFound } from "../lib/errors.js";
import { providerUrl } from "../lib/assist.js";
import { registerRateLimit } from "../plugins/rateLimit.js";

// Official airport assistance click-through (api/ROUTES.md "Airport
// assistance"). Logs one assist_clicks row, then 302s to the provider with the
// referral parameter when one is set. Public: links in emails and on the share
// preview are opened without a token. Logging is fail-soft: the family always
// reaches the provider.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function assistRoutes(fastify: FastifyInstance) {
  await registerRateLimit(fastify);
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/go/assist/:iata",
    {
      config: { rateLimit: { max: 60, timeWindow: 60_000 } },
      schema: { params: z.object({ iata: z.string() }), querystring: z.object({ need: z.string().optional() }) },
    },
    async (req, reply) => {
      const iata = req.params.iata.toUpperCase();
      const entry = /^[A-Z]{3}$/.test(iata) ? AIRPORT_ASSISTANCE[iata] : undefined;
      if (!entry) throw notFound();
      // A malformed or unknown need id is dropped, never an error.
      const needId = req.query.need && UUID.test(req.query.need) ? req.query.need : null;
      try {
        await db.execute(sql`
          insert into assist_clicks (iata, provider, need_id, user_id)
          values (
            ${iata},
            ${entry.provider},
            (select id from needs where id = ${needId}::uuid),
            (select id from users where id = ${req.userId ?? null}::uuid and deleted_at is null)
          )
        `);
      } catch (err) {
        req.log.warn({ err }, "assist click not logged");
      }
      return reply.header("cache-control", "no-store").redirect(providerUrl(entry), 302);
    },
  );
}
