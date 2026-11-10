"use client";

import { CheckCircle2, Languages, MessageCircle, Plane } from "lucide-react";
import Link from "next/link";
import { date, route, wallDateTime } from "@/lib/format";
import type { Leg, NeedSummary } from "@/lib/types";
import { NeedStatusBadge } from "./common";
import { Badge } from "./ui/badge";

/** "My mother, 72" */
export function travelerLine(n: Pick<NeedSummary, "travelerLabel" | "travelerAge">) {
  return n.travelerAge ? `${n.travelerLabel}, ${n.travelerAge}` : n.travelerLabel;
}

/** Each flight with its local times; layovers are implied between rows. */
export function LegsList({ legs, compact = false }: { legs: Leg[]; compact?: boolean }) {
  return (
    <ol className="space-y-1.5">
      {legs.map((l, i) => (
        <li key={i} className={compact ? "text-sm" : ""}>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-sm font-semibold">{l.flightNumber}</span>
            <span className="font-medium">
              {l.from} → {l.to}
            </span>
          </div>
          <p className="text-sm text-fg-muted">
            Departs {wallDateTime(l.departsAt)} · arrives {wallDateTime(l.arrivesAt)}
            <span className="text-xs"> (local times)</span>
          </p>
          {i < legs.length - 1 ? (
            <p className="mt-1.5 text-xs font-medium text-amber-700">Layover at {l.to}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function NeedCard({ need, showStatus = false }: { need: NeedSummary; showStatus?: boolean }) {
  return (
    <Link
      href={`/needs/${need.id}`}
      className="block rounded-2xl border border-line bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow-md"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-lg font-semibold">
            <Plane className="size-5 shrink-0 text-accent" />
            {route(need.legs)}
          </p>
          <p className="mt-0.5 text-sm text-fg-muted">
            {date(need.travelDate)} · {need.legs.length === 1 ? "Direct" : `${need.legs.length - 1} stop${need.legs.length > 2 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {need.mine ? <Badge variant="default">Your post</Badge> : null}
          {need.myConversationId ? (
            <Badge variant="good">
              <CheckCircle2 className="size-3.5" /> You responded
            </Badge>
          ) : null}
          {showStatus || need.status !== "open" ? <NeedStatusBadge status={need.status} /> : null}
        </div>
      </div>
      <div className="mt-3">
        <LegsList legs={need.legs} compact />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-medium">{travelerLine(need)}</span>
        {need.languages.length ? (
          <span className="inline-flex items-center gap-1 text-fg-muted">
            <Languages className="size-4" /> {need.languages.join(", ")}
          </span>
        ) : null}
        <span className="text-fg-muted">Posted by {need.postedBy.firstName}</span>
        {need.mine && need.responseCount ? (
          <span className="inline-flex items-center gap-1 font-medium text-accent">
            <MessageCircle className="size-4" /> {need.responseCount} {need.responseCount === 1 ? "person" : "people"} reached out
          </span>
        ) : null}
      </div>
    </Link>
  );
}
