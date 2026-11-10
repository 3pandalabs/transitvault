import type { FastifyBaseLogger } from "fastify";
import { db } from "../db/index.js";
import { matchAlerts } from "../db/schema.js";
import { sendMail, simpleMail } from "./mailer.js";
import { flightsMatching, needsMatching, type FlightPost, type Need } from "./posts.js";

// Match alerts (api/ROUTES.md "Alerts"). Called fire-and-forget after a post is
// created: one email per (need, flight post) pair ever, deduped by the
// match_alerts primary key, skipped for users who turned alerts off. Never
// throws; a failed mail never affects the post.

const route = (p: { origin: string; destination: string; travelDate: string }) => `${p.origin} → ${p.destination} on ${p.travelDate}`;

async function claim(needId: string, flightPostId: string): Promise<boolean> {
  const rows = await db.insert(matchAlerts).values({ needId, flightPostId }).onConflictDoNothing().returning({ n: matchAlerts.needId });
  return rows.length > 0;
}

/** A new need: tell each matching traveller. */
export async function alertForNewNeed(need: Need, log: FastifyBaseLogger): Promise<void> {
  try {
    const mails = [];
    for (const m of await flightsMatching(need)) {
      if (!(await claim(need.id, m.post.id)) || !m.alertsEnabled) continue;
      mails.push(
        simpleMail(
          m.email,
          `A family needs a companion on your flight (${route(need)})`,
          `Someone posted on TransitVault: ${need.travelerLabel} is flying ${route(need)} (${need.flightNumbers.join(", ")}) and could use a companion. ${m.matchReason} as your trip. If you can help, reach out on TransitVault.`,
          `/needs/${need.id}`,
        ),
      );
    }
    if (mails.length) await sendMail(mails, (msg) => log.info(msg));
  } catch (err) {
    log.warn({ err }, "need match alerts failed");
  }
}

/** A new "I'm flying" post: tell each matching family. */
export async function alertForNewFlight(flight: FlightPost, helperFirstName: string, log: FastifyBaseLogger): Promise<void> {
  try {
    const mails = [];
    for (const m of await needsMatching(flight)) {
      if (!(await claim(m.post.id, flight.id)) || !m.alertsEnabled) continue;
      mails.push(
        simpleMail(
          m.email,
          `Someone on your flight offered to help (${route(m.post)})`,
          `${helperFirstName} is flying ${route(flight)} (${flight.flightNumbers.join(", ")}) and offered to help travellers. ${m.matchReason} as your post for ${m.post.travelerLabel}. Message them on TransitVault.`,
          `/flights/${flight.id}`,
        ),
      );
    }
    if (mails.length) await sendMail(mails, (msg) => log.info(msg));
  } catch (err) {
    log.warn({ err }, "flight match alerts failed");
  }
}
