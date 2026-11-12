# TransitVault API contract

Source of truth between `api/` and `web/`. Change this file first, then the code.

Phase 1 is a **needs board**. Someone posts a need ("my mom is flying Delhi → Chicago alone, connecting in Frankfurt, needs a companion") with the flight details. Other signed-in users browse the needs, and anyone on a matching flight reaches out with a message, which opens a private conversation. No uploads, no verification. Money appears only in the optional [paid help](#paid-help) step (off unless configured).

- Base URL: `https://api.transitvault.3pandalabs.com` (dev `http://localhost:8080`). No `/api` prefix.
- JSON everywhere. Errors: `{ "error": "<message or code>", "code"?: "<DOMAIN_CODE>" }`.
- Auth: `Authorization: Bearer <accessToken>` (15-min JWT). Refresh tokens are opaque `<sessionId>.<secret>` and rotate on use.
- Airports are IATA codes (`^[A-Z]{3}$`). Flight numbers are normalised to `^[A-Z0-9]{2}[0-9]{1,4}[A-Z]?$` (e.g. `AI127`, `LH755`).
- Everything except `/health`, `/metrics`, `/auth/*`, `/public/*`, `/payments/config`, `/feedback`, `/contact`, `/stripe/webhook`, `/go/assist/*` and `/ops/*` needs a signed-in user. Needs are never public: a need describes an elderly person travelling alone.
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

### Account deletion

Self-service in the web app (Profile → "Delete account", also linked from `/support`). Same shape as BorrowVault's.

| Method | Path | Body | Result |
|---|---|---|---|
| GET | `/me/deletion` | — | `{ canDelete: boolean, blockers: DeletionBlocker[], creditCents: number }`. A preflight so the web can show what blocks deletion and how much credit would be forfeited. Same checks as the delete itself. |
| POST | `/me/delete` | `{ password }` | **204**. The current password confirms it: wrong → 403 `wrong_password`. 409 `{ error: "paid_help_in_progress", code: "CONFLICT", blockers: DeletionBlocker[] }` while any blocker exists. 5 per 15 min per user. The web signs out afterwards (the refresh token is already dead). |

`DeletionBlocker = { kind: "pending_payment"|"trip_unresolved", role: "poster"|"helper", conversationId, needId, origin, destination, travelDate }`: a paid-help acceptance where the caller is the poster or the accepted helper, and it is either `pending_payment` (checkout open) or `confirmed` with no outcome yet (no "did they help?" answer and the 48 h default hasn't run). Wait until the trip is resolved, or contact support.

What deletion does, in **one transaction** (blockers are re-checked after locking the user row; `acceptHelper` locks the helper's row too, so an acceptance can't slip in between):

- **Posts close**: every `open`/`found` need → `closed`, every open "I'm flying" post → `closed`. They leave the boards, matches, alerts, the public preview and every nudge.
- **Deleted outright**: sessions (refresh tokens), password-reset tokens, and block rows on either side.
- **The user row is anonymised** (kept, because conversations, messages, acceptances and the credit ledger point at it): `name` → `"Deleted user"`, `email` → `deleted+<userId>@transitvault.invalid` (unique; `.invalid` is a reserved TLD, so it can never route), `phone` → `""`, password hash → an unusable value, `alertsEnabled` → false, `deleted_at` → now.
- **Credit is forfeited**: if the balance isn't 0, one `account_deleted` ledger entry brings it to 0.
- **Kept**: conversations and messages (the other person's history; the deleted side shows as "Deleted user"), the (closed) needs and flight posts, reports, `helper_acceptances` and `credit_entries` (payment records kept for tax/accounting, now linked only to the anonymised row).

Afterwards: login with the old email → 401 `invalid_credentials`, refresh → 401, a password reset sends nothing, and the address can sign up again as a brand-new account. Access tokens already issued are refused at once by this API process (any authed route → 401 `account_deleted`) and expire within 15 minutes regardless. No email is ever sent to a deleted account: every sender skips `deleted_at` users, and `sendMail` drops any `@transitvault.invalid` address as a last guard.

**Talking to a deleted account.** `ConversationSummary.otherParty` gains `deleted: boolean` (its `firstName` is `"Deleted user"`). The history stays readable; sending a message, thanking or accepting them answers 409 `other_party_deleted`.

## Needs

| Method | Path | Body | Result |
|---|---|---|---|
| GET | `/needs` | query: [board filters](#board-filters) | `NeedSummary[]`: open needs from yesterday onwards, soonest travel date first (max 200) |
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

`NeedSummary = { id, travelerLabel, travelerAge, languages, travelDate, origin, destination, layovers, flightNumbers, legs, status, postedBy: { id, firstName, thanksCount }, mine: boolean, hidden: boolean, responseCount (0 unless mine), myConversationId: string|null, acceptedHelper: { conversationId, status: "pending_payment"|"confirmed", firstName } | null (owner only, see [paid help](#paid-help)), createdAt }`. `myConversationId` is the caller's conversation about this need if they have reached out (always null for the owner); the board shows a "You responded" marker from it.

`Need = NeedSummary & { assistance, notes, airportHelp: AirportHelp }` (see [airport assistance](#airport-assistance)).

Need `status`: `open` (shown on the board) → `found` (the poster found a companion) or `closed` (no longer needed). The owner can reopen, except once a paid helper is confirmed (409 `helper_confirmed`; editing `legs` is then 409 `helper_confirmed_legs_locked`). Only `open`, non-hidden needs from people you haven't blocked (or who haven't blocked you) appear in `GET /needs` and accept new messages to reach out.

## Reaching out (conversations)

| Method | Path | Body | Result |
|---|---|---|---|
| POST | `/needs/:id/reach-out` | `{ message (1–2000), myFlightNumbers?: string[] (≤ 4), declineReward?: boolean }` | 201 `Conversation`. Re-sending returns the existing conversation (200) with the message appended. 409 `own_need`, 409 `need_not_open`. |
| GET | `/conversations` | — | `ConversationSummary[]`, most recent message first |
| GET | `/conversations/:id` | — | `Conversation` |
| GET | `/conversations/:id/messages` | — | `Message[]`, oldest first (last 500) |
| POST | `/conversations/:id/messages` | `{ body (1–2000) }` | 201 `Message` |

One conversation per (need, helper). The poster gets an email when someone reaches out (fail-soft, never blocks the request).

`ConversationSummary = { id, need: { id, travelerLabel, origin, destination, travelDate, flightNumbers, status }, role: "poster"|"helper", otherParty: { id, firstName, thanksCount, deleted }, lastMessage: { body, at, mine } | null, helperFlightNumbers, thankedAt: string|null, thankNote: string|null, blocked: boolean, rewardDeclined: boolean, acceptance: Acceptance | null, needHasHelper: boolean, createdAt }`

`Conversation = ConversationSummary`. Phone numbers and emails are never sent: people share contact details in the conversation when they choose to. `blocked` is true when either party has blocked the other; sending is then refused.

`Message = { id, body, createdAt, mine }`

| Method | Path | Body | Result |
|---|---|---|---|
| POST | `/conversations/:id/thanks` | `{ note? (≤ 500) }` | `Conversation`. Poster only, once per conversation (409 `already_thanked`). The helper gets an email. |

`thanksCount` is how many families have thanked that person. It's shown next to their first name wherever they appear.

## Paid help

Optional and **off by default**: it's on only when `PAYMENTS_ENABLED=true` **and** `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are set. Off, `accept` answers 409 `payments_disabled`, the webhook 503, and the web hides every paid-help control, so the board is exactly the free flow above. Posting and reaching out are always free.

1. **Accept.** In a conversation the poster accepts that helper. One live (pending or confirmed) helper per need. Fee: **$10 per trip**. The poster's own TransitVault credit is applied first (partial allowed) and the rest is charged by card through **Stripe Checkout** (hosted page, 30-minute expiry). If credit covers it all, Stripe is skipped and the helper is confirmed at once.
2. **Confirm.** Stripe's `checkout.session.completed` webhook (signature-verified) confirms the acceptance. The need becomes `found` and both sides get an email. `checkout.session.expired`, or a pending acceptance older than 2 h (hourly sweep), cancels it and gives back any credit it used.
3. **Did they help?** The hourly sweep emails the poster 4 h after the last leg's real landing time: "Did <helper> help?" with Yes / No links to `/feedback?token=…&answer=…` on the web (signed, single-use, sha256-hashed at rest; the page records nothing until a button is pressed, so link scanners can't answer). The poster can also answer in the conversation once that time has passed.
   - **Yes, or no answer within 48 h of the email**: the helper gets **$5 TransitVault credit**, unless they chose "I'm helping for free".
   - **No (didn't show)**: the full $10 fee comes back to the poster as **TransitVault credit**, not a card refund (Stripe keeps its fee on refunds). No helper credit, and the helper's `strike_count` goes up by one. A card refund of the cash part is **ops-only, on request** (`POST /ops/acceptances/:id/card-refund`): it takes that amount back out of the poster's credit (`card_refund`, once per acceptance, so it can't be refunded twice) and refunds the card via Stripe. Refused if the poster has already spent the credit.

**Credit** is a ledger (`credit_entries`: user, signed amount in cents, reason, need, acceptance); the balance is the sum. It isn't cash and can't be withdrawn: it only comes off the user's own future fees. Reasons: `helper_reward` (+500), `fee_applied` (−credit used), `fee_restored` (+credit used, cancelled checkout), `no_show_refund` (+1000), `card_refund` (−cash part, ops refund). Each happens at most once per acceptance. `account_deleted` (−balance, no acceptance) zeroes the balance when the user deletes their account ([Account deletion](#account-deletion)).

**Landing time.** Leg times are airport-local wall-clock without an offset (see Needs). For this one purpose the last leg's `arrivesAt` is read in the arrival airport's IANA zone, from a built-in table of common airports (`lib/landing.ts`, DST-aware). An airport not in the table falls back to the latest possible real instant (wall-clock read as UTC−12), so we never ask before landing; the ask is then at most ~26 h late. Stored legs are never converted.

**Copy.** Wherever money shows, the web says the helper is a fellow traveller thanked with credit, not a hired escort or service, and that TransitVault doesn't provide assistance services.

| Method | Path | Auth | Body | Result |
|---|---|---|---|---|
| GET | `/payments/config` | — | — | `{ enabled, feeCents: 1000, rewardCents: 500, currency: "usd" }` |
| GET | `/me/credits` | user | — | `{ balanceCents, entries: { id, amountCents, reason, needId, createdAt }[] }` (last 50) |
| POST | `/conversations/:id/accept` | poster | — | `{ checkoutUrl: string\|null, conversation: Conversation }`. Redirect to `checkoutUrl` when set. Accepting again while that checkout is open returns the same URL. 409 `payments_disabled`, `need_not_open` (closed), `helper_already_confirmed`, `acceptance_pending` (another helper's checkout is open); 403 `blocked`; 503 `payment_unavailable` (Stripe failed: nothing charged, credit restored). |
| PUT | `/conversations/:id/reward` | helper | `{ declined: boolean }` | `Conversation`. "I'm helping for free". 409 `reward_released` once the trip is resolved. |
| POST | `/conversations/:id/outcome` | poster | `{ helped: boolean }` | `Conversation`. 409 `not_accepted`, `too_early` (before landing + 4 h), `already_answered`. |
| GET | `/feedback?token=` | token | — | `{ helperFirstName, travelerLabel, origin, destination, travelDate, outcome, conversationId }`; 404 `invalid_or_expired_token`. |
| POST | `/feedback` | token | `{ token, helped: boolean }` | Same shape; 409 `already_answered`. |
| POST | `/stripe/webhook` | Stripe signature | raw Stripe event | `{ received: true, result }`. 400 `invalid_signature`; 503 when `STRIPE_WEBHOOK_SECRET` is unset. Handles `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `checkout.session.expired`; other events are ignored. Replays are no-ops. |
| POST | `/ops/acceptances/:id/card-refund` | `Bearer OPS_TOKEN` | — | `{ id, refundedCents, stripeRefundId, refundedAt }`. 409 `not_a_no_show`, `nothing_paid_by_card`, `already_refunded`, `credit_already_spent`; 503 `ops_disabled` (no `OPS_TOKEN`) or `refund_failed` (credit put back). |

`Acceptance = { id, status: "pending_payment"|"confirmed", feeCents, creditAppliedCents, cashCents, checkoutUrl (poster, while pending), confirmedAt, landsAt, feedbackDueAt, canAnswer (poster), outcome: "helped"|"no_show"|null, outcomeAt, rewardDeclined, rewardReleasedAt, rewardCreditedCents, refundedAt }`. The payment fields (`creditAppliedCents`, `cashCents`, `checkoutUrl`, `refundedAt`) are null for the helper.

## Sharing a need (public preview)

| Method | Path | Auth | Result |
|---|---|---|---|
| GET | `/public/needs/:id` | — | `PublicNeed`, or 404 if the need isn't open or is hidden. 120/min per IP. |

`PublicNeed = { id, travelerLabel, languages, travelDate, origin, destination, layovers, flightNumbers, legs, airportHelp: AirportHelp }`. Deliberately excludes age, assistance, notes and the poster's name (`airportHelp` is derived from the route and flight numbers only). The web page `/n/:id` renders it with Open Graph tags (for WhatsApp previews), `noindex`, and a "Sign up to reach out" button. The poster shares it with a WhatsApp button whose text the web builds: *"Is anyone on LH761 + LH430, Delhi → Chicago on 1 Dec? My mother is flying alone and could use a companion. <link>"*.

## "I'm flying" posts (flights)

A traveller posts their own flight once and offers to help. The matching works in both directions.

| Method | Path | Body | Result |
|---|---|---|---|
| GET | `/flights` | query: [board filters](#board-filters) | `FlightSummary[]`: open flight posts from yesterday onwards, soonest first (max 200) |
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

Two hourly, email-only nudges to the poster. Each goes out at most once per need, and a need gets at most one of them.

- **"Sorry, no one offered to help"** (`needs.no_helper_emailed_at`), on the travel day: about **6 hours before the first leg departs**, if the need is still `open`, not hidden, and has **zero conversations** (nobody reached out). Short and kind: sorry no one on these flights offered this time, ask the airline for wheelchair / meet-and-assist service (free on most airlines, book it with the airline at least 48 h ahead), keep the itinerary and a phone number in the traveller's bag, and post again for the next trip. Below it, the [airport assistance](#airport-assistance) block (airline line + official paid services on the route). No mention of TransitVault's paid help. The need's status doesn't change. It's sent only while the plane is still on the ground (from 6 h before departure until departure), and not for a need posted less than 6 h before departure (it never had a fair chance; it gets the day-after nudge instead).
  **Departure time.** The first leg's `departsAt` is read in the origin airport's IANA zone with the same table as the [landing time](#paid-help) (`lib/landing.ts`). An airport not in the table falls back to the **earliest** possible real instant (wall-clock read as UTC+14), so the email is never sent after departure; it then arrives up to ~26 h early in the worst case. Stored legs are never converted.
- **"Did you find a companion? Mark it found or close it"** (`needs.nudged_at`), the day after the travel date, for a need still `open`. Skipped for a need that already got the "sorry" email, so a need with nobody reaching out gets one email, not two. A need where people did reach out but the poster never accepted anyone or marked it found gets this one.

## Contact

| Method | Path | Auth | Body | Result |
|---|---|---|---|---|
| POST | `/contact` | — (a bearer token, if sent, adds the user id to the email) | `{ name (1–120), email, topic: "general"\|"safety"\|"payments"\|"delete_data"\|"other", message (1–4000), website? }` | 204; 429 `rate_limited`; 503 `mailer_unavailable` |

The web's `/contact` form. Relays the message to `OPS_EMAIL` (default `support@3pandalabs.com`) through the normal mailer, with **Reply-To = the sender's email**, so ops answers straight from the inbox. Nothing is stored: the email is the record.

- `website` is a honeypot (hidden on the form). When it's non-empty the API answers 204 and sends nothing.
- Unlike every other send, a failure here is **not** silent: if the mailer is off or the send failed, the API answers 503 `mailer_unavailable` and the web shows the support address to write to directly.
- 5 per hour per IP (`lib/clientKey.ts`) and 40 per hour across all callers (caps a flood of the one inbox).

## Airport assistance

Families are pointed to **official paid meet-and-assist services** (run or authorised by the airport: the provider handles staff, permits and liability) and always to the airline's **free** wheelchair / special-assistance service. TransitVault doesn't operate, sell or vouch for these services; the web and emails say so. No affiliate deal exists yet: clicks go through a redirect so referral volume can be shown to providers, and a referral parameter can be switched on per provider later.

**Data.** A checked-in table keyed by IATA code (`api/src/data/airportAssistance.ts`; research and sources in `infra/airport-assistance-research.md`): `{ iata, airport, provider, operator, authority, url, covers: ("departure"|"arrival"|"transit")[], priceNote, affiliateParam, lastChecked }`. Only verified entries. `affiliateParam` is empty until a deal is signed.

**Selection** (`lib/assist.ts`): the route's airports in order (origin, layovers, destination, each once). An airport is listed only if its entry covers what the traveller does there: **departure** at the origin, **transit** at a layover, **arrival** at the destination.

```
AirportHelp = {
  airports: { iata, role: "origin"|"layover"|"destination", airport, provider, operator, authority, covers, priceNote,
              bookPath: "/go/assist/<IATA>?need=<needId>" }[],   // path on the API host
  airlines: { code, name: string|null }[]                         // from the flight numbers' 2-char prefix
}
```

| Method | Path | Auth | Result |
|---|---|---|---|
| GET | `/go/assist/:iata?need=<id>` | — (a token, if sent, records the user id) | Logs one `assist_clicks` row (`iata`, `provider`, `need_id` if it's a real need, `user_id` if signed in and not a deleted account; nothing else), then **302** to the entry's `url` with `affiliateParam` appended when set. 404 for an airport without an entry. A malformed or unknown `need` is dropped, not an error. Logging is fail-soft: the redirect always happens. `cache-control: no-store`. |

**Where it shows.** Web: the need page (owner inside the "Before the flight" checklist, helpers as a panel), the poster's checklist in a conversation, and the public preview `/n/:id`. Email: the travel-day "sorry, no one offered to help" mail and the poster's "helper confirmed" mail. Each lists "Book official airport assistance at <Airport>: <Provider> (paid, <authority>)" per airport with an entry, and always "Ask <airline> for free wheelchair / special assistance, at least 48 hours before the flight". Email links are absolute on `PUBLIC_API_URL`.

**Metrics.** `GET /metrics` `counts` gains `assistClicks` (all time) and `assistClicksLast30d`.

## Rate limits

`POST /conversations/:id/accept` 20/hour per user. `/feedback` and `/ops/*` 30/min per IP. `POST /contact` 5/hour per IP + 40/hour global. `POST /me/delete` 5 per 15 min per user. `GET /go/assist/:iata` 60/min per IP.

Auth routes as BorrowVault (per IP + per email + global ceiling). `POST /needs` and `POST /flights` 20/hour per user. `POST /needs/:id/reach-out` and `POST /flights/:id/contact` 30/hour per user. Messages 120/hour per user. Reports 20/hour per user. `GET /public/needs/:id` 120/min per IP.

## Board filters

`GET /needs` and `GET /flights` take optional query parameters. They combine with AND, and blank values are ignored.

| Param | Matches |
|---|---|
| `from` | IATA code, the trip origin |
| `to` | IATA code, the final destination |
| `via` | IATA code, one of the layover airports |
| `date` | `YYYY-MM-DD`, the travel date (first leg local departure) |
| `flight` | a flight number on any leg, normalized like legs (`ai 0101` → `AI101`) |
| `language` | one of the listed languages, case-insensitive |

A malformed value (bad IATA code, date or flight number) is 400. The web boards keep the filters in the URL so a filtered board can be shared.
