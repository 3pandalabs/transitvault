import { sql } from "drizzle-orm";
import { boolean, char, check, date, index, integer, jsonb, pgEnum, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

// TransitVault Phase 1: a needs board (api/ROUTES.md). Someone posts a need
// for a parent flying alone; someone on a matching flight reaches out, which
// opens a private conversation. Postgres 17 on the shared 3pandalabs-postgres,
// owned by `transitvault_app`.

const ts = (n: string) => timestamp(n, { withTimezone: true });

/** Times are airport-local wall-clock encoded with `Z` (see lib/legs.ts). */
export type Leg = { flightNumber: string; from: string; to: string; departsAt: string; arrivesAt: string };

export const needStatus = pgEnum("need_status", ["open", "found", "closed"]);
export const flightStatus = pgEnum("flight_status", ["open", "closed"]);
export const reportTarget = pgEnum("report_target", ["need", "flight", "user"]);
export const reportReason = pgEnum("report_reason", ["spam", "inappropriate", "scam", "other"]);
export const acceptanceStatus = pgEnum("acceptance_status", ["pending_payment", "confirmed", "cancelled"]);
export const acceptanceOutcome = pgEnum("acceptance_outcome", ["helped", "no_show"]);
export const creditReason = pgEnum("credit_reason", ["helper_reward", "fee_applied", "fee_restored", "no_show_refund", "card_refund"]);

// ---------------------------------------------------------------------------
// Users & auth
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  // Match alert emails (api/ROUTES.md "Alerts"). Reach-out and nudge mails
  // are about the user's own posts and always go out.
  alertsEnabled: boolean("alerts_enabled").notNull().default(true),
  // Paid help: times a poster answered "No, they didn't show" about this user
  // as their accepted helper (api/ROUTES.md "Paid help").
  strikeCount: integer("strike_count").notNull().default(0),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    refreshTokenHash: text("refresh_token_hash").notNull(),
    expiresAt: ts("expires_at").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("sessions_user").on(t.userId)],
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("password_reset_tokens_user").on(t.userId)],
);

// ---------------------------------------------------------------------------
// Needs: "my mom is flying DEL → FRA → ORD alone, need a companion"
// ---------------------------------------------------------------------------

export const needs = pgTable(
  "needs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    travelerLabel: text("traveler_label").notNull(),
    travelerAge: smallint("traveler_age"),
    languages: text("languages").array().notNull(),
    assistance: text("assistance"),
    notes: text("notes"),
    // Legs (with times) are the source; the flat columns are derived from them
    // (lib/legs.ts) and indexed for the Phase 2 filters.
    legs: jsonb("legs").$type<Leg[]>().notNull(),
    travelDate: date("travel_date").notNull(),
    origin: char("origin", { length: 3 }).notNull(),
    destination: char("destination", { length: 3 }).notNull(),
    layovers: text("layovers").array().notNull().default(sql`'{}'::text[]`),
    flightNumbers: text("flight_numbers").array().notNull(),
    status: needStatus("status").notNull().default("open"),
    // Set when 3 different people report it (api/ROUTES.md "Safety").
    hiddenAt: ts("hidden_at"),
    // "Did you find a companion?" sent the day after travel.
    nudgedAt: ts("nudged_at"),
    // "Sorry, no one offered to help" sent ~6 h before departure (zero conversations).
    noHelperEmailedAt: ts("no_helper_emailed_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("needs_user").on(t.userId),
    index("needs_status_date").on(t.status, t.travelDate),
    index("needs_route_date").on(t.origin, t.destination, t.travelDate),
    index("needs_flight_numbers").using("gin", t.flightNumbers),
    index("needs_layovers").using("gin", t.layovers),
    check("needs_languages_nonempty", sql`cardinality(${t.languages}) >= 1`),
  ],
);

// ---------------------------------------------------------------------------
// Conversations: one per (need, helper), opened by reaching out
// ---------------------------------------------------------------------------

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    needId: uuid("need_id")
      .notNull()
      .references(() => needs.id),
    // The need's poster is needs.user_id; the helper is whoever reached out.
    helperId: uuid("helper_id")
      .notNull()
      .references(() => users.id),
    helperFlightNumbers: text("helper_flight_numbers").array().notNull().default(sql`'{}'::text[]`),
    lastMessageAt: ts("last_message_at").notNull().defaultNow(),
    // The poster's thank-you, once (POST /conversations/:id/thanks).
    thankedAt: ts("thanked_at"),
    thankNote: text("thank_note"),
    // Paid help: the helper is "helping for free" and wants no thank-you
    // credit. Changeable until the reward is released.
    rewardDeclined: boolean("reward_declined").notNull().default(false),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("conversations_need_helper").on(t.needId, t.helperId), index("conversations_helper").on(t.helperId)],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("messages_conversation").on(t.conversationId, t.createdAt),
    check("messages_body_len", sql`char_length(${t.body}) between 1 and 2000`),
  ],
);

// ---------------------------------------------------------------------------
// "I'm flying" posts: a traveller offers to help on their own flight
// ---------------------------------------------------------------------------

