import { cityRoute } from "./airports";
import { SITE_URL } from "./site";

// Share text for a need (api/ROUTES.md "Sharing a need"). Pure: used by the
// share buttons and by the /n/:id page's Open Graph tags.

type Shareable = { id: string; travelerLabel: string; travelDate: string; origin: string; destination: string; flightNumbers: string[] };

/** "1 Dec": calendar date, never shifted by the viewer's timezone. */
export function shortDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export const publicNeedUrl = (id: string) => `${SITE_URL}/n/${id}`;

/** "Is anyone on LH761 + LH430, Delhi → Chicago on 1 Dec?" */
export function shareQuestion(n: Shareable): string {
  return `Is anyone on ${n.flightNumbers.join(" + ")}, ${cityRoute(n.origin, n.destination)} on ${shortDate(n.travelDate)}?`;
}

/** "My mother is flying alone and could use a companion." */
export function shareAsk(n: Pick<Shareable, "travelerLabel">): string {
  return `${n.travelerLabel} is flying alone and could use a companion.`;
}

/** The full WhatsApp/share message, link included. */
export function shareMessage(n: Shareable): string {
  return `${shareQuestion(n)} ${shareAsk(n)} ${publicNeedUrl(n.id)}`;
}

export const whatsappUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
