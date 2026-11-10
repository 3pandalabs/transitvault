# TransitVault

Elderly parents flying alone, matched with a verified companion on the same flight, route or layover. The family follows every step live: check-in, security, gate, boarding, layover, landing, luggage and handover. The companion is paid out of escrow 2 hours after the handover.

**TransitVault | by 3PandaLabs**

| Folder | What |
|---|---|
| `api/` | Fastify + Drizzle + Temporal backend. Contract: [`api/ROUTES.md`](api/ROUTES.md) |
| `web/` | Next.js on Cloudflare Workers: organizer dashboard + live flight tracker, companion check-ins, ops console, and the large-type traveller card |
| `infra/` | [Architecture + data-flow diagrams](infra/architecture.md), [provisioning runbook](infra/README.md), R2 CORS policy |

Status: Phase 1 scaffold (2026-11-10), not yet deployed.
