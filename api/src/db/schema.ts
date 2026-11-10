import { sql } from "drizzle-orm";
import { boolean, char, check, date, index, jsonb, pgEnum, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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
