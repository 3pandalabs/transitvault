# TransitVault

Is your parent flying alone? Post their flight: who's travelling, the languages they speak, the help they need, and the flight numbers and times, direct or connecting. Someone on the same flight can reach out to you.

**TransitVault | by 3PandaLabs**

| Folder | What |
|---|---|
| `api/` | Fastify + Drizzle backend. Contract: [`api/ROUTES.md`](api/ROUTES.md) |
| `web/` | Next.js on Cloudflare Workers: needs board, post a need, messages |
| `infra/` | [How it works](infra/architecture.md), [provisioning runbook](infra/README.md) |

Status: Phase 1 (needs board) built 2026-11-10. Phase 2: board filters. Optional paid help (Stripe, off by default) added 2026-11-11.
