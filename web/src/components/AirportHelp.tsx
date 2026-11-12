import { Accessibility, ExternalLink } from "lucide-react";
import { API_URL } from "@/lib/api";
import type { AirportHelp } from "@/lib/types";
import { Panel, PanelTitle } from "./common";

// Official airport assistance (api/ROUTES.md "Airport assistance"): the free
// airline line, then one link per airport on the route with an official paid
// meet-and-assist service. Links go through the API's click redirect.

const airlineNames = (help: AirportHelp) => help.airlines.map((a) => a.name ?? a.code).join(" and ") || "the airline";

const ROLE: Record<string, string> = { origin: "departure", layover: "transfer", destination: "arrival" };

/** The lines themselves, for embedding (the checklist) or inside the panel below. */
export function AirportHelpList({ help }: { help: AirportHelp }) {
  return (
    <div className="space-y-2 text-sm">
      <p className="flex gap-2">
        <Accessibility className="mt-0.5 size-4 shrink-0 text-accent" />
        <span>
          Ask {airlineNames(help)} for <strong>free</strong> wheelchair / special assistance, at least 48 hours before the flight.
        </span>
      </p>
      {help.airports.length ? (
        <>
          <ul className="space-y-2">
            {help.airports.map((a) => (
              <li key={a.iata} className="flex gap-2">
                <ExternalLink className="mt-0.5 size-4 shrink-0 text-accent" />
                <span>
                  <a
                    href={`${API_URL}${a.bookPath}`}
                    target="_blank"
                    rel="noopener"
                    className="font-medium text-emerald-700 underline"
                  >
                    Book official airport assistance at {a.airport}
                  </a>{" "}
                  ({ROLE[a.role]}): {a.provider} (paid, {a.authority}).{" "}
                  <span className="text-fg-muted">{a.priceNote}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-fg-muted">
            Third-party paid services. TransitVault doesn&apos;t operate them; you book and pay the provider directly.
          </p>
        </>
      ) : null}
    </div>
  );
}

/** Panel for the need page (helpers) and the public share preview. */
export function AirportHelpPanel({ help }: { help: AirportHelp }) {
  return (
    <Panel>
      <PanelTitle>Help at the airport</PanelTitle>
      <AirportHelpList help={help} />
    </Panel>
  );
}
