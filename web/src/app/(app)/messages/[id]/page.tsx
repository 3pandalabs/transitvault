"use client";

import { ArrowLeft, Heart, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Checklist } from "@/components/Checklist";
import { ErrorText, Field, LoadError, Loading, NeedStatusBadge, PageHeader, Panel, PanelTitle } from "@/components/common";
import { Chat } from "@/components/Chat";
import { ThanksBadge } from "@/components/needs";
import { BlockButton, ReportButton } from "@/components/Safety";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { errorMessage, getConversation, sayThanks } from "@/lib/api";
import { date } from "@/lib/format";
import { useAction, useAsync } from "@/lib/hooks";
import type { Conversation } from "@/lib/types";

export default function Thread() {
  const { id } = useParams<{ id: string }>();
  const conv = useAsync(() => getConversation(id), `conv:${id}`);

  if (conv.error) return <LoadError error={conv.error} onRetry={conv.reload} />;
  if (!conv.data) return <Loading />;
  const c = conv.data;
  const isPoster = c.role === "poster";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/messages" className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Messages
      </Link>
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-x-3">
            {c.otherParty.firstName}
            <ThanksBadge count={c.otherParty.thanksCount} />
          </span>
        }
        subtitle={
          <>
            About{" "}
            <Link href={`/needs/${c.need.id}`} className="underline hover:text-fg">
              {c.need.travelerLabel}: {c.need.origin} → {c.need.destination}, {date(c.need.travelDate)}
            </Link>
            {c.helperFlightNumbers.length ? ` · ${isPoster ? "they're" : "you're"} on ${c.helperFlightNumbers.join(", ")}` : ""}
          </>
        }
        actions={c.need.status !== "open" ? <NeedStatusBadge status={c.need.status} /> : undefined}
      />
      <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <ShieldAlert className="size-4 shrink-0" />
        <p>Share phone numbers or meeting details only when you&apos;re comfortable. Never send money or passport details.</p>
      </div>

      {c.thankedAt ? <ThanksGiven conversation={c} /> : null}

      <Panel>
        <Chat
          conversationId={c.id}
          otherName={c.otherParty.firstName}
          disabledReason={c.blocked ? "You can't send messages here: one of you has blocked the other." : undefined}
        />
      </Panel>

      {isPoster && !c.thankedAt && !c.blocked ? <SayThanks conversation={c} onDone={conv.setData} /> : null}

      {isPoster ? <Checklist /> : null}

      <div className="flex flex-wrap items-start gap-2">
        <ReportButton targetType="user" targetId={c.otherParty.id} label={`Report ${c.otherParty.firstName}`} />
        <BlockButton userId={c.otherParty.id} firstName={c.otherParty.firstName} blocked={c.blocked} onChange={() => conv.reload()} />
      </div>
    </div>
  );
}

function ThanksGiven({ conversation: c }: { conversation: Conversation }) {
  const isPoster = c.role === "poster";
  return (
    <div className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
      <Heart className="size-4 shrink-0 fill-current" />
      <div>
        <p className="font-medium">{isPoster ? `You thanked ${c.otherParty.firstName}.` : `${c.otherParty.firstName} thanked you for your help.`}</p>
        {c.thankNote ? <p className="mt-1 whitespace-pre-wrap">&ldquo;{c.thankNote}&rdquo;</p> : null}
      </div>
    </div>
  );
}

function SayThanks({ conversation, onDone }: { conversation: Conversation; onDone: (c: Conversation) => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const act = useAction();

  if (!open) {
    return (
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-fg-muted">Did {conversation.otherParty.firstName} help? A thank-you shows on their profile for other families.</p>
          <Button variant="outline" onClick={() => setOpen(true)}>
            <Heart /> Say thank you
          </Button>
        </div>
      </Panel>
    );
  }
  return (
    <Panel>
      <PanelTitle>Thank {conversation.otherParty.firstName}</PanelTitle>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void act.run(async () => onDone(await sayThanks(conversation.id, note.trim() || undefined)), errorMessage);
        }}
      >
        <Field label="A few words (optional)" htmlFor="thanks-note" hint="They'll get it by email too.">
          <Textarea
            id="thanks-note"
            rows={3}
            maxLength={500}
            placeholder="Thank you for looking after Mummy at Frankfurt. She was so relieved!"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <ErrorText>{act.error}</ErrorText>
        <div className="flex gap-2">
          <Button type="submit" disabled={act.busy}>
            <Heart /> {act.busy ? "Sending…" : "Send thank-you"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Panel>
  );
}
