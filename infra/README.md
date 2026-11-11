# TransitVault infra runbook

Follow `knowledge_base/launching-a-new-app.md`. This file only records TransitVault's values. Phase 1 has no worker and no media bucket, so it's the smallest backend in the org.

## Names

| Thing | Value |
|---|---|
| Repo | `3pandalabs/transitvault` (public: Coolify's public-repo source has no credentials) |
| Database / role | `transitvault` / `transitvault_app` on `3pandalabs-postgres` |
| R2 | `transitvault-backups` only (DB dumps), token scoped to it |
| Coolify | `transitvault-api` |
| Hosts, **all under one first label** | `transitvault.3pandalabs.com` (web Worker) · `api.transitvault.3pandalabs.com` (proxied) · `api-internal.transitvault.3pandalabs.com` (DNS-only) |
| `/metrics` app key | `transitvault` |

## Provisioning order

1. **Postgres** (in the container that holds the app databases; check with `\l`):
   ```sql
   CREATE ROLE transitvault_app LOGIN PASSWORD '<generated>';
   CREATE DATABASE transitvault OWNER transitvault_app;
   \c transitvault
   ALTER SCHEMA public OWNER TO transitvault_app;
   ```
2. **DNS** (before the first Coolify deploy): `api.transitvault` proxied → box IP; `api-internal.transitvault` DNS-only → box IP. Don't create `transitvault.3pandalabs.com` by hand: `wrangler deploy` owns it. Edge TLS for `api.transitvault` can lag for a few hours; check with `openssl s_client` before debugging the origin.
3. **Coolify `transitvault-api`**: public repo, branch `main`, Base Directory `api`, Dockerfile `Dockerfile`, Ports Exposes `8080`, domains `https://api.transitvault.3pandalabs.com,https://api-internal.transitvault.3pandalabs.com`, health check `GET /health`.
4. **Env vars**, all **runtime-only**: `DATABASE_URL, JWT_SECRET, WEB_ORIGIN=https://transitvault.3pandalabs.com, INTERNAL_SHARED_SECRET, SMTP_USER, SMTP_PASS, METRICS_TOKEN`. Paid help adds `PAYMENTS_ENABLED, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, OPS_TOKEN` (see below); leave them unset and nothing changes.
5. **Web**: `cd web && npm run cf:deploy`. `web/.env.production` (committed) carries the `NEXT_PUBLIC_*` values.
6. **Backups**: Coolify Postgres backup schedule → `transitvault-backups`.
7. **The six surfaces** (launch checklist §4): website card, admin page Usage table, admin flow diagram, tech-stack doc, Uptime Kuma (`/` and `api…/health`), watchdog.

## Paid help (Stripe)

Off until all three of `PAYMENTS_ENABLED=true`, `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are set on `transitvault-api` (a half-set config logs a warning at boot and stays off). No new service: the webhook is a route on the existing API and the post-trip "did they help?" emails ride the existing hourly in-process sweep. Contract: `api/ROUTES.md` "Paid help".

| Env var | Value |
|---|---|
| `PAYMENTS_ENABLED` | `true` to switch on (anything else = off) |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_live_…`; `sk_test_…` to try it). A **restricted key** with write on Checkout Sessions and Refunds is enough. |
| `STRIPE_WEBHOOK_SECRET` | The endpoint's signing secret (`whsec_…`) from step 3 |
| `OPS_TOKEN` | Optional. `openssl rand -hex 32`. Enables the ops-only card refund; unset → 503. Never put it in the web app. |

1. Create the Stripe account for 3PandaLabs LLC (NJ), turn on card payments in USD, and set the statement descriptor (e.g. `TRANSITVAULT`).
2. Create the API key (restricted key as above) → `STRIPE_SECRET_KEY`.
3. Developers → Webhooks → **Add endpoint**: URL `https://api.transitvault.3pandalabs.com/stripe/webhook` (the proxied host, not api-internal), events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`. Copy its signing secret → `STRIPE_WEBHOOK_SECRET`.
4. Set the vars in Coolify (runtime-only) and redeploy `transitvault-api`. The `0002_paid_help` migration runs at start (idempotent). The web needs no change or redeploy for the switch: it reads `GET /payments/config`.
5. Check: `curl https://api.transitvault.3pandalabs.com/payments/config` → `"enabled": true`; in Stripe, "Send test webhook" should show a 200 (`result: "ignored"` or `"unknown"`), and a bad signature a 400.
6. Try it end to end with test keys first (card `4242 4242 4242 4242`), then swap to live keys + a live-mode endpoint (it has its own signing secret).

**No-show refunds** are TransitVault credit by default (Stripe keeps its fee on card refunds). If a family asks for their card money back, ops runs:

```
curl -X POST -H "Authorization: Bearer $OPS_TOKEN" https://api.transitvault.3pandalabs.com/ops/acceptances/<acceptance id>/card-refund
```

It refunds the card part via Stripe and takes the same amount back out of their credit, once. Find the acceptance id with `select id, cash_cents, outcome from helper_acceptances where poster_id = (select id from users where email = '…');`.

**Switching off**: set `PAYMENTS_ENABLED=false` and redeploy. Nobody can start a new acceptance; trips already confirmed still get their "did they help?" email and credit. Keep `STRIPE_WEBHOOK_SECRET` set until any open checkouts (30 min) have finished.

Locally: `stripe listen --forward-to localhost:8080/stripe/webhook` prints a `whsec_…` to use as `STRIPE_WEBHOOK_SECRET`.

## Local development

```
cd api
cp .env.example .env                                   # fill JWT_SECRET
docker compose -f docker-compose.dev.yml up -d postgres
npm install && npm run db:migrate && npm run dev       # API on :8080
cd ../web && cp .env.example .env.local && npm install && npm run dev   # :3000
```
