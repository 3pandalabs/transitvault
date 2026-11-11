"use client";

import { BadgeCheck, CreditCard, Gift, HandHeart, Info, ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useState } from "react";
import { acceptHelper, answerOutcome, errorMessage, getConversation, getCredits, getPaymentsConfig, setRewardDeclined } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { useAction, useAsync } from "@/lib/hooks";
import type { Conversation, Credits, PaymentsConfig } from "@/lib/types";
import { ErrorText, LoadError, Loading, Panel, PanelTitle } from "./common";
import { Button } from "./ui/button";

// Paid help (api/ROUTES.md "Paid help"). Everything here renders nothing when
// the API has payments off, so the free board looks exactly as before.

export const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

export function usePaymentsConfig(): PaymentsConfig | undefined {
  return useAsync(getPaymentsConfig, "payments-config").data;
}

/** The one-line "what this is and isn't" copy, shown wherever money is mentioned. */
export function HelperTerms({ className }: { className?: string }) {
  return (
    <p className={className ?? "flex gap-1.5 text-xs text-fg-muted"}>
      <Info className="mt-0.5 size-3.5 shrink-0" />
      <span>
        Helpers are fellow travellers lending a hand, thanked with TransitVault credit. They are not hired escorts or a
        service, and TransitVault doesn&apos;t provide assistance services. If a helper doesn&apos;t show, the fee comes back as
        credit (contact us for a card refund).
      </span>
    </p>
  );
}

/** Helper's "I'm helping for free" checkbox (reach-out form). */
export function FreeHelpCheckbox({ config, checked, onChange }: { config: PaymentsConfig; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        I&apos;m helping for free.{" "}
        <span className="text-fg-muted">
          Otherwise, if the family accepts you, you get {money(config.rewardCents)} TransitVault credit after the trip.
        </span>
      </span>
    </label>
  );
}

export function PaidHelpPanel({ conversation: c, onChange, paid }: { conversation: Conversation; onChange: (c: Conversation) => void; paid: string | null }) {
  const config = usePaymentsConfig();
  if (!config) return null;
  if (!config.enabled && !c.acceptance) return null;
  return c.role === "poster" ? <PosterPanel c={c} config={config} onChange={onChange} paid={paid} /> : <HelperPanel c={c} config={config} onChange={onChange} />;
}

