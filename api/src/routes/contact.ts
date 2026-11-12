import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { env } from "../env.js";
import { sendMail, type Mail } from "../lib/mailer.js";
import { globalLimiter, registerRateLimit } from "../plugins/rateLimit.js";

// The web's contact form (api/ROUTES.md "Contact"). Public; relays one email to
// OPS_EMAIL with Reply-To = the sender, and stores nothing.

export const CONTACT_TOPICS = {
  general: "General question",
  safety: "Safety report",
  payments: "Payments & credit",
  delete_data: "Delete my data",
  other: "Other",
} as const;

const HOUR = 60 * 60_000;
// Layer 2 (see plugins/rateLimit.ts): bounds a flood of the one inbox however
// many IPs it comes from. Only counted for requests that passed layer 1.
const contactGlobal = globalLimiter(40, HOUR);

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function contactMail(o: { to: string; name: string; email: string; topic: keyof typeof CONTACT_TOPICS; message: string; userId?: string }): Mail {
  const topic = CONTACT_TOPICS[o.topic];
  const who = `${o.name} <${o.email}>${o.userId ? ` (signed in as user ${o.userId})` : " (not signed in)"}`;
  return {
    to: o.to,
    replyTo: o.email,
    subject: `TransitVault contact: ${topic} from ${o.name}`.slice(0, 200),
    text: `From: ${who}\nTopic: ${topic}\n\n${o.message}\n\nReply to this email to answer them.`,
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1f2937;max-width:560px;">
  <p style="font-size:13px;color:#6b7280;">From: ${esc(who)}<br>Topic: ${esc(topic)}</p>
  <p style="font-size:15px;line-height:1.6;white-space:pre-wrap;">${esc(o.message)}</p>
  <p style="font-size:13px;color:#6b7280;">Reply to this email to answer them.</p>
</div>`,
  };
}

export async function contactRoutes(fastify: FastifyInstance) {
  await registerRateLimit(fastify);
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.post(
    "/contact",
    {
      config: { rateLimit: { max: 5, timeWindow: HOUR } },
      schema: {
        body: z.object({
          name: z.string().trim().min(1).max(120),
          email: z.string().trim().email().max(320),
          topic: z.enum(Object.keys(CONTACT_TOPICS) as [keyof typeof CONTACT_TOPICS, ...(keyof typeof CONTACT_TOPICS)[]]),
          message: z.string().trim().min(1).max(4000),
          // Honeypot: hidden on the form, so only bots fill it.
          website: z.string().max(500).optional(),
        }),
      },
    },
    async (req, reply) => {
      const b = req.body;
      if (b.website?.trim()) return reply.code(204).send();
      if (!contactGlobal()) return reply.code(429).send({ error: "rate_limited" });
      const res = await sendMail(
        [contactMail({ to: env.OPS_EMAIL, name: b.name, email: b.email, topic: b.topic, message: b.message, userId: req.userId })],
        (m) => req.log.info(m),
      ).catch(() => ({ delivered: 0, failed: 1, skipped: 0 }));
      // Not fail-soft on purpose: "sent" when nobody will read it is worse.
      if (!res.delivered) return reply.code(503).send({ error: "mailer_unavailable" });
      return reply.code(204).send();
    },
  );
}
