"use client";

import { Check, Gift, HandHeart, Info } from "lucide-react";
import Link from "next/link";
import { money, usePaymentsConfig } from "@/components/PaidHelp";

// Home page "Is it free?" section. The paid-help card only appears when the
// API has payments on, so with payments off the page still says just "free".
// Copy kept in step with /faq, /terms and api/ROUTES.md "Paid help".

const FREE = ["Post a trip", "Browse and filter the board", "Reach out and message", "Post “I’m flying”"];

export function HomePlans() {
  const config = usePaymentsConfig();
  const paid = Boolean(config?.enabled);

  return (
    <section id="free" className="mx-auto w-full max-w-6xl scroll-mt-10 px-4 py-20 sm:px-6">
      <div className="tv-reveal text-center">
        <p className="text-xs font-semibold tracking-widest text-accent uppercase">Is it free?</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          Posting and reaching out are free.
        </h2>
      </div>

      <div className={`mx-auto mt-12 grid gap-6 ${paid ? "max-w-4xl md:grid-cols-2" : "max-w-md"}`}>
        <div className="tv-reveal rounded-[1.75rem] border border-line bg-white/90 p-7 shadow-sm">
          <p className="text-sm font-semibold text-fg-muted">For everyone</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight text-fg">Free</p>
          <ul className="mt-6 space-y-3 text-sm text-fg">
            {FREE.map((f) => (
              <li key={f} className="flex gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                {f}
              </li>
            ))}
          </ul>
          <Link
            href="/signup?next=%2Fneeds%2Fnew"
            className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-medium text-fg hover:bg-slate-50"
          >
            Post a need
          </Link>
        </div>

        {paid && config ? (
          <div className="tv-glow-card tv-reveal rounded-[1.75rem]">
            <div className="h-full rounded-[1.75rem] bg-white p-7">
              <p className="flex items-center gap-2 text-sm font-semibold text-accent">
                <HandHeart className="size-4" /> When you accept a helper
              </p>
              <p className="mt-2 text-4xl font-semibold tracking-tight text-fg">
                {money(config.feeCents)} <span className="text-base font-medium text-fg-muted">per trip</span>
              </p>
              <ul className="mt-6 space-y-3 text-sm text-fg">
                <li className="flex gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  A family pays only when they accept a helper.
                </li>
                <li className="flex gap-2.5">
                  <Gift className="mt-0.5 size-4 shrink-0 text-amber-500" />
                  The helper gets {money(config.rewardCents)} TransitVault credit as a thank-you (or helps for free).
                </li>
                <li className="flex gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  If a helper doesn&apos;t show, the fee comes back as credit; contact us for a card refund.
                </li>
              </ul>
              <p className="mt-6 flex gap-1.5 text-xs text-fg-muted">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Helpers are fellow travellers, not hired escorts, and TransitVault doesn&apos;t provide assistance services.
                </span>
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <p className="mt-8 text-center text-sm">
        <Link href="/faq" className="font-medium text-accent hover:underline">
          More questions? Read the FAQ
        </Link>
      </p>
    </section>
  );
}