function PosterPanel({ c, config, onChange, paid }: { c: Conversation; config: PaymentsConfig; onChange: (c: Conversation) => void; paid: string | null }) {
  const a = c.acceptance;
  const who = c.otherParty.firstName;

  // Back from Stripe: the webhook may land a moment after the redirect.
  const waiting = paid === "1" && a?.status === "pending_payment";
  useEffect(() => {
    if (!waiting) return;
    const t = setTimeout(() => void getConversation(c.id).then(onChange, () => undefined), 3000);
    return () => clearTimeout(t);
  }, [waiting, c, onChange]);

  if (!a) {
    if (c.needHasHelper || c.need.status === "closed" || c.blocked || !config.enabled) return null;
    return <AcceptPanel c={c} config={config} onChange={onChange} />;
  }

  if (a.status === "pending_payment") {
    return (
      <Panel>
        <PanelTitle>Accept {who} as your helper</PanelTitle>
        {waiting ? (
          <Loading label="Payment received, confirming…" />
        ) : (
          <>
            <p className="text-sm text-fg-muted">
              {paid === "0" ? "Payment was cancelled. " : ""}Finish paying {money(a.cashCents ?? a.feeCents)} to confirm {who}. The checkout expires after 30 minutes.
            </p>
            {a.checkoutUrl ? (
              <a href={a.checkoutUrl} className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-90">
                <CreditCard className="size-4" /> Continue to payment
              </a>
            ) : null}
          </>
        )}
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelTitle>
        <span className="inline-flex items-center gap-2">
          <BadgeCheck className="size-5 text-emerald-600" /> {who} is your confirmed helper
        </span>
      </PanelTitle>
      <p className="text-sm text-fg-muted">
        {a.cashCents ? `You paid ${money(a.cashCents)} by card` : "Paid with your TransitVault credit"}
        {a.cashCents && a.creditAppliedCents ? ` + ${money(a.creditAppliedCents)} credit` : ""}.
        {a.outcome ? "" : a.canAnswer ? "" : " After the flight lands we'll email you to ask whether they helped."}
      </p>
      {a.outcome === "helped" ? (
        <p className="mt-3 text-sm text-emerald-800">You confirmed {who} helped. Thank you!</p>
      ) : a.outcome === "no_show" ? (
        <p className="mt-3 text-sm text-fg">
          You told us {who} didn&apos;t show. The {money(a.feeCents)} fee is back as TransitVault credit
          {a.refundedAt ? ", and the card payment was refunded" : ". Prefer a card refund? Email support@3pandalabs.com"}.
        </p>
      ) : a.canAnswer ? (
        <OutcomeQuestion c={c} onChange={onChange} />
      ) : null}
    </Panel>
  );
}

function AcceptPanel({ c, config, onChange }: { c: Conversation; config: PaymentsConfig; onChange: (c: Conversation) => void }) {
  const act = useAction();
  const credits = useAsync(getCredits, "credits");
  const who = c.otherParty.firstName;
  const balance = credits.data?.balanceCents ?? 0;
  const applied = Math.min(balance, config.feeCents);
  const cash = config.feeCents - applied;

  function accept() {
    void act.run(async () => {
      const r = await acceptHelper(c.id);
      if (r.checkoutUrl) window.location.href = r.checkoutUrl;
      else onChange(r.conversation);
    }, errorMessage);
  }

  return (
    <Panel>
      <PanelTitle>Accept {who} as your helper?</PanelTitle>
      <p className="text-sm text-fg-muted">
        Agreed on the plan? Confirm {who} for this trip. It costs {money(config.feeCents)} per trip, charged only now; posting and
        messaging stay free.{" "}
        {applied ? (cash ? `${money(applied)} of your credit applies, so you pay ${money(cash)} by card.` : "Your TransitVault credit covers it.") : null}
      </p>
      <div className="mt-3">
        <Button onClick={accept} disabled={act.busy || credits.loading}>
          <HandHeart /> {act.busy ? "Starting…" : cash ? `Accept and pay ${money(cash)}` : "Accept with credit"}
        </Button>
      </div>
      <ErrorText>{act.error}</ErrorText>
      <HelperTerms className="mt-3 flex gap-1.5 text-xs text-fg-muted" />
    </Panel>
  );
}

function OutcomeQuestion({ c, onChange }: { c: Conversation; onChange: (c: Conversation) => void }) {
  const act = useAction();
  const [confirmNo, setConfirmNo] = useState(false);
  const who = c.otherParty.firstName;
  const answer = (helped: boolean) => void act.run(async () => onChange(await answerOutcome(c.id, helped)), errorMessage);
  return (
    <div className="mt-3 space-y-3">
      <p className="font-medium">Did {who} help as agreed?</p>
      {confirmNo ? (
        <div className="space-y-2 rounded-xl bg-bg-subtle p-3 text-sm">
          <p>
            We&apos;ll return the {money(c.acceptance?.feeCents ?? 1000)} fee as TransitVault credit and {who} gets no credit. Want a card refund
            instead? Email support@3pandalabs.com after this.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" onClick={() => answer(false)} disabled={act.busy}>
              <ThumbsDown /> Yes, {who} didn&apos;t show
            </Button>
            <Button variant="ghost" onClick={() => setConfirmNo(false)} disabled={act.busy}>
              Back
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => answer(true)} disabled={act.busy}>
            <ThumbsUp /> Yes, {who} helped
          </Button>
          <Button variant="outline" onClick={() => setConfirmNo(true)} disabled={act.busy}>
            <ThumbsDown /> No, they didn&apos;t show
          </Button>
        </div>
      )}
      <p className="text-xs text-fg-muted">No answer within 48 hours of our email counts as &ldquo;yes&rdquo;.</p>
      <ErrorText>{act.error}</ErrorText>
    </div>
  );
}