export const flightPosts = pgTable(
  "flight_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    languages: text("languages").array().notNull(),
    note: text("note"),
    legs: jsonb("legs").$type<Leg[]>().notNull(),
    travelDate: date("travel_date").notNull(),
    origin: char("origin", { length: 3 }).notNull(),
    destination: char("destination", { length: 3 }).notNull(),
    layovers: text("layovers").array().notNull().default(sql`'{}'::text[]`),
    flightNumbers: text("flight_numbers").array().notNull(),
    status: flightStatus("status").notNull().default("open"),
    hiddenAt: ts("hidden_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("flight_posts_user").on(t.userId),
    index("flight_posts_status_date").on(t.status, t.travelDate),
    index("flight_posts_route_date").on(t.origin, t.destination, t.travelDate),
    index("flight_posts_flight_numbers").using("gin", t.flightNumbers),
    check("flight_posts_languages_nonempty", sql`cardinality(${t.languages}) >= 1`),
  ],
);

// One alert email per (need, flight post) pair, ever.
export const matchAlerts = pgTable(
  "match_alerts",
  {
    needId: uuid("need_id")
      .notNull()
      .references(() => needs.id),
    flightPostId: uuid("flight_post_id")
      .notNull()
      .references(() => flightPosts.id),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ name: "match_alerts_pk", columns: [t.needId, t.flightPostId] })],
);

// ---------------------------------------------------------------------------
// Safety: blocks and reports
// ---------------------------------------------------------------------------

export const userBlocks = pgTable(
  "user_blocks",
  {
    blockerId: uuid("blocker_id")
      .notNull()
      .references(() => users.id),
    blockedId: uuid("blocked_id")
      .notNull()
      .references(() => users.id),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: "user_blocks_pk", columns: [t.blockerId, t.blockedId] }),
    index("user_blocks_blocked").on(t.blockedId),
    check("user_blocks_distinct", sql`${t.blockerId} <> ${t.blockedId}`),
  ],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id),
    targetType: reportTarget("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    reason: reportReason("reason").notNull(),
    note: text("note"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("reports_once").on(t.reporterId, t.targetType, t.targetId),
    index("reports_target").on(t.targetType, t.targetId),
  ],
);

// ---------------------------------------------------------------------------
// Paid help (api/ROUTES.md "Paid help"). The poster accepts one helper per
// need and pays a $10 fee (card via Stripe Checkout, minus their own credit).
// After the trip the helper gets a $5 thank-you credit, unless they declined
// it or the poster reports a no-show (then the fee is refunded).
// ---------------------------------------------------------------------------

export const helperAcceptances = pgTable(
  "helper_acceptances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    needId: uuid("need_id")
      .notNull()
      .references(() => needs.id),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id),
    posterId: uuid("poster_id")
      .notNull()
      .references(() => users.id),
    helperId: uuid("helper_id")
      .notNull()
      .references(() => users.id),
    status: acceptanceStatus("status").notNull().default("pending_payment"),
    // fee = credit applied + cash charged by card.
    feeCents: integer("fee_cents").notNull(),
    creditAppliedCents: integer("credit_applied_cents").notNull().default(0),
    cashCents: integer("cash_cents").notNull(),
    stripeSessionId: text("stripe_session_id"),
    checkoutUrl: text("checkout_url"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    paidAt: ts("paid_at"),
    confirmedAt: ts("confirmed_at"),
    // Estimated real (UTC) landing of the last leg, and when to ask the
    // poster "did they help?" (lib/landing.ts).
    landsAt: ts("lands_at"),
    feedbackDueAt: ts("feedback_due_at"),
    feedbackSentAt: ts("feedback_sent_at"),
    // sha256 of the single-use secret in the emailed Yes/No links.
    feedbackTokenHash: text("feedback_token_hash"),
    outcome: acceptanceOutcome("outcome"),
    outcomeSource: text("outcome_source"), // "poster" | "timeout"
    outcomeAt: ts("outcome_at"),
    rewardReleasedAt: ts("reward_released_at"),
    refundedAt: ts("refunded_at"),
    stripeRefundId: text("stripe_refund_id"),
    refundError: text("refund_error"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    // v1: one live (pending or confirmed) helper per need.
    uniqueIndex("helper_acceptances_one_per_need").on(t.needId).where(sql`status <> 'cancelled'`),
    index("helper_acceptances_conversation").on(t.conversationId),
    index("helper_acceptances_status").on(t.status),
    uniqueIndex("helper_acceptances_session").on(t.stripeSessionId),
    check(
      "helper_acceptances_fee_split",
      sql`${t.creditAppliedCents} >= 0 AND ${t.cashCents} >= 0 AND ${t.creditAppliedCents} + ${t.cashCents} = ${t.feeCents}`,
    ),
  ],
);

/** TransitVault credit ledger: balance = sum(amount_cents). Credit is not cash. */
export const creditEntries = pgTable(
  "credit_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    amountCents: integer("amount_cents").notNull(),
    reason: creditReason("reason").notNull(),
    needId: uuid("need_id").references(() => needs.id),
    acceptanceId: uuid("acceptance_id").references(() => helperAcceptances.id),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("credit_entries_user").on(t.userId, t.createdAt),
    // Each kind of entry at most once per acceptance (idempotent sweeps/webhooks).
    uniqueIndex("credit_entries_once").on(t.acceptanceId, t.reason),
    check("credit_entries_nonzero", sql`${t.amountCents} <> 0`),
  ],
);
