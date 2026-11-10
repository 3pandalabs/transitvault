import { and, arrayOverlaps, eq, gte, inArray, isNull, lte, ne, notInArray, or, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { conversations, flightPosts, needs, users } from "../db/schema.js";
import { invalid } from "./errors.js";
import { deriveRoute, LegError, type LegInput } from "./legs.js";
import { matchReason } from "./match.js";
import { blockedWith, thanksCounts } from "./social.js";

// Card shapes for needs and "I'm flying" posts (api/ROUTES.md), and the
// matching between them. Both kinds share the same route columns.

export type Need = typeof needs.$inferSelect;
export type FlightPost = typeof flightPosts.$inferSelect;
type Row<T> = { post: T; posterName: string };

export const firstName = (name: string) => name.trim().split(/\s+/)[0];

/** Legs → the stored route columns, with leg errors as 400s. */
export function routeColumns(legs: LegInput[]) {
  try {
    const r = deriveRoute(legs);
    return {
      legs: r.legs,
      origin: r.origin,
      destination: r.destination,
      layovers: r.layovers,
      flightNumbers: r.flightNumbers,
      // Local wall-clock, so the date part is the local departure date.
      travelDate: r.legs[0].departsAt.slice(0, 10),
    };
  } catch (err) {
    if (err instanceof LegError) throw invalid(err.message);
    throw err;
  }
}

const routeFields = (p: Need | FlightPost) => ({
  travelDate: p.travelDate,
  origin: p.origin,
  destination: p.destination,
  layovers: p.layovers,
  flightNumbers: p.flightNumbers,
  legs: p.legs,
});

// ---- needs -----------------------------------------------------------------

export async function needSummaries(rows: Row<Need>[], viewerId: string) {
  const ids = rows.map((r) => r.post.id);
  const mineIds = rows.filter((r) => r.post.userId === viewerId).map((r) => r.post.id);
  const othersIds = ids.filter((id) => !mineIds.includes(id));
  const [counts, convs, thanks] = await Promise.all([
    mineIds.length
      ? db
          .select({ needId: conversations.needId, n: sql<number>`count(*)::int` })
          .from(conversations)
          .where(inArray(conversations.needId, mineIds))
          .groupBy(conversations.needId)
      : [],
    othersIds.length
      ? db
          .select({ needId: conversations.needId, id: conversations.id })
          .from(conversations)
          .where(and(inArray(conversations.needId, othersIds), eq(conversations.helperId, viewerId)))
      : [],
    thanksCounts(rows.map((r) => r.post.userId)),
  ]);
  const countBy = new Map(counts.map((c) => [c.needId, c.n]));
  const convBy = new Map(convs.map((c) => [c.needId, c.id]));
  return rows.map(({ post: n, posterName }) => {
    const mine = n.userId === viewerId;
    return {
      id: n.id,
      travelerLabel: n.travelerLabel,
      travelerAge: n.travelerAge,
      languages: n.languages,
      ...routeFields(n),
      status: n.status,
      postedBy: { id: n.userId, firstName: firstName(posterName), thanksCount: thanks.get(n.userId) ?? 0 },
      mine,
      hidden: mine && n.hiddenAt !== null,
      responseCount: mine ? (countBy.get(n.id) ?? 0) : 0,
      myConversationId: mine ? null : (convBy.get(n.id) ?? null),
      createdAt: n.createdAt,
    };
  });
}

export function publicNeed(n: Need) {
  return { id: n.id, travelerLabel: n.travelerLabel, languages: n.languages, ...routeFields(n) };
}

// ---- flight posts ----------------------------------------------------------

export async function flightSummaries(rows: Row<FlightPost>[], viewerId: string) {
  const thanks = await thanksCounts(rows.map((r) => r.post.userId));
  return rows.map(({ post: f, posterName }) => {
    const mine = f.userId === viewerId;
    return {
      id: f.id,
      ...routeFields(f),
      languages: f.languages,
      note: f.note,
      status: f.status,
      postedBy: { id: f.userId, firstName: firstName(posterName), thanksCount: thanks.get(f.userId) ?? 0 },
      mine,
      hidden: mine && f.hiddenAt !== null,
      createdAt: f.createdAt,
    };
  });
}

// ---- matching --------------------------------------------------------------

type Routed = Need | FlightPost;

/** Coarse SQL pre-filter shared by both directions: ±1 day, and a shared flight or the same O&D. */
function nearby(t: typeof needs | typeof flightPosts, p: Routed) {
  return and(
    gte(t.travelDate, sql`${p.travelDate}::date - 1`),
    lte(t.travelDate, sql`${p.travelDate}::date + 1`),
    or(arrayOverlaps(t.flightNumbers, p.flightNumbers), and(eq(t.origin, p.origin), eq(t.destination, p.destination))),
  );
}

/** Open, visible flight posts matching a need, excluding the need's owner and anyone blocked with them. */
export async function flightsMatching(need: Need) {
  const blocked = [...(await blockedWith(need.userId))];
  const rows = await db
    .select({ post: flightPosts, posterName: users.name, alertsEnabled: users.alertsEnabled, email: users.email })
    .from(flightPosts)
    .innerJoin(users, eq(users.id, flightPosts.userId))
    .where(
      and(
        eq(flightPosts.status, "open"),
        isNull(flightPosts.hiddenAt),
        ne(flightPosts.userId, need.userId),
        blocked.length ? notInArray(flightPosts.userId, blocked) : undefined,
        nearby(flightPosts, need),
      ),
    )
    .limit(100);
  return rows.flatMap((r) => {
    const reason = matchReason(need, r.post);
    return reason ? [{ ...r, matchReason: reason }] : [];
  });
}

/** Open, visible needs matching a flight post, excluding its owner and anyone blocked with them. */
export async function needsMatching(flight: FlightPost) {
  const blocked = [...(await blockedWith(flight.userId))];
  const rows = await db
    .select({ post: needs, posterName: users.name, alertsEnabled: users.alertsEnabled, email: users.email })
    .from(needs)
    .innerJoin(users, eq(users.id, needs.userId))
    .where(
      and(
        eq(needs.status, "open"),
        isNull(needs.hiddenAt),
        ne(needs.userId, flight.userId),
        blocked.length ? notInArray(needs.userId, blocked) : undefined,
        nearby(needs, flight),
      ),
    )
    .limit(100);
  return rows.flatMap((r) => {
    const reason = matchReason(flight, r.post);
    return reason ? [{ ...r, matchReason: reason }] : [];
  });
}
