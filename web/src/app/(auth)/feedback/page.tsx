"use client";

import { CheckCircle2, ThumbsDown, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ErrorText, Loading } from "@/components/common";
import { Button } from "@/components/ui/button";
import { answerFeedback, ApiError, errorMessage, getFeedback } from "@/lib/api";
import { date } from "@/lib/format";
import { useAction, useAsync } from "@/lib/hooks";
import type { FeedbackView } from "@/lib/types";

// "Did <helper> help?" from the post-trip email (api/ROUTES.md "Paid help").
// The link only pre-selects an answer; nothing is recorded until a button is
// pressed, so mail scanners that open links can't answer for the family.

function Form() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const preselect = params.get("answer");
  const view = useAsync(() => getFeedback(token), token ? `feedback:${token}` : null);
  const act = useAction();
  const [done, setDone] = useState<FeedbackView | null>(null);

  if (!token || view.error) {
    const expired = !token || (view.error instanceof ApiError && view.error.status === 404);
    return <p className="text-sm text-fg-muted">{expired ? "This link has expired or was already used." : errorMessage(view.error)}</p>;
  }
  if (!view.data) return <Loading />;
  const v = done ?? view.data;
  const who = v.helperFirstName;

  if (v.outcome) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <p>
            {v.outcome === "helped"
              ? `Thank you! We've let ${who} know.`
              : "Thanks for telling us, and sorry it didn't work out. The fee is back as TransitVault credit for your next trip. Prefer a card refund? Email support@3pandalabs.com."}
          </p>
        </div>
        <Link href={`/messages/${v.conversationId}`} className="block text-center text-sm text-fg-muted hover:text-fg">
          Open the conversation
        </Link>
      </div>
    );
  }

  const answer = (helped: boolean) => void act.run(async () => setDone(await answerFeedback(token, helped)), errorMessage);
  return (
    <div className="space-y-4">
      <p className="text-sm text-fg-muted">
        {v.travelerLabel}: {v.origin} → {v.destination}, {date(v.travelDate)}
      </p>
      <p className="font-medium">Did {who} help as agreed?</p>
      <div className="flex flex-col gap-2">
        <Button variant={preselect === "no" ? "outline" : "default"} onClick={() => answer(true)} disabled={act.busy}>
          <ThumbsUp /> Yes, {who} helped
        </Button>
        <Button variant={preselect === "no" ? "destructive" : "outline"} onClick={() => answer(false)} disabled={act.busy}>
          <ThumbsDown /> No, {who} didn&apos;t show
        </Button>
      </div>
      <p className="text-xs text-fg-muted">
        &ldquo;No&rdquo; returns the fee as TransitVault credit (email us for a card refund) and {who} gets no credit.
      </p>
      <ErrorText>{act.error}</ErrorText>
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <>
      <h1 className="mb-5 text-lg font-semibold">How did the trip go?</h1>
      <Suspense fallback={null}>
        <Form />
      </Suspense>
    </>
  );
}
