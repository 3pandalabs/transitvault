# TransitVault: how it works

A needs board for elderly parents flying alone. A family member posts the trip ("my mother, 68, Hindi/Punjabi, DEL → FRA → ORD on 1 Dec, LH761 + LH430, needs a wheelchair at Frankfurt"). Other signed-in users browse the board. Anyone on a matching flight reaches out with a message, which opens a private conversation. People share phone numbers there when they choose to.

Phase 1 deliberately has **no uploads, no verification and no live tracking**. Money is limited to the optional **paid help** step below (off unless Stripe is configured).

## Stack (same as the other org apps, minus what Phase 1 doesn't need)

| Layer | What | Where |
|---|---|---|
| Web | Next.js 16, React 19, Tailwind 4, lucide | Cloudflare Workers (`transitvault.3pandalabs.com`) |
| API | Fastify 5 + Zod + JWT | Coolify on the Hetzner box (`transitvault-api`) |
| Data | Postgres 17 + Drizzle | shared `3pandalabs-postgres`, db `transitvault` |
| Mail | SMTP (Gmail app password) → org mailer fallback | "someone reached out", password reset, paid-help mails |
| Payments (optional) | Stripe Checkout + one webhook, called over HTTPS (no SDK) | only when `PAYMENTS_ENABLED` + keys are set |

There's no Temporal worker and no R2 media bucket. The only timers (stale-need nudge, paid-help sweep) are hourly idempotent DB sweeps inside the API process.

```mermaid
flowchart LR
  B[Browser] -->|HTML/JS| W[transitvault-web Worker]
  B -->|JSON, Bearer JWT| API[transitvault-api]
  API <--> PG[(Postgres: transitvault)]
  API -->|reach-out email| M[SMTP / mailer]
  API -->|Checkout session, refund| S[Stripe]
  S -->|webhook: checkout.session.*| API
  B -->|card payment| S
```

## Flow

```mermaid
sequenceDiagram
  autonumber
  actor P as Poster (family)
  actor H as Helper (same flight)
  participant API
  P->>API: POST /needs {who, languages, assistance, legs}
  Note over API: legs → origin, destination, layovers, flight numbers, travel date
  H->>API: GET /needs (open, upcoming, signed-in only)
  H->>API: POST /needs/:id/reach-out {message, myFlightNumbers}
  API-->>P: email "Ravi can help with DEL → ORD"
  P->>API: GET /conversations, POST /conversations/:id/messages
  H->>API: GET /conversations/:id/messages (web polls every 10 s)
  P->>API: PATCH /needs/:id {status: "found"}
```

## Paid help (optional)

```mermaid
sequenceDiagram
  autonumber
  actor P as Poster
  actor H as Helper
  participant API
  participant S as Stripe
  H->>API: POST /needs/:id/reach-out {declineReward?}
  P->>API: POST /conversations/:id/accept
  Note over API: $10 fee − poster's credit; credit covers it → confirmed, skip Stripe
  API->>S: create Checkout Session (remainder)
  API-->>P: checkoutUrl
  P->>S: pays by card
  S->>API: POST /stripe/webhook checkout.session.completed (signed)
  API-->>P: email "helper confirmed"
  API-->>H: email "you were accepted"
  Note over API: hourly sweep, last leg lands + 4 h
  API-->>P: email "Did H help?" Yes / No (single-use link)
  alt Yes, or no answer in 48 h
    API->>API: +$5 credit to H (unless helping for free)
  else No, didn't show
    API->>API: +$10 credit to P, strike on H
    Note over API,S: card refund only on request (ops route)
  end
```

## Data model

`users` (name, email, phone, `strike_count`; one kind of account) · `needs` (traveller label/age/languages, assistance, `legs` jsonb + derived `origin`, `destination`, `layovers[]`, `flight_numbers[]`, `travel_date`, status `open|found|closed`) · `conversations` (one per need + helper, helper's flight numbers, `reward_declined`) · `helper_acceptances` (one live per need: fee split, Stripe ids, landing/feedback times, outcome, refund) · `credit_entries` (credit ledger, balance = sum) · `messages` · `sessions`, `password_reset_tokens`.

## Privacy

- The board is signed-in only: a need describes an elderly person travelling alone.
- The API never returns phones or emails to other users. The board shows the poster's first name only, and the UI tells people not to post full names or passport details.
- Conversations are visible only to their two parties (404 for anyone else). A closed need is visible only to its owner.

## Phase 2

- **Filters** on the board: from, to, via (layover), date ±1 day, flight number, language. The indexes are already in place: GIN on `flight_numbers` and `layovers`, btree on `(origin, destination, travel_date)`.
- **Helper posts**: "I'm flying DEL → ORD on 1 Dec, happy to help", the mirror image of a need.
- Later, only if wanted: reporting/blocking, verified profiles, live journey updates.
