"use client";

import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { contactFlight, errorMessage, listMyNeeds } from "@/lib/api";
import { date, route } from "@/lib/format";
import { useAction, useAsync } from "@/lib/hooks";
import type { FlightSummary } from "@/lib/types";
import { ErrorText, Field, Loading } from "./common";
import { travelerLine } from "./needs";
import { Button, buttonVariants } from "./ui/button";
import { Textarea } from "./ui/input";

const selectClass = "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-base md:text-sm";

/**
 * A family asks the poster of an "I'm flying" post to help with one of their
 * own open needs. With `needId` preset (from the need page) there's no picker.
 */
export function ContactFlight({ flight, needId: presetNeedId }: { flight: FlightSummary; needId?: string }) {
  const router = useRouter();
  const myNeeds = useAsync(listMyNeeds, presetNeedId ? null : "my-needs");
  const open = myNeeds.data?.filter((n) => n.status === "open" && !n.hidden) ?? [];
  const [picked, setPicked] = useState("");
  const [message, setMessage] = useState("");
  const send = useAction();
  const needId = presetNeedId ?? (picked || open[0]?.id || "");

  if (!presetNeedId) {
    if (myNeeds.error) return <ErrorText>{errorMessage(myNeeds.error)}</ErrorText>;
    if (!myNeeds.data) return <Loading />;
    if (!open.length) {
      return (
        <div className="space-y-3 text-sm text-fg-muted">
          <p>To ask {flight.postedBy.firstName} for help, first post your parent&apos;s flight as a need.</p>
          <Link href="/needs/new" className={buttonVariants()}>
            Post a need
          </Link>
        </div>
      );
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    void send.run(async () => {
      if (!needId) throw new Error("Pick which of your needs this is about.");
      if (!message.trim()) throw new Error("Write a short message first.");
      const c = await contactFlight(flight.id, { needId, message: message.trim() });
      router.push(`/messages/${c.id}`);
    }, errorMessage);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {!presetNeedId && open.length > 1 ? (
        <Field label="Which trip is this about?" htmlFor={`need-${flight.id}`}>
          <select id={`need-${flight.id}`} className={selectClass} value={needId} onChange={(e) => setPicked(e.target.value)}>
            {open.map((n) => (
              <option key={n.id} value={n.id}>
                {travelerLine(n)}: {route(n.legs)}, {date(n.travelDate)}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <Field
        label={`Message to ${flight.postedBy.firstName}`}
        htmlFor={`contact-${flight.id}`}
        hint="Only they see it. Share contact details later, once you're both comfortable."
      >
        <Textarea
          id={`contact-${flight.id}`}
          rows={3}
          maxLength={2000}
          placeholder={`Hi ${flight.postedBy.firstName}, my mother is on the same flight. Would you be able to keep an eye on her?`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </Field>
      <ErrorText>{send.error}</ErrorText>
      <Button type="submit" disabled={send.busy}>
        <MessageCircle /> {send.busy ? "Sending…" : "Ask for help"}
      </Button>
    </form>
  );
}
