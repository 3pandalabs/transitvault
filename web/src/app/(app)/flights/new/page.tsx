"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageHeader, Panel, PanelTitle } from "@/components/common";
import { FlightForm } from "@/components/FlightForm";
import { NeedCard } from "@/components/needs";
import { buttonVariants } from "@/components/ui/button";
import { createFlight } from "@/lib/api";
import type { Flight, NeedMatch } from "@/lib/types";

export default function NewFlight() {
  const [posted, setPosted] = useState<{ flight: Flight; matches: NeedMatch[] } | null>(null);

  if (posted) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <PageHeader title="Your flight is posted" subtitle="Thank you for offering to help." />
        <Panel className="border-emerald-300 bg-emerald-50/60">
          <p className="flex items-center gap-2 font-medium text-emerald-900">
            <CheckCircle2 className="size-5" />
            {posted.matches.length
              ? `${posted.matches.length} ${posted.matches.length === 1 ? "family needs" : "families need"} a companion on your flight.`
              : "No family on your flight has posted yet. We'll email you if one does."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/flights/${posted.flight.id}`} className={buttonVariants({ variant: "outline" })}>
              View my post
            </Link>
            <Link href="/needs" className={buttonVariants({ variant: "ghost" })}>
              Browse all needs
            </Link>
          </div>
        </Panel>
        {posted.matches.length ? (
          <Panel>
            <PanelTitle>Families on your flight</PanelTitle>
            <p className="mb-4 text-sm text-fg-muted">Open one to reach out to the family.</p>
            <div className="grid gap-4">
              {posted.matches.map((n) => (
                <div key={n.id}>
                  <p className="mb-1 text-sm font-medium text-emerald-700">{n.matchReason}</p>
                  <NeedCard need={n} />
                </div>
              ))}
            </div>
          </Panel>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="I'm flying"
        subtitle="Post your flight and offer to keep an eye on someone travelling alone. A friendly face at the gate or the layover helps a lot."
      />
      <FlightForm submitLabel="Post my flight" onSubmit={async (input) => setPosted(await createFlight(input))} />
    </div>
  );
}
