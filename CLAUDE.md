# TransitVault: repo conventions

A needs board for elderly parents flying alone. A family member posts the trip (who is travelling, languages, help needed, flights with times, connecting or direct). Someone on a matching flight reaches out, which opens a private conversation. The ninth 3PandaLabs app.

How it works: `infra/architecture.md`. API contract: `api/ROUTES.md`. **Change the contract first, then the code.** Provisioning: `infra/README.md`.

## Keep it simple (Anil, 2026-11-10)

TransitVault is deliberately small: **no document or boarding-pass uploads, no verification, no live tracking, no roles.** Don't add any of these, or a new vendor/tool, without Anil asking. The one exception Anil asked for (2026-11-11) is **paid help**: $10 per trip via Stripe Checkout when a poster accepts a helper, a $5 credit reward, no-show refunds as credit (`api/ROUTES.md` "Paid help"). It's off unless `PAYMENTS_ENABLED` + Stripe keys are set, and must keep failing soft to the free flow. Alerts and nudges are email only (SMTP); WhatsApp is a share link (`wa.me`), not an API. Built so far: needs board, public share preview (`/n/:id`), "I'm flying" posts with two-way matching and email alerts, thank-you notes, report/block, the stale-need nudge, the travel-day "sorry, no one offered to help" email, and board filters (from/to/via/date/flight/language).

## Naming

**TransitVault** everywhere, with no copy/identifier split. Every identifier is lowercase `transitvault`: repo, database, `transitvault_app` role, `transitvault-backups` R2 bucket (DB dumps only), Coolify resource `transitvault-api`, and the `/metrics` app key.

Hostnames, **all under one first label** (Cloudflare's per-app cert depends on it):
`transitvault.3pandalabs.com` (web) · `api.transitvault.3pandalabs.com` (proxied) · `api-internal.transitvault.3pandalabs.com` (DNS-only).

## Layout

`api/` (Fastify 5 + Drizzle + Zod + JWT) · `web/` (Next.js 16 on Cloudflare Workers) · `infra/`. There's no `app/`: the web app is mobile-first and installable as a PWA. There's no Temporal worker either: the only timers are hourly in-process DB sweeps (nudges, paid help).

## Invariants

- Signed-in only, except the share preview `GET /public/needs/:id`, which returns only the label, route, date, flights and languages of an open, visible need (no age, notes, assistance or poster) and is `noindex`.
- Posts reported by 3 different people are hidden (`hidden_at`) from boards, previews, matches and alerts. Blocked pairs never see each other's posts and can't message each other.
- Match alerts go out at most once per (need, flight post) pair (`match_alerts`); each nudge at most once per need (`nudged_at`, `no_helper_emailed_at`), and a need gets at most one of the two.
- The API never returns another user's phone or email. People share contact details in conversations themselves.
- One conversation per (need, helper). Conversations: 404 for non-parties. Closed needs: owner only.
- Leg times are airport-local wall-clock encoded with `Z` (`api/src/lib/legs.ts`). Never convert them by timezone. The single exception is `lib/landing.ts`, which estimates the real landing instant (paid-help "did they help?" email) and the real departure instant (travel-day "no helper" email) and never writes either back to legs. The route columns are always derived from `legs`, never sent by the client.
- Paid help: one live acceptance per need; credit is a ledger (`credit_entries`, balance = sum) with each reason at most once per acceptance; every money step is an idempotent conditional update; the Stripe webhook verifies its signature on the raw body.

## Conventions copied from the org checklist (knowledge_base/launching-a-new-app.md)

- Migrations are idempotent and run at container start. Drizzle emits a bare `CREATE TYPE`, so wrap new enums in `DO $$ … EXCEPTION WHEN duplicate_object …`. Don't set `MIGRATION_DATABASE_URL`.
- `GET /metrics` uses the shared envelope. `METRICS_TOKEN` is optional (503 when unset).
- `web/.env.production` is committed with the `NEXT_PUBLIC_*` values. Use `next build --webpack`. No `proxy.ts`/middleware.
- `robots.ts` + `sitemap.ts`; `noindex` on every signed-in route.
- `node:22-alpine` Dockerfile. Coolify env vars are runtime-only.

## Git flow

Never commit directly to `main`: branch → PR → merge, committing as `3pandalabs-admin`. The conditional gitconfig keys on the `3pandalabs` remote URL. Stage files explicitly and never run `git add -A`.
