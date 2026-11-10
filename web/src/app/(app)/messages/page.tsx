"use client";

import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { EmptyState, LoadError, Loading, NeedStatusBadge, PageHeader } from "@/components/common";
import { buttonVariants } from "@/components/ui/button";
import { listConversations } from "@/lib/api";
import { date, dateTime } from "@/lib/format";
import { useAsync } from "@/lib/hooks";

export default function Inbox() {
  const convs = useAsync(listConversations, "conversations");
  return (
    <>
      <PageHeader title="Messages" subtitle="Conversations about needs you posted, and needs you reached out to." />
      {convs.error ? (
        <LoadError error={convs.error} onRetry={convs.reload} />
      ) : !convs.data ? (
        <Loading />
      ) : convs.data.length === 0 ? (
        <EmptyState
          icon={<MessageCircle />}
          title="No conversations yet"
          body="When you reach out to a need, or someone reaches out to yours, the conversation shows up here."
          action={
            <Link href="/needs" className={buttonVariants()}>
              Browse needs
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
          {convs.data.map((c) => (
            <li key={c.id}>
              <Link href={`/messages/${c.id}`} className="block px-4 py-3 hover:bg-zinc-50">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium">
                    {c.otherParty.firstName}
                    <span className="ml-2 text-sm font-normal text-fg-muted">
                      {c.role === "poster" ? "reached out about your post" : "posted this need"}
                    </span>
                  </p>
                  <span className="shrink-0 text-xs text-fg-muted">{c.lastMessage ? dateTime(c.lastMessage.at) : ""}</span>
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
                  {c.need.travelerLabel} · {c.need.origin} → {c.need.destination} · {date(c.need.travelDate)}
                  {c.need.status !== "open" ? <NeedStatusBadge status={c.need.status} /> : null}
                </p>
                {c.lastMessage ? (
                  <p className="mt-1 truncate text-sm">
                    {c.lastMessage.mine ? "You: " : ""}
                    {c.lastMessage.body}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
