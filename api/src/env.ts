import "dotenv/config";
import { z } from "zod";

// Validated once at import by the API. Pure modules (lib/legs) deliberately
// don't import it, so unit tests run without any
// environment.
const optional = z.string().optional().default("");

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(8080),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 chars (openssl rand -hex 32)"),

  // The web origin: CORS and links in emails.
  // CORS_ORIGINS adds extra comma-separated origins (local dev, previews).
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  // This API's public origin, for absolute links in emails that go through an
  // API route (the airport-assistance click redirect, /go/assist/:iata).
  PUBLIC_API_URL: z.string().url().default("https://api.transitvault.3pandalabs.com"),
  CORS_ORIGINS: optional,

  // Optional: unset → GET /metrics answers 503 and nothing else changes.
  METRICS_TOKEN: optional,

  // Mail: SMTP first (Gmail app password, port 587), the shared org gateway as
  // fallback. Both optional; every send fails soft.
  MAILER_URL: optional,
  MAILER_TOKEN: optional,
  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: optional,
  SMTP_PASS: optional,
  EMAIL_FROM_NAME: z.string().default("TransitVault"),
  // Where user reports go (api/ROUTES.md "Safety").
  OPS_EMAIL: z.string().email().default("support@3pandalabs.com"),

  // Shared with the web Worker (sent as X-Internal-Secret on api-internal calls).
  // Only with it is X-Client-IP trusted for rate-limit keys. Optional.
  INTERNAL_SHARED_SECRET: optional,

  // Paid help (api/ROUTES.md "Paid help"). OFF unless PAYMENTS_ENABLED is true
  // AND both Stripe values are set; otherwise the app is the free board as
  // before. STRIPE_API_BASE is for local mocks only.
  PAYMENTS_ENABLED: z
    .string()
    .optional()
    .transform((v) => ["1", "true", "yes", "on"].includes((v ?? "").trim().toLowerCase())),
  STRIPE_SECRET_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,
  STRIPE_API_BASE: z.string().url().default("https://api.stripe.com"),
  // Ops-only actions (POST /ops/...), e.g. a card refund on request. Bearer
  // token; unset → those routes answer 503. Never shared with the web.
  OPS_TOKEN: optional,

  GIT_COMMIT: optional,
  SOURCE_COMMIT: optional,
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  throw new Error(`Invalid environment: ${issues}`);
}

const e = parsed.data;

export const env = {
  ...e,
  CORS_ORIGINS: [e.WEB_ORIGIN, ...e.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)],
  // Coolify injects SOURCE_COMMIT at runtime; GIT_COMMIT is a manual override.
  GIT_COMMIT: e.SOURCE_COMMIT || e.GIT_COMMIT || "unknown",
  // A half-configured flag stays off (logged once at boot by lib/payments.ts).
  PAYMENTS_ENABLED: e.PAYMENTS_ENABLED && Boolean(e.STRIPE_SECRET_KEY && e.STRIPE_WEBHOOK_SECRET),
  PAYMENTS_FLAG_SET: e.PAYMENTS_ENABLED,
};
