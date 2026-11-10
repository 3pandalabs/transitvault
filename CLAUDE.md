# TransitVault: repo conventions

Verified travel companions for elderly parents flying alone. An adult child (**organizer**) books a peer traveller (**companion**) on the same flight, route or layover. The companion checks in at each step and hands the parent over on arrival. Payment is held in escrow until 2 hours after the handover. The ninth 3PandaLabs app.

Design and diagrams: `infra/architecture.md`. API contract: `api/ROUTES.md`. **Change the contract first, then the code.** Provisioning: `infra/README.md`.

## Naming

**TransitVault** everywhere. It was named before anything was provisioned, so there's no copy/identifier split. Every identifier is lowercase `transitvault`: repo, database, `transitvault_app` role, R2 buckets (`transitvault-documents`, `transitvault-backups`), Coolify resources (`transitvault-api`, `transitvault-worker`), Temporal task queue `transitvault`, and the `/metrics` app key.

Hostnames, **all under one first label** (Cloudflare's per-app cert depends on it):
`transitvault.3pandalabs.com` (web) · `api.transitvault.3pandalabs.com` (proxied) · `api-internal.transitvault.3pandalabs.com` (DNS-only).

## Layout

`api/` (Fastify 5 + Drizzle + Zod + JWT + Temporal worker) · `web/` (Next.js 16 on Cloudflare Workers: organizer dashboard, companion views, ops console, traveller card) · `infra/`. There's no `app/`: the traveller and companion views are mobile-first web pages, and the site is installable as a PWA.

## Stack rule

Use the org's existing tools only. No new vendors or SDKs (identity, payments, realtime, OCR) without Anil's explicit go-ahead. The seams are there for when one is chosen:

- `api/src/payments/provider.ts`: `PaymentProvider`. Phase 1 is `manual`: the organizer transfers, ops confirms in `/admin`, ops pays out. **Holding customer funds as escrow needs a licensing/legal decision (India and US) before a real gateway or real volume.**
- `api/src/verification/provider.ts`: `VerificationProvider`. Phase 1 is manual review of an uploaded document.
- Live updates are SSE fed by Postgres `LISTEN/NOTIFY` (`api/src/realtime/hub.ts`). Don't add a WebSocket server or a broker.

## Invariants (don't weaken these)

- `matches.status` changes **only** through `match/transition.ts`: a conditional update plus a `match_events` row in one transaction, which also moves the trip's status and queues the live event.
- Every escrow write is a conditional update on the current escrow status (`payments/escrow.ts`). The Temporal timer, the worker sweep and ops clicks may race safely.
- One live match per trip (`matches_one_live_per_trip` partial unique index). Listing capacity is checked under a row lock on accept.
- Contact details, traveller details and the companion on the traveller card appear only from `escrow_funded` onwards.
- Milestones are ordered (`match/states.ts`), idempotent on `clientId`, and `handed_off` requires a photo (DB check constraint).
- Uploads: keys are `u/<userId>/<purpose>/<uuid>.<ext>`. A route accepts only the caller's own key for the right purpose, re-hashes it, and never accepts a key twice. Media leaves the API only as 10-minute presigned URLs inside authorised views.
- Leg times are airport-local wall-clock encoded with `Z` (see `lib/legs.ts`). Never convert them by timezone.
- 404 (not 403) for anything the caller isn't a party to. `admin` comes only from the seed.

## Conventions copied from the org checklist (knowledge_base/launching-a-new-app.md)

- Migrations are idempotent and run at container start. Drizzle emits a bare `CREATE TYPE`, so wrap new enums in `DO $$ … EXCEPTION WHEN duplicate_object …`. Don't set `MIGRATION_DATABASE_URL`.
- R2 `S3Client` uses `requestChecksumCalculation: "WHEN_REQUIRED"`. The CORS policy is `infra/r2-cors.json`.
- `GET /metrics` uses the shared envelope. `METRICS_TOKEN` is optional (503 when unset).
- `web/.env.production` is committed with the `NEXT_PUBLIC_*` values. Use `next build --webpack`. No `proxy.ts`/middleware.
- `robots.ts` + `sitemap.ts`; `noindex` on authed routes and on `/t/*`.
- Dockerfiles: the API is `node:22-alpine`; the worker is `node:22-bookworm-slim` (the Temporal core bridge needs glibc).
- Coolify env vars are runtime-only.

## Git flow

Never commit directly to `main`: branch → PR → merge, committing as `3pandalabs-admin`. The conditional gitconfig keys on the `3pandalabs` remote URL, so add the remote before the first commit. Stage files explicitly and never run `git add -A`.
