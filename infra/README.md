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
4. **Env vars**, all **runtime-only**: `DATABASE_URL, JWT_SECRET, WEB_ORIGIN=https://transitvault.3pandalabs.com, INTERNAL_SHARED_SECRET, SMTP_USER, SMTP_PASS, METRICS_TOKEN`.
5. **Web**: `cd web && npm run cf:deploy`. `web/.env.production` (committed) carries the `NEXT_PUBLIC_*` values.
6. **Backups**: Coolify Postgres backup schedule → `transitvault-backups`.
7. **The six surfaces** (launch checklist §4): website card, admin page Usage table, admin flow diagram, tech-stack doc, Uptime Kuma (`/` and `api…/health`), watchdog.

## Local development

```
cd api
cp .env.example .env                                   # fill JWT_SECRET
docker compose -f docker-compose.dev.yml up -d postgres
npm install && npm run db:migrate && npm run dev       # API on :8080
cd ../web && cp .env.example .env.local && npm install && npm run dev   # :3000
```
