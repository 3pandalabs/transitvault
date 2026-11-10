"use client";

import { ArrowLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { LoadError, Loading, NeedStatusBadge, PageHeader, Panel } from "@/components/common";
import { Chat } from "@/components/Chat";
import { getConversation } from "@/lib/api";
import { date } from "@/lib/format";
import { useAsync } from "@/lib/hooks";

export default function Thread() {
  const { id } = useParams<{ id: string }>();
  const conv = useAsync(() => getConversation(id), `conv:${id}`);

  if (conv.error) return <LoadError error={conv.error} onRetry={conv.reload} />;
  if (!conv.data) return <Loading />;
  const c = conv.data;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/messages" className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Messages
      </Link>
      <PageHeader
        title={c.otherParty.firstName}
        subtitle={
          <>
            About{" "}
            <Link href={`/needs/${c.need.id}`} className="underline hover:text-fg">
              {c.need.travelerLabel}: {c.need.origin} → {c.need.destination}, {date(c.need.travelDate)}
            </Link>
            {c.helperFlightNumbers.length ? ` · ${c.role === "poster" ? "they're" : "you're"} on ${c.helperFlightNumbers.join(", ")}` : ""}
          </>
        }
        actions={c.need.status !== "open" ? <NeedStatusBadge status={c.need.status} /> : undefined}
      />
      <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <ShieldAlert className="size-4 shrink-0" />
        <p>Share phone numbers or meeting details only when you&apos;re comfortable. Never send money or passport details.</p>
      </div>
      <Panel>
        <Chat conversationId={c.id} otherName={c.otherParty.firstName} />
      </Panel>
    </div>
  );
}
