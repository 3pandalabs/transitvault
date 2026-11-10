"use client";

import { ArrowLeft, CheckCircle2, Languages, MessageCircle, Pencil, RotateCcw, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ChipsInput, ErrorText, Field, LoadError, Loading, NeedStatusBadge, PageHeader, Panel, PanelTitle } from "@/components/common";
import { normFlight } from "@/components/LegsEditor";
import { LegsList, travelerLine } from "@/components/needs";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { errorMessage, getNeed, listConversations, reachOut, updateNeed } from "@/lib/api";
import { date, dateTime, route } from "@/lib/format";
import { useAction, useAsync } from "@/lib/hooks";
import type { Need, NeedStatus } from "@/lib/types";

export default function NeedDetail() {
  const { id } = useParams<{ id: string }>();
  const need = useAsync(() => getNeed(id), `need:${id}`);

  if (need.error) return <LoadError error={need.error} onRetry={need.reload} />;
  if (!need.data) return <Loading />;
  const n = need.data;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href={n.mine ? "/my-needs" : "/needs"} className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> {n.mine ? "My needs" : "All needs"}
      </Link>
      <PageHeader
        title={route(n.legs)}
        subtitle={`${date(n.travelDate)} · ${n.legs.length === 1 ? "Direct flight" : `Connecting via ${n.layovers.join(", ")}`}`}
        actions={
          <>
            {n.mine ? <Badge variant="default">Your post</Badge> : null}
            <NeedStatusBadge status={n.status} />
          </>
        }
      />

      <Panel>
        <PanelTitle>Flights</PanelTitle>
        <LegsList legs={n.legs} />
      </Panel>

      <Panel>
        <PanelTitle>Traveller</PanelTitle>
        <p className="text-lg font-medium">{travelerLine(n)}</p>
        <p className="mt-1 inline-flex items-center gap-1.5 text-fg-muted">
          <Languages className="size-4" /> Speaks {n.languages.join(", ")}
        </p>
        {n.assistance ? (
          <div className="mt-4">
            <p className="text-sm font-medium">Help needed</p>
            <p className="mt-1 whitespace-pre-wrap text-fg">{n.assistance}</p>
          </div>
        ) : null}
        {n.notes ? (
          <div className="mt-4">
            <p className="text-sm font-medium">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-fg">{n.notes}</p>
          </div>
        ) : null}
        <p className="mt-4 text-sm text-fg-muted">Posted by {n.postedBy.firstName}</p>
      </Panel>

      {n.mine ? <OwnerPanel need={n} onChange={need.setData} /> : <ReachOutPanel need={n} />}
    </div>
  );
}

function OwnerPanel({ need, onChange }: { need: Need; onChange: (n: Need) => void }) {
  const act = useAction();
  const conversations = useAsync(listConversations, `convs:${need.id}`);
  const mine = conversations.data?.filter((c) => c.need.id === need.id) ?? [];

  const setStatus = (status: NeedStatus) => void act.run(async () => onChange(await updateNeed(need.id, { status })), errorMessage);

  return (
    <>
      <Panel>
        <PanelTitle>Your post</PanelTitle>
        <div className="flex flex-wrap gap-2">
          {need.status === "open" ? (
            <>
              <Button onClick={() => setStatus("found")} disabled={act.busy}>
                <CheckCircle2 /> Mark as found
              </Button>
              <Button variant="outline" onClick={() => setStatus("closed")} disabled={act.busy}>
                <XCircle /> Close
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setStatus("open")} disabled={act.busy}>
              <RotateCcw /> Reopen
            </Button>
          )}
          <Link href={`/needs/${need.id}/edit`} className={buttonVariants({ variant: "ghost" })}>
            <Pencil /> Edit
          </Link>
        </div>
        <p className="mt-3 text-sm text-fg-muted">
          {need.status === "open"
            ? "Open needs are shown on the board. Mark it as found once someone is travelling with them."
            : "This need is hidden from the board. Reopen it to show it again."}
        </p>
        <ErrorText>{act.error}</ErrorText>
      </Panel>

      <Panel>
        <PanelTitle>People who reached out</PanelTitle>
        {conversations.error ? (
          <LoadError error={conversations.error} onRetry={conversations.reload} />
        ) : !conversations.data ? (
          <Loading />
        ) : mine.length === 0 ? (
          <p className="text-sm text-fg-muted">Nobody yet. You&apos;ll get an email when someone on the same flight reaches out.</p>
        ) : (
          <ul className="divide-y divide-line">
            {mine.map((c) => (
              <li key={c.id}>
                <Link href={`/messages/${c.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-accent">
                  <span className="min-w-0">
                    <span className="font-medium">{c.otherParty.firstName}</span>
                    {c.helperFlightNumbers.length ? (
                      <span className="ml-2 text-sm text-fg-muted">on {c.helperFlightNumbers.join(", ")}</span>
                    ) : null}
                    {c.lastMessage ? (
                      <span className="block truncate text-sm text-fg-muted">
                        {c.lastMessage.mine ? "You: " : ""}
                        {c.lastMessage.body}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs text-fg-muted">{c.lastMessage ? dateTime(c.lastMessage.at) : ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

function ReachOutPanel({ need }: { need: Need }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [flights, setFlights] = useState<string[]>(need.flightNumbers.slice(0, 1));
  const send = useAction();

  if (need.myConversationId) {
    return (
      <Panel>
        <PanelTitle>You&apos;ve reached out</PanelTitle>
        <Link href={`/messages/${need.myConversationId}`} className={buttonVariants()}>
          <MessageCircle /> Open conversation
        </Link>
      </Panel>
    );
  }
  if (need.status !== "open") {
    return (
      <Panel>
        <p className="text-fg-muted">
          {need.status === "found" ? "This traveller has already found a companion." : "This need has been closed."}
        </p>
      </Panel>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    void send.run(async () => {
      if (!message.trim()) throw new Error("Write a short message first.");
      const c = await reachOut(need.id, { message: message.trim(), myFlightNumbers: flights.length ? flights : undefined });
      router.push(`/messages/${c.id}`);
    }, errorMessage);
  }

  return (
    <Panel>
      <PanelTitle>I&apos;m on this flight: reach out</PanelTitle>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Your flight number(s)" hint="Type a flight number and press Enter.">
          <ChipsInput ariaLabel="Add your flight number" value={flights} onChange={setFlights} max={4} normalize={normFlight} placeholder="LH761" />
        </Field>
        <Field label="Message" htmlFor="msg" hint="Only the person who posted this sees it. Share contact details later, when you're both comfortable.">
          <Textarea
            id="msg"
            rows={4}
            maxLength={2000}
            placeholder={`Hi ${need.postedBy.firstName}, I'm on the same flight and happy to keep an eye on them at the layover.`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </Field>
        <ErrorText>{send.error}</ErrorText>
        <Button type="submit" disabled={send.busy}>
          <MessageCircle /> {send.busy ? "Sending…" : "Send message"}
        </Button>
      </form>
    </Panel>
  );
}
