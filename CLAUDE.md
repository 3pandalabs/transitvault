# TransitVault: repo conventions

A needs board for elderly parents flying alone. A family member posts the trip (who is travelling, languages, help needed, flights with times, connecting or direct). Someone on a matching flight reaches out, which opens a private conversation. The ninth 3PandaLabs app.

How it works: `infra/architecture.md`. API contract: `api/ROUTES.md`. **Change the contract first, then the code.** Provisioning: `infra/README.md`.

## Keep it simple (Anil, 2026-11-10)

Phase 1 is deliberately small: **no money, no document or boarding-pass uploads, no verification, no live tracking, no roles.** Don't add any of these, or a new vendor/tool, without Anil asking. Next on the list is Phase 2: board filters (from/to/via/date/flight/language) and helper posts. The indexes for the filters already exist.

## Naming

**TransitVault** everywhere, with no copy/identifier split. Every identifier is lowercase `transitvault`: repo, database, `transitvault_app` role, `transitvault-backups` R2 bucket (DB dumps only), Coolify resource `transitvault-api`, and the `/metrics` app key.

Hostnames, **all under one first label** (Cloudflare's per-app cert depends on it):
`transitvault.3pandalabs.com` (web) · `api.transitvault.3pandalabs.com` (proxied) · `api-internal.transitvault.3pandalabs.com` (DNS-only).

## Layout

`api/` (Fastify 5 + Drizzle + Zod + JWT) · `web/` (Next.js 16 on Cloudflare Workers) · `infra/`. There's no `app/`: the web app is mobile-first and installable as a PWA. There's no Temporal worker either, because nothing needs a timer.

## Invariants

- Signed-in only. Needs describe elderly people travelling alone, so nothing about them is public or indexable.
- The API never returns another user's phone or email. People share contact details in conversations themselves.
- One conversation per (need, helper). Conversations: 404 for non-parties. Closed needs: owner only.
- Leg times are airport-local wall-clock encoded with `Z` (`api/src/lib/legs.ts`). Never convert them by timezone. The route columns are always derived from `legs`, never sent by the client.

## Conventions copied from the org checklist (knowledge_base/launching-a-new-app.md)

- Migrations are idempotent and run at container start. Drizzle emits a bare `CREATE TYPE`, so wrap new enums in `DO $$ … EXCEPTION WHEN duplicate_object …`. Don't set `MIGRATION_DATABASE_URL`.
- `GET /metrics` uses the shared envelope. `METRICS_TOKEN` is optional (503 when unset).
- `web/.env.production` is committed with the `NEXT_PUBLIC_*` values. Use `next build --webpack`. No `proxy.ts`/middleware.
- `robots.ts` + `sitemap.ts`; `noindex` on every signed-in route.
- `node:22-alpine` Dockerfile. Coolify env vars are runtime-only.

## Git flow

Never commit directly to `main`: branch → PR → merge, committing as `3pandalabs-admin`. The conditional gitconfig keys on the `3pandalabs` remote URL. Stage files explicitly and never run `git add -A`.
