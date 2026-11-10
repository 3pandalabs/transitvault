"use client";

import { HandHeart, Languages, Plane } from "lucide-react";
import Link from "next/link";
import { date, route } from "@/lib/format";
import type { FlightSummary } from "@/lib/types";
import { LegsList, PersonLine } from "./needs";
import { Badge } from "./ui/badge";

const stops = (n: number) => (n === 1 ? "Direct" : `${n - 1} stop${n > 2 ? "s" : ""}`);

/** An "I'm flying" post, styled like NeedCard. */
export function FlightCard({ flight, matchReason }: { flight: FlightSummary; matchReason?: string }) {
  return (
    <Link
      href={`/flights/${flight.id}`}
      className="block rounded-2xl border border-line bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow-md"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-lg font-semibold">
            <Plane className="size-5 shrink-0 text-accent" />
            {route(flight.legs)}
          </p>
          <p className="mt-0.5 text-sm text-fg-muted">
            {date(flight.travelDate)} · {stops(flight.legs.length)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {flight.mine ? <Badge variant="default">Your post</Badge> : null}
          {flight.hidden ? <Badge variant="bad">Hidden</Badge> : null}
          {flight.status === "closed" ? <Badge variant="muted">Closed</Badge> : <Badge variant="good">Offering to help</Badge>}
        </div>
      </div>
      {matchReason ? <p className="mt-2 text-sm font-medium text-emerald-700">{matchReason}</p> : null}
      <div className="mt-3">
        <LegsList legs={flight.legs} compact />
      </div>
      {flight.note ? <p className="mt-3 line-clamp-2 text-sm text-fg">{flight.note}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1 font-medium">
          <HandHeart className="size-4 text-accent" />
          <PersonLine person={flight.postedBy} />
        </span>
        {flight.languages.length ? (
          <span className="inline-flex items-center gap-1 text-fg-muted">
            <Languages className="size-4" /> {flight.languages.join(", ")}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
