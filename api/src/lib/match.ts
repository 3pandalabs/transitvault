// Need ↔ "I'm flying" post matching (api/ROUTES.md "Match rule"). Pure and
// unit-tested; routes do a coarse SQL pre-filter and then call this.

export type Routed = { travelDate: string; flightNumbers: string[]; origin: string; destination: string };

const DAY = 86_400_000;
const dayDiff = (a: string, b: string) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY;

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Why the two match, or null if they don't. */
export function matchReason(a: Routed, b: Routed): string | null {
  const shared = a.flightNumbers.filter((f) => b.flightNumbers.includes(f));
  if (shared.length && dayDiff(a.travelDate, b.travelDate) <= 1) {
    return `Same flight${shared.length > 1 ? "s" : ""} ${shared.join(", ")}`;
  }
  if (a.origin === b.origin && a.destination === b.destination && a.travelDate === b.travelDate) {
    return `Same route ${a.origin} → ${a.destination} on ${shortDate(a.travelDate)}`;
  }
  return null;
}
