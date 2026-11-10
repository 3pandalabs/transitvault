"use client";

import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { errorMessage, listMessages, sendMessage } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { useAction, useAsync } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { ErrorText, LoadError, Loading } from "./common";
import { Button } from "./ui/button";
import { Textarea } from "./ui/input";

const POLL_MS = 10_000;

/** A conversation thread. Refetches every 10 s while open (no push in phase 1). */
export function Chat({ conversationId, otherName }: { conversationId: string; otherName: string }) {
  const messages = useAsync(() => listMessages(conversationId), `msgs:${conversationId}`);
  const [body, setBody] = useState("");
  const send = useAction();
  const end = useRef<HTMLDivElement>(null);
  const { reload } = messages;

  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") reload();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [reload]);

  const count = messages.data?.length ?? 0;
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [count]);

  function submit() {
    const text = body.trim();
    if (!text) return;
    void send.run(async () => {
      await sendMessage(conversationId, text);
      setBody("");
      reload();
    }, errorMessage);
  }

  return (
    <div>
      <div className="max-h-[28rem] min-h-40 space-y-2 overflow-y-auto rounded-xl bg-bg-subtle p-3">
        {messages.error && !messages.data ? (
          <LoadError error={messages.error} onRetry={reload} />
        ) : !messages.data ? (
          <Loading />
        ) : messages.data.length === 0 ? (
          <p className="py-4 text-center text-sm text-fg-muted">No messages yet.</p>
        ) : (
          messages.data.map((m) => (
            <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[80%] rounded-2xl px-3 py-2 text-sm", m.mine ? "bg-accent text-accent-fg" : "bg-white")}>
                {!m.mine ? <p className="text-xs font-medium opacity-70">{otherName}</p> : null}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className="mt-0.5 text-[10px] opacity-60">{dateTime(m.createdAt)}</p>
              </div>
            </div>
          ))
        )}
        <div ref={end} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mt-2 flex items-end gap-2"
      >
        <Textarea
          aria-label="Message"
          placeholder="Write a message"
          rows={2}
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <Button type="submit" size="icon" aria-label="Send" disabled={send.busy || !body.trim()}>
          <Send />
        </Button>
      </form>
      <ErrorText>{send.error}</ErrorText>
    </div>
  );
}
