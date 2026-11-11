import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireAuth } from "../auth/plugin.js";
import { env } from "../env.js";
import { conflict } from "../lib/errors.js";
import { acceptanceForToken, creditSummary, feedbackView, handleStripeEvent, paymentsConfig, refundToCard, resolveOutcome } from "../lib/payments.js";
import { verifySignature, type StripeEvent } from "../lib/stripe.js";
import { registerRateLimit } from "../plugins/rateLimit.js";

// Paid help (api/ROUTES.md "Paid help"): config, credit, the emailed
// "did they help?" links, and the Stripe webhook.

export async function paymentRoutes(fastify: FastifyInstance) {
  await registerRateLimit(fastify);
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get("/payments/config", async () => paymentsConfig());

  app.get("/me/credits", { preHandler: requireAuth }, async (req) => creditSummary(req.userId!));

  // Signed single-use links from the "Did <helper> help?" email. The token is
  // in the query string (never logged) or the body, never the path.
  const token = z.string().min(40).max(200);
  const perIp = { rateLimit: { max: 30, timeWindow: 60_000 } };
  app.get("/feedback", { config: perIp, schema: { querystring: z.object({ token }) } }, async (req) =>
    feedbackView(await acceptanceForToken(req.query.token)),
  );
  app.post("/feedback", { config: perIp, schema: { body: z.object({ token, helped: z.boolean() }) } }, async (req) => {
    const a = await acceptanceForToken(req.body.token);
    if (a.outcome) throw conflict("already_answered");
    const done = await resolveOutcome(a.id, req.body.helped ? "helped" : "no_show", "poster", req.log);
    if (!done) throw conflict("already_answered");
    return feedbackView(done);
  });

  // Ops only: refund a no-show's card payment instead of the default credit
  // (the poster asked support). Bearer OPS_TOKEN, like /metrics.
  app.post("/ops/acceptances/:id/card-refund", { config: perIp, schema: { params: z.object({ id: z.string().uuid() }) } }, async (req, reply) => {
    if (!env.OPS_TOKEN) return reply.code(503).send({ error: "ops_disabled" });
    const header = req.headers.authorization ?? "";
    const presented = Buffer.from(header.startsWith("Bearer ") ? header.slice(7) : "");
    const expected = Buffer.from(env.OPS_TOKEN);
    if (presented.length !== expected.length || !timingSafeEqual(presented, expected)) return reply.code(401).send({ error: "unauthorized" });
    return refundToCard(req.params.id, req.log);
  });

  // Stripe → us. Needs the raw body for the signature, so it lives in its own
  // encapsulated scope with a string JSON parser.
  await app.register(async (hook) => {
    hook.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => done(null, body));
    hook.post("/stripe/webhook", async (req, reply) => {
      if (!env.STRIPE_WEBHOOK_SECRET) return reply.code(503).send({ error: "payments_not_configured" });
      const raw = typeof req.body === "string" ? req.body : "";
      const sig = req.headers["stripe-signature"];
      if (!verifySignature(raw, typeof sig === "string" ? sig : undefined, env.STRIPE_WEBHOOK_SECRET)) {
        return reply.code(400).send({ error: "invalid_signature" });
      }
      let event: StripeEvent;
      try {
        event = JSON.parse(raw) as StripeEvent;
      } catch {
        return reply.code(400).send({ error: "invalid_payload" });
      }
      const result = await handleStripeEvent(event, req.log);
      req.log.info({ type: event.type, result }, "stripe webhook");
      return { received: true, result };
    });
  });
}
