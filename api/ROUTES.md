# TransitVault API contract

Source of truth between `api/` and `web/`. Change this file first, then the code.

Phase 1 is a **needs board**. Someone posts a need ("my mom is flying Delhi → Chicago alone, connecting in Frankfurt, needs a companion") with the flight details. Other signed-in users browse the needs, and anyone on a matching flight reaches out with a message, which opens a private conversation. No money, no uploads, no verification.

- Base URL: `https://api.transitvault.3pandalabs.com` (dev `http://localhost:8080`). No `/api` prefix.
- JSON everywhere. Errors: `{ "error": "<message or code>", "code"?: "<DOMAIN_CODE>" }`.
- Auth: `Authorization: Bearer <accessToken>` (15-min JWT). Refresh tokens are opaque `<sessionId>.<secret>` and rotate on use.
- Airports are IATA codes (`^[A-Z]{3}$`). Flight numbers are normalised to `^[A-Z0-9]{2}[0-9]{1,4}[A-Z]?$` (e.g. `AI127`, `LH755`).
- Everything except `/health`, `/metrics` and `/auth/*` needs a signed-in user. Needs are never public: a need describes an elderly person travelling alone.
- 404 (not 403) for a conversation the caller is not part of.

## Health and ops

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | — | `{ ok: true, commit, startedAt }` |
| GET | `/metrics` | `Bearer METRICS_TOKEN` | Shared org envelope. 503 when `METRICS_TOKEN` is unset. |

## Auth

| Method | Path | Body | Result |
|---|---|---|---|
| POST | `/auth/signup` | `{ email, password(≥10), name, phone }` | 201 `AuthResponse`; 409 `registration_failed` |
| POST | `/auth/login` | `{ email, password }` | `AuthResponse`; 401 `invalid_credentials` |
| POST | `/auth/refresh` | `{ refreshToken }` | `AuthResponse` (rotated) |
| POST | `/auth/logout` | `{ refreshToken }` | 204 |
| POST | `/auth/password-reset/request` | `{ email }` | 204 always |
| POST | `/auth/password-reset/confirm` | `{ token, password }` | 204; 400 `invalid_or_expired_token` |

`AuthResponse = { accessToken, refreshToken, user: User }`

`User = { id, email, name, phone, createdAt }`. One kind of account: anyone can post a need and anyone can reach out.

## Me

| Method | Path | Body | Result |
|---|---|---|---|
| GET | `/me` | — | `{ user: User }` |
| PATCH | `/me` | `{ name?, phone? }` | `{ user: User }` |

## Needs

| Method | Path | Body | Result |
|---|---|---|---|
| GET | `/needs` | — | `NeedSummary[]`: open needs from yesterday onwards, soonest travel date first (max 200) |
| GET | `/needs/mine` | — | `NeedSummary[]`: the caller's needs, any status |
| POST | `/needs` | `NeedInput` | 201 `Need` |
| GET | `/needs/:id` | — | `Need` (any signed-in user; a closed need only for its owner) |
| PATCH | `/needs/:id` | `Partial<NeedInput> & { status?: "open"\|"found"\|"closed" }` | `Need` (owner only) |

`NeedInput`:

```
{
  travelerLabel: string (1–80)        // "My mother", "Dad (72)". No full names needed.
  travelerAge?: number (1–120)
  languages: string[] (1–8)           // what the traveller speaks, e.g. ["Hindi", "Punjabi"]
  assistance?: string (≤ 1000)        // "Needs wheelchair at Frankfurt, help with immigration forms"
  legs: Leg[] (1–4)                   // one leg = direct; more = connecting, layovers derived
  notes?: string (≤ 2000)
}
```

`Leg = { flightNumber, from, to, departsAt, arrivesAt }`. Times are the **airport-local wall-clock** printed on the ticket, encoded `YYYY-MM-DDTHH:mm:00Z` where the `Z` does not mean UTC. Never convert them by timezone. Legs must be contiguous (`legs[n].to = legs[n+1].from`). A leg may "arrive before it departs" (westbound across the date line), so only a span outside (−24 h, +36 h] is rejected. The server derives `origin`, `destination`, `layovers`, `flightNumbers` and `travelDate` (the first leg's local departure date).

`NeedSummary = { id, travelerLabel, travelerAge, languages, travelDate, origin, destination, layovers, flightNumbers, legs, status, postedBy: { firstName }, mine: boolean, responseCount (0 unless mine), createdAt }`

`Need = NeedSummary & { assistance, notes, myConversationId: string|null }`. `myConversationId` is the caller's conversation about this need if they have reached out (always null for the owner).

Need `status`: `open` (shown on the board) → `found` (the poster found a companion) or `closed` (no longer needed). The owner can reopen. Only `open` needs appear in `GET /needs` and accept new messages to reach out.

## Reaching out (conversations)

| Method | Path | Body | Result |
|---|---|---|---|
| POST | `/needs/:id/reach-out` | `{ message (1–2000), myFlightNumbers?: string[] (≤ 4) }` | 201 `Conversation`. Re-sending returns the existing conversation (200) with the message appended. 409 `own_need`, 409 `need_not_open`. |
| GET | `/conversations` | — | `ConversationSummary[]`, most recent message first |
| GET | `/conversations/:id` | — | `Conversation` |
| GET | `/conversations/:id/messages` | — | `Message[]`, oldest first (last 500) |
| POST | `/conversations/:id/messages` | `{ body (1–2000) }` | 201 `Message` |

One conversation per (need, helper). The poster gets an email when someone reaches out (fail-soft, never blocks the request).

`ConversationSummary = { id, need: { id, travelerLabel, origin, destination, travelDate, flightNumbers, status }, role: "poster"|"helper", otherParty: { firstName }, lastMessage: { body, at, mine } | null, helperFlightNumbers, createdAt }`

`Conversation = ConversationSummary & { otherParty: { firstName } }`. Phone numbers and emails are never sent: people share contact details in the conversation when they choose to.

`Message = { id, body, createdAt, mine }`

## Rate limits

Auth routes as BorrowVault (per IP + per email + global ceiling). `POST /needs` 20/hour per user. `POST /needs/:id/reach-out` 30/hour per user. Messages 120/hour per user.

## Phase 2 (not built)

Filters on `GET /needs`: `from`, `to`, `via` (layover), `date` (±1 day), `flight`, `language`. The `trips`-style GIN indexes on `flight_numbers` and `layovers` and the btree on `(origin, destination, travel_date)` are already in place for them.
