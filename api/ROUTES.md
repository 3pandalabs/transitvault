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

`User = { id, email, name, phone, alertsEnabled, createdAt }`. One kind of account: anyone can post a need and anyone can reach out.

## Me

| Method | Path | Body | Result |
|---|---|---|---|
| GET | `/me` | — | `{ user: User }` |
| PATCH | `/me` | `{ name?, phone?, alertsEnabled? }` | `{ user: User }` |

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

`NeedSummary = { id, travelerLabel, travelerAge, languages, travelDate, origin, destination, layovers, flightNumbers, legs, status, postedBy: { id, firstName, thanksCount }, mine: boolean, hidden: boolean, responseCount (0 unless mine), myConversationId: string|null, createdAt }`. `myConversationId` is the caller's conversation about this need if they have reached out (always null for the owner); the board shows a "You responded" marker from it.

`Need = NeedSummary & { assistance, notes }`.

Need `status`: `open` (shown on the board) → `found` (the poster found a companion) or `closed` (no longer needed). The owner can reopen. Only `open`, non-hidden needs from people you haven't blocked (or who haven't blocked you) appear in `GET /needs` and accept new messages to reach out.

## Reaching out (conversations)

| Method | Path | Body | Result |
|---|---|---|---|
| POST | `/needs/:id/reach-out` | `{ message (1–2000), myFlightNumbers?: string[] (≤ 4) }` | 201 `Conversation`. Re-sending returns the existing conversation (200) with the message appended. 409 `own_need`, 409 `need_not_open`. |
| GET | `/conversations` | — | `ConversationSummary[]`, most recent message first |
| GET | `/conversations/:id` | — | `Conversation` |
| GET | `/conversations/:id/messages` | — | `Message[]`, oldest first (last 500) |
| POST | `/conversations/:id/messages` | `{ body (1–2000) }` | 201 `Message` |

One conversation per (need, helper). The poster gets an email when someone reaches out (fail-soft, never blocks the request).

`ConversationSummary = { id, need: { id, travelerLabel, origin, destination, travelDate, flightNumbers, status }, role: "poster"|"helper", otherParty: { id, firstName, thanksCount }, lastMessage: { body, at, mine } | null, helperFlightNumbers, thankedAt: string|null, thankNote: string|null, blocked: boolean, createdAt }`

`Conversation = ConversationSummary`. Phone numbers and emails are never sent: people share contact details in the conversation when they choose to. `blocked` is true when either party has blocked the other; sending is then refused.

`Message = { id, body, createdAt, mine }`

| Method | Path | Body | Result |
|---|---|---|---|
| POST | `/conversations/:id/thanks` | `{ note? (≤ 500) }` | `Conversation`. Poster only, once per conversation (409 `already_thanked`). The helper gets an email. |

`thanksCount` is how many families have thanked that person. It's shown next to their first name wherever they appear.

## Sharing a need (public preview)

| Method | Path | Auth | Result |
|---|---|---|---|
| GET | `/public/needs/:id` | — | `PublicNeed`, or 404 if the need isn't open or is hidden. 120/min per IP. |

`PublicNeed = { id, travelerLabel, languages, travelDate, origin, destination, layovers, flightNumbers, legs }`. Deliberately excludes age, assistance, notes and the poster's name. The web page `/n/:id` renders it with Open Graph tags (for WhatsApp previews), `noindex`, and a "Sign up to reach out" button. The poster shares it with a WhatsApp button whose text the web builds: *"Is anyone on LH761 + LH430, Delhi → Chicago on 1 Dec? My mother is flying alone and could use a companion. <link>"*.

## "I'm flying" posts (flights)

A traveller posts their own flight once and offers to help. The matching works in both directions.

| Method | Path | Body | Result |
|---|---|---|---|
| GET | `/flights` | — | `FlightSummary[]`: open flight posts from yesterday onwards, soonest first (max 200) |
| GET | `/flights/mine` | — | `FlightSummary[]` |
| POST | `/flights` | `{ legs: Leg[] (1–4), languages: string[] (1–8), note? (≤ 1000) }` | 201 `{ flight: Flight, matches: NeedMatch[] }` |
| GET | `/flights/:id` | — | `Flight` (a closed one only for its owner) |
| PATCH | `/flights/:id` | `{ legs?, languages?, note?, status?: "open"|"closed" }` | `Flight` (owner) |
| GET | `/flights/:id/matches` | — | `NeedMatch[]`: open needs matching this flight (owner) |
| GET | `/needs/:id/matches` | — | `FlightMatch[]`: open flight posts matching this need (owner) |
| POST | `/flights/:id/contact` | `{ needId, message (1–2000) }` | 201/200 `Conversation`. The need's owner messages the flight's poster. This creates (or reuses) the (need, helper) conversation. 409 `own_flight`, `need_not_open`, `flight_not_open`; 403 `blocked`. |

`FlightSummary = { id, travelDate, origin, destination, layovers, flightNumbers, legs, languages, note, status, postedBy: { id, firstName, thanksCount }, mine, createdAt }`. `Flight = FlightSummary`.

`NeedMatch = NeedSummary & { matchReason }`, `FlightMatch = FlightSummary & { matchReason }`.

**Match rule** (`lib/match.ts`): the two share at least one flight number and their travel dates are within ±1 day, **or** they have the same origin and destination on the same travel date. `matchReason` is e.g. `"Same flight LH761"` or `"Same route DEL → ORD on 1 Dec"`.

**Alerts** (email, fail-soft, one per need+flight pair ever, tracked in `match_alerts`):
- A new need → every matching open flight post's owner: "A family needs a companion on your flight".
- A new flight post → every matching open need's poster: "Someone on your flight offered to help".
- Not sent between blocked users, or to users with `alertsEnabled: false`.

## Safety

| Method | Path | Body | Result |
|---|---|---|---|
| POST | `/reports` | `{ targetType: "need"|"flight"|"user", targetId, reason: "spam"|"inappropriate"|"scam"|"other", note? (≤ 1000) }` | 201 `{ ok: true }` (200 if already reported). Emails ops (`OPS_EMAIL`). A need or flight post reported by 3 different people is hidden from the board, the public preview, matches and alerts. Its owner still sees it, with `hidden: true`. |
| GET | `/blocks` | — | `{ userId, firstName }[]` |
| POST | `/users/:id/block` | — | 204. The two can't start conversations or message each other, never see each other's posts on the boards or in matches, and get no alerts about each other. |
| DELETE | `/users/:id/block` | — | 204 |

`NeedSummary` and `FlightSummary` carry `hidden: boolean` (only ever true for the owner). `postedBy` gains `id` and `thanksCount`. `User` gains `alertsEnabled` (`PATCH /me { alertsEnabled }`).

## Nudges

Once an hour the API emails the poster of every need that is still `open` the day after its travel date: "Did you find a companion? Mark it found or close it". Each need gets this at most once (`needs.nudged_at`).

## Rate limits

Auth routes as BorrowVault (per IP + per email + global ceiling). `POST /needs` and `POST /flights` 20/hour per user. `POST /needs/:id/reach-out` and `POST /flights/:id/contact` 30/hour per user. Messages 120/hour per user. Reports 20/hour per user. `GET /public/needs/:id` 120/min per IP.

## Later

Filters on `GET /needs` and `GET /flights`: `from`, `to`, `via`, `date`, `flight`, `language`. The indexes are already in place.
