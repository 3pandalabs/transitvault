"use client";

import { HandHeart, Languages, Plane, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { AirportHelpPanel } from "@/components/AirportHelp";
import { Backdrop } from "@/components/Backdrop";
import { LoadError, Loading, Panel, PanelTitle } from "@/components/common";
import { LegsList } from "@/components/needs";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/Wordmark";
import { ApiError, getPublicNeed } from "@/lib/api";
import { city } from "@/lib/airports";
import { date } from "@/lib/format";
import { useAsync } from "@/lib/hooks";
import { useSignedIn } from "@/lib/session";

/** Body of /n/:id. Signed-in visitors go straight to the full need page. */
export function PublicNeedView({ id }: { id: string }) {
  const need = useAsync(() => getPublicNeed(id), `public-need:${id}`);
  const signedIn = useSignedIn();
  const next = encodeURIComponent(`/needs/${id}`);

  return (
    <div className="relative">
      <Backdrop />
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        <Logo />
      </header>
      <main className="mx-auto max-w-3xl space-y-5 px-4 pb-12">
        {need.error ? (
          need.error instanceof ApiError && need.error.status === 404 ? (
            <Panel>
              <PanelTitle>This trip is no longer looking for a companion</PanelTitle>
              <p className="text-fg-muted">It may have found someone already, or been closed by the family.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/signup?next=%2Fneeds" className={buttonVariants()}>
                  See other trips
                </Link>
              </div>
            </Panel>
          ) : (
            <LoadError error={need.error} onRetry={need.reload} />
          )
        ) : !need.data ? (
          <Loading />
        ) : (
          <>
            <div>
              <p className="text-sm font-medium text-accent">Looking for a travel companion</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                {need.data.travelerLabel} is flying {[need.data.origin, ...need.data.layovers, need.data.destination].map(city).join(" → ")}
              </h1>
              <p className="mt-1 text-fg-muted">
                {date(need.data.travelDate)} · {need.data.legs.length === 1 ? "Direct flight" : `Connecting via ${need.data.layovers.map(city).join(", ")}`}
              </p>
            </div>

            <Panel>
              <PanelTitle>
                <span className="inline-flex items-center gap-2">
                  <Plane className="size-5 text-accent" /> Flights
                </span>
              </PanelTitle>
              <LegsList legs={need.data.legs} />
              <p className="mt-4 inline-flex items-center gap-1.5 text-fg-muted">
                <Languages className="size-4" /> Speaks {need.data.languages.join(", ")}
              </p>
            </Panel>

            <Panel className="border-emerald-300 bg-emerald-50/60">
              <PanelTitle>
                <span className="inline-flex items-center gap-2">
                  <HandHeart className="size-5 text-emerald-700" /> Are you on this flight?
                </span>
              </PanelTitle>
              <p className="text-sm text-fg">
                A friendly face at the gate, help with the transfer, or just someone to check in on them makes a big difference.
                Reach out to the family privately on TransitVault.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {signedIn ? (
                  <Link href={`/needs/${id}`} className={buttonVariants({ size: "lg" })}>
                    Reach out to the family
                  </Link>
                ) : (
                  <>
                    <Link href={`/signup?next=${next}`} className={buttonVariants({ size: "lg" })}>
                      Sign up to reach out
                    </Link>
                    <Link href={`/login?next=${next}`} className={buttonVariants({ size: "lg", variant: "outline" })}>
                      I have an account
                    </Link>
                  </>
                )}
              </div>
            </Panel>

            <AirportHelpPanel help={need.data.airportHelp} />
          </>
        )}

        <Panel>
          <PanelTitle>What is TransitVault?</PanelTitle>
          <p className="text-sm text-fg-muted">
            Families post the flights of parents travelling alone. People on the same flight or layover offer to keep them
            company. It&apos;s free. Contact details are never shown publicly: people message each other privately and
            share numbers only when they choose to.
          </p>
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-fg-muted">
            <ShieldCheck className="size-4" /> Never send money or passport details to anyone.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/signup?next=%2Fneeds%2Fnew" className={buttonVariants({ variant: "outline" })}>
              Post your parent&apos;s flight
            </Link>
            <Link href="/signup?next=%2Fflights%2Fnew" className={buttonVariants({ variant: "ghost" })}>
              I&apos;m flying and can help
            </Link>
          </div>
        </Panel>
      </main>
    </div>
  );
}
