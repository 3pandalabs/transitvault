"use client";

import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ErrorText, Field, LoadError, Loading, PageHeader, Panel, PanelTitle } from "@/components/common";
import { money } from "@/components/PaidHelp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, clearTokens, deleteAccount, errorMessage, getDeletionPreflight } from "@/lib/api";
import { date } from "@/lib/format";
import { useAction, useAsync } from "@/lib/hooks";
import { leaveTo, useSession } from "@/lib/session";
import type { DeletionBlocker } from "@/lib/types";

// Self-service account deletion (api/ROUTES.md "Account deletion"): what goes,
// what stays, password to confirm, then sign out and land on the home page.

export default function DeleteAccountPage() {
  const { user } = useSession();
  const pre = useAsync(getDeletionPreflight, "deletion-preflight");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [blockers, setBlockers] = useState<DeletionBlocker[] | null>(null);
  const act = useAction();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    void act.run(async () => {
      try {
        await deleteAccount(password);
      } catch (err) {
        if (err instanceof ApiError && err.status === 409 && Array.isArray(err.body?.blockers)) setBlockers(err.body.blockers as DeletionBlocker[]);
        throw err;
      }
      // AppShell redirects as soon as the tokens go; tell it where (TV-2).
      leaveTo("/?deleted=1");
      clearTokens();
    }, errorMessage);
  }

  const shown = blockers ?? pre.data?.blockers ?? [];
  const credit = pre.data?.creditCents ?? 0;

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <Link href="/profile" className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Profile
      </Link>
      <PageHeader title="Delete your account" subtitle={user.email} />

      {pre.error ? (
        <LoadError error={pre.error} onRetry={pre.reload} />
      ) : !pre.data ? (
        <Loading />
      ) : (
        <>
          <Panel>
            <PanelTitle>What happens</PanelTitle>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-medium text-fg">Deleted or removed straight away</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-fg-muted">
                  <li>Your name, email, phone number and password.</li>
                  <li>Your open trips and &ldquo;I&apos;m flying&rdquo; posts: they close and leave the boards.</li>
                  <li>Your sign-ins on every device, and your blocks.</li>
                  <li>
                    Your TransitVault credit{credit ? <> (<strong>{money(credit)}</strong>)</> : null} is forfeited. It has no cash value
                    and can&apos;t be refunded.
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-fg">Kept</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-fg-muted">
                  <li>
                    Your conversations stay for the other person, so their history still makes sense. Your messages show as
                    from &ldquo;Deleted user&rdquo;.
                  </li>
                  <li>
                    Payment and credit records, as tax and accounting rules require, linked only to the anonymised account.
                  </li>
                  <li>Database backups for up to 30 days, then they&apos;re gone.</li>
                </ul>
              </div>
              <p className="text-fg-muted">
                You can sign up again with the same email later, as a brand-new account. Details in the{" "}
                <Link href="/privacy" className="underline">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
          </Panel>

          {shown.length ? (
            <Panel className="border-amber-200 bg-amber-50">
              <PanelTitle>Not yet: a paid-help trip is in progress</PanelTitle>
              <ul className="space-y-1 text-sm text-amber-900">
                {shown.map((b) => (
                  <li key={b.conversationId}>
                    <Link href={`/messages/${b.conversationId}`} className="underline">
                      {b.origin} → {b.destination}, {date(b.travelDate)}
                    </Link>{" "}
                    ({b.role === "poster" ? "you accepted a helper" : "you're the accepted helper"}:{" "}
                    {b.kind === "pending_payment" ? "payment not finished" : "trip not resolved yet"})
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-amber-900">
                Wait until the trip is resolved (after landing, once the family answers or 48 hours pass), or{" "}
                <Link href="/contact?topic=delete_data" className="underline">
                  contact support
                </Link>
                .
              </p>
            </Panel>
          ) : null}

          <Panel>
            <form onSubmit={submit} className="space-y-4">
              <Field label="Your password" htmlFor="del-password" hint="To confirm it's you.">
                <Input id="del-password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 size-4" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
                <span>I understand this can&apos;t be undone{credit ? <>, and my {money(credit)} credit is forfeited</> : null}.</span>
              </label>
              <ErrorText>{act.error}</ErrorText>
              <Button type="submit" variant="destructive" disabled={act.busy || !confirm || !password || shown.length > 0}>
                <Trash2 /> {act.busy ? "Deleting…" : "Delete my account"}
              </Button>
            </form>
          </Panel>
        </>
      )}
    </div>
  );
}
