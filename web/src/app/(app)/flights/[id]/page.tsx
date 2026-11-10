"use client";

import { ArrowLeft, HandHeart, Languages, Pencil, RotateCcw, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ContactFlight } from "@/components/ContactFlight";
import { ErrorText, LoadError, Loading, PageHeader, Panel, PanelTitle } from "@/components/common";
import { HiddenNotice, LegsList, NeedCard, PersonLine } from "@/components/needs";
import { BlockButton, ReportButton } from "@/components/Safety";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { errorMessage, getFlight, getFlightMatches, updateFlight } from "@/lib/api";
import { date, route } from "@/lib/format";
import { useAction, useAsync } from "@/lib/hooks";
import type { Flight } from "@/lib/types";

export default function FlightDetail() {
  const { id } = useParams<{ id: string }>();
  const flight = useAsync(() => getFlight(id), `flight:${id}`);

  if (flight.error) return <LoadError error={flight.error} onRetry={flight.reload} />;
  if (!flight.data) return <Loading />;
  const f = flight.data;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href={f.mine ? "/my-needs" : "/flights"} className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> {f.mine ? "My posts" : "People flying"}
      </Link>
      {f.mine && f.hidden ? <HiddenNotice /> : null}
      <PageHeader
        title={route(f.legs)}
        subtitle={`${date(f.travelDate)} · ${f.legs.length === 1 ? "Direct flight" : `Connecting via ${f.layovers.join(", ")}`}`}
        actions={
          <>
            {f.mine ? <Badge variant="default">Your post</Badge> : null}
            {f.status === "closed" ? <Badge variant="muted">Closed</Badge> : <Badge variant="good">Offering to help</Badge>}
          </>
        }
      />

      <Panel>
        <PanelTitle>Flights</PanelTitle>
        <LegsList legs={f.legs} />
      </Panel>

      <Panel>
        <PanelTitle>Traveller</PanelTitle>
        <p className="inline-flex items-center gap-1.5 text-lg font-medium">
          <HandHeart className="size-5 text-accent" />
          <PersonLine person={f.postedBy} />
        </p>
        {f.languages.length ? (
          <p className="mt-1 inline-flex items-center gap-1.5 text-fg-muted">
            <Languages className="size-4" /> Speaks {f.languages.join(", ")}
          </p>
        ) : null}
        {f.note ? <p className="mt-3 whitespace-pre-wrap">{f.note}</p> : null}
      </Panel>

      {f.mine ? (
        <OwnerPanel flight={f} onChange={flight.setData} />
      ) : f.status === "open" ? (
        <Panel>
          <PanelTitle>Ask {f.postedBy.firstName} to help with your parent&apos;s trip</PanelTitle>
          <ContactFlight flight={f} />
        </Panel>
      ) : (
        <Panel>
          <p className="text-fg-muted">{f.postedBy.firstName} has closed this post.</p>
        </Panel>
      )}

      {!f.mine ? (
        <div className="flex flex-wrap items-start gap-2">
          <ReportButton targetType="flight" targetId={f.id} label="Report this post" />
          <BlockButton userId={f.postedBy.id} firstName={f.postedBy.firstName} />
        </div>
      ) : null}
    </div>
  );
}

function OwnerPanel({ flight, onChange }: { flight: Flight; onChange: (f: Flight) => void }) {
  const act = useAction();
  const matches = useAsync(() => getFlightMatches(flight.id), flight.status === "open" ? `flight-matches:${flight.id}` : null);
  const setStatus = (status: Flight["status"]) => void act.run(async () => onChange(await updateFlight(flight.id, { status })), errorMessage);

  return (
    <>
      <Panel>
        <PanelTitle>Your post</PanelTitle>
        <div className="flex flex-wrap gap-2">
          {flight.status === "open" ? (
            <Button variant="outline" onClick={() => setStatus("closed")} disabled={act.busy}>
              <XCircle /> Close
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setStatus("open")} disabled={act.busy}>
              <RotateCcw /> Reopen
            </Button>
          )}
          <Link href={`/flights/${flight.id}/edit`} className={buttonVariants({ variant: "ghost" })}>
            <Pencil /> Edit
          </Link>
        </div>
        <p className="mt-3 text-sm text-fg-muted">
          {flight.status === "open"
            ? "We email you when a family on your flight posts a need. Close this once you've travelled or can't help."
            : "This post is hidden from other people. Reopen it to show it again."}
        </p>
        <ErrorText>{act.error}</ErrorText>
      </Panel>

      {flight.status === "open" ? (
        <Panel>
          <PanelTitle>Families on your flight</PanelTitle>
          {matches.error ? (
            <LoadError error={matches.error} onRetry={matches.reload} />
          ) : !matches.data ? (
            <Loading />
          ) : matches.data.length === 0 ? (
            <p className="text-sm text-fg-muted">No family on your flight has posted yet. We&apos;ll email you if one does.</p>
          ) : (
            <div className="grid gap-4">
              {matches.data.map((n) => (
                <div key={n.id}>
                  <p className="mb-1 text-sm font-medium text-emerald-700">{n.matchReason}</p>
                  <NeedCard need={n} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      ) : null}
    </>
  );
}
