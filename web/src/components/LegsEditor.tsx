"use client";

import { Plane, Plus, Trash2 } from "lucide-react";
import { inputToWall, wallToInput } from "@/lib/format";
import type { Leg } from "@/lib/types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export const MAX_LEGS = 4;
export const emptyLeg = (from = ""): Leg => ({ flightNumber: "", from, to: "", departsAt: "", arrivesAt: "" });

const IATA = /^[A-Z]{3}$/;
const FLIGHT = /^[A-Z0-9]{2}[0-9]{1,4}[A-Z]?$/;

/** Normalise "ai 101" → "AI101". */
export const normFlight = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Client-side mirror of the API's leg checks; returns a message or null. */
export function legsProblem(legs: Leg[]): string | null {
  for (const [i, l] of legs.entries()) {
    const n = `Flight ${i + 1}`;
    if (!FLIGHT.test(l.flightNumber)) return `${n}: enter a flight number like AI101 or 6E2134.`;
    if (!IATA.test(l.from) || !IATA.test(l.to)) return `${n}: airports are 3-letter codes like DEL or JFK.`;
    if (l.from === l.to) return `${n}: departure and arrival airports are the same.`;
    if (!l.departsAt || !l.arrivesAt) return `${n}: enter departure and arrival times.`;
    if (i > 0 && legs[i - 1].to !== l.from) return `${n} must depart from ${legs[i - 1].to}.`;
  }
  return null;
}

/**
 * 1–4 contiguous flights. Times are entered as printed on the ticket (local to
 * each airport) — see lib/format.ts on why they are not converted.
 */
export function LegsEditor({ legs, onChange }: { legs: Leg[]; onChange: (legs: Leg[]) => void }) {
  const set = (i: number, patch: Partial<Leg>) => {
    const next = legs.map((l, j) => (j === i ? { ...l, ...patch } : l));
    // Keep the chain contiguous: the next flight departs where this one lands.
    if (patch.to !== undefined && next[i + 1]) next[i + 1] = { ...next[i + 1], from: patch.to };
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {legs.map((l, i) => (
        <div key={i} className="rounded-xl border border-line bg-bg-subtle/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <Plane className="size-4" /> Flight {i + 1}
              {i > 0 ? <span className="text-xs font-normal text-fg-muted">(connection)</span> : null}
            </span>
            {legs.length > 1 && i === legs.length - 1 ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange(legs.slice(0, -1))}>
                <Trash2 /> Remove
              </Button>
            ) : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              aria-label={`Flight ${i + 1} number`}
              placeholder="Flight no. (AI101)"
              value={l.flightNumber}
              onChange={(e) => set(i, { flightNumber: normFlight(e.target.value) })}
              maxLength={8}
            />
            <Input
              aria-label={`Flight ${i + 1} from`}
              placeholder="From (DEL)"
              value={l.from}
              disabled={i > 0}
              onChange={(e) => set(i, { from: e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) })}
            />
            <Input
              aria-label={`Flight ${i + 1} to`}
              placeholder="To (JFK)"
              value={l.to}
              onChange={(e) => set(i, { to: e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) })}
            />
            <label className="text-xs text-fg-muted sm:col-span-1">
              Departs (local time)
              <Input
                type="datetime-local"
                value={wallToInput(l.departsAt)}
                onChange={(e) => set(i, { departsAt: inputToWall(e.target.value) })}
              />
            </label>
            <label className="text-xs text-fg-muted sm:col-span-2">
              Arrives (local time)
              <Input
                type="datetime-local"
                value={wallToInput(l.arrivesAt)}
                onChange={(e) => set(i, { arrivesAt: inputToWall(e.target.value) })}
              />
            </label>
          </div>
        </div>
      ))}
      {legs.length < MAX_LEGS ? (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...legs, emptyLeg(legs[legs.length - 1]?.to ?? "")])}>
          <Plus /> Add a connecting flight
        </Button>
      ) : null}
    </div>
  );
}
