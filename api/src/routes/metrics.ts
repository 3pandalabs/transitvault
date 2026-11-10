import { timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { env } from "../env.js";
import { cpuPercentOfOneCore, requestsLastHour } from "../metrics/collector.js";

// Ops-only endpoint scraped server-side by admin.3pandalabs.com. Own bearer
// token (METRICS_TOKEN, optional -> 503), aggregate counts only. The envelope
// (app/collectedAt/uptimeSeconds/counts/traffic/process/database) is shared
// across every 3PandaLabs app; only the `counts` keys are per-app.

function tokenMatches(presented: string, expected: string): boolean {
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

type CountsRow = {
  users: number;
  open_needs: number;
  found_needs: number;
  needs_last_7d: number;
  open_flights: number;
  reports_last_7d: number;
  conversations: number;
  messages_last_24h: number;
  active_sessions: number;
};

type DatabaseRow = { size_bytes: string; size_pretty: string; connections: number };

export async function metricsRoutes(app: FastifyInstance) {
  app.get("/metrics", async (req, reply) => {
    if (!env.METRICS_TOKEN) return reply.code(503).send({ error: "metrics_disabled" });
    const header = req.headers.authorization ?? "";
    const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!tokenMatches(presented, env.METRICS_TOKEN)) return reply.code(401).send({ error: "unauthorized" });

    const counts = await db.execute<CountsRow>(sql`
      select
        (select count(*) from users)::int as users,
        (select count(*) from needs where status = 'open' and travel_date >= current_date - 1)::int as open_needs,
        (select count(*) from needs where status = 'found')::int as found_needs,
        (select count(*) from needs where created_at > now() - interval '7 days')::int as needs_last_7d,
        (select count(*) from flight_posts where status = 'open' and travel_date >= current_date - 1)::int as open_flights,
        (select count(*) from reports where created_at > now() - interval '7 days')::int as reports_last_7d,
        (select count(*) from conversations)::int as conversations,
        (select count(*) from messages where created_at > now() - interval '24 hours')::int as messages_last_24h,
        (select count(*) from sessions where expires_at > now())::int as active_sessions
    `);
    const database = await db.execute<DatabaseRow>(sql`
      select
        pg_database_size(current_database()) as size_bytes,
        pg_size_pretty(pg_database_size(current_database())) as size_pretty,
        (select count(*) from pg_stat_activity where datname = current_database())::int as connections
    `);

    const c = counts.rows[0];
    const d = database.rows[0];
    const mem = process.memoryUsage();
    return {
      app: "transitvault",
      collectedAt: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      counts: {
        users: c.users,
        openNeeds: c.open_needs,
        foundNeeds: c.found_needs,
        needsLast7d: c.needs_last_7d,
        openFlights: c.open_flights,
        reportsLast7d: c.reports_last_7d,
        conversations: c.conversations,
        messagesLast24h: c.messages_last_24h,
        activeSessions: c.active_sessions,
      },
      traffic: { apiRequestsLastHour: requestsLastHour() },
      process: { rssBytes: mem.rss, heapUsedBytes: mem.heapUsed, cpuPercentOfOneCore: cpuPercentOfOneCore() },
      database: { sizeBytes: Number(d.size_bytes), sizePretty: d.size_pretty, connections: d.connections },
    };
  });
}