function HelperPanel({ c, config, onChange }: { c: Conversation; config: PaymentsConfig; onChange: (c: Conversation) => void }) {
  const act = useAction();
  const a = c.acceptance;
  const who = c.otherParty.firstName;
  const locked = Boolean(a?.outcome || a?.rewardReleasedAt);
  const toggle = (declined: boolean) => void act.run(async () => onChange(await setRewardDeclined(c.id, declined)), errorMessage);

  return (
    <Panel>
      <PanelTitle>
        <span className="inline-flex items-center gap-2">
          <Gift className="size-5 text-accent" /> Thank-you credit
        </span>
      </PanelTitle>
      {a?.status === "confirmed" ? (
        <p className="mb-3 text-sm">
          <BadgeCheck className="mr-1 inline size-4 text-emerald-600" />
          {who} accepted you as the helper for this trip
          {a.landsAt ? ` (lands around ${dateTime(a.landsAt)})` : ""}.
        </p>
      ) : null}
      {a?.outcome === "helped" ? (
        <p className="text-sm text-emerald-800">
          {a.rewardCreditedCents ? `${who}'s family confirmed you helped: ${money(a.rewardCreditedCents)} credit is in your account.` : `${who}'s family confirmed you helped. Thank you for helping for free!`}
        </p>
      ) : a?.outcome === "no_show" ? (
        <p className="text-sm text-fg">{who}&apos;s family told us the meet-up didn&apos;t happen, so no credit was issued.</p>
      ) : (
        <>
          <p className="text-sm text-fg-muted">
            {c.rewardDeclined
              ? "You're helping for free: no credit will be issued."
              : `If ${who} accepts you and confirms you helped, you get ${money(config.rewardCents)} TransitVault credit, usable on your own family's trips. It isn't cash.`}
          </p>
          {!locked ? (
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--accent)]"
                checked={c.rewardDeclined}
                disabled={act.busy}
                onChange={(e) => toggle(e.target.checked)}
              />
              I&apos;m helping for free
            </label>
          ) : null}
        </>
      )}
      <ErrorText>{act.error}</ErrorText>
      <HelperTerms className="mt-3 flex gap-1.5 text-xs text-fg-muted" />
    </Panel>
  );
}

const REASON: Record<Credits["entries"][number]["reason"], string> = {
  helper_reward: "Thank-you for helping",
  fee_applied: "Used for a helper fee",
  fee_restored: "Unused fee returned",
  no_show_refund: "Refund: helper didn't show",
  card_refund: "Refunded to your card instead",
};

/** Profile: the TransitVault credit balance and its history. */
export function CreditPanel() {
  const config = usePaymentsConfig();
  const credits = useAsync(getCredits, "credits");
  if (!config) return null;
  if (!config.enabled && !credits.data?.entries.length) return null;
  return (
    <Panel>
      <PanelTitle>TransitVault credit</PanelTitle>
      {credits.error ? (
        <LoadError error={credits.error} onRetry={credits.reload} />
      ) : !credits.data ? (
        <Loading />
      ) : (
        <>
          <p className="text-2xl font-semibold">{money(credits.data.balanceCents)}</p>
          <p className="mt-1 text-sm text-fg-muted">
            Comes off your own {money(config.feeCents)} fee next time you accept a helper. It isn&apos;t cash and can&apos;t be withdrawn.
          </p>
          {credits.data.entries.length ? (
            <ul className="mt-3 divide-y divide-line text-sm">
              {credits.data.entries.map((e) => (
                <li key={e.id} className="flex justify-between gap-3 py-2">
                  <span>
                    {REASON[e.reason]} <span className="text-fg-muted">· {dateTime(e.createdAt)}</span>
                  </span>
                  <span className={e.amountCents > 0 ? "text-emerald-700" : "text-fg-muted"}>
                    {e.amountCents > 0 ? "+" : "−"}
                    {money(Math.abs(e.amountCents))}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </Panel>
  );
}

/** Landing-page FAQ entry; renders nothing while payments are off. */
export function PaidHelpFaq() {
  const config = usePaymentsConfig();
  if (!config?.enabled) return null;
  return (
    <section className="-mt-10 mb-16 rounded-2xl border border-line bg-white/85 p-6 text-sm text-fg-muted shadow-sm">
      <h2 className="font-semibold text-fg">Is it free?</h2>
      <p className="mt-1">
        Posting and reaching out are free. A family pays {money(config.feeCents)} per trip only when they accept a helper, and the
        helper gets {money(config.rewardCents)} TransitVault credit as a thank-you (or helps for free). Helpers are fellow
        travellers, not hired escorts, and TransitVault doesn&apos;t provide assistance services. If a helper doesn&apos;t show,
        the fee comes back as credit; contact us for a card refund.
      </p>
    </section>
  );
}
