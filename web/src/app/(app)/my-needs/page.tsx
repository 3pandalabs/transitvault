"use client";

import { HandHeart, Plane, Plus } from "lucide-react";
import Link from "next/link";
import { EmptyState, LoadError, Loading, PageHeader } from "@/components/common";
import { FlightCard } from "@/components/flights";
import { NeedCard } from "@/components/needs";
import { buttonVariants } from "@/components/ui/button";
import { listMyFlights, listMyNeeds } from "@/lib/api";
import { useAsync } from "@/lib/hooks";

// "My posts": the needs I posted for family, and the flights I offered to help on.
export default function MyPosts() {
  const needs = useAsync(listMyNeeds, "my-needs");
  const flights = useAsync(listMyFlights, "my-flights");
  return (
    <div className="space-y-10">
      <section>
        <PageHeader
          title="My needs"
          subtitle="Flights you've posted for someone travelling alone."
          actions={
            <Link href="/needs/new" className={buttonVariants()}>
              <Plus /> Post a need
            </Link>
          }
        />
        {needs.error ? (
          <LoadError error={needs.error} onRetry={needs.reload} />
        ) : !needs.data ? (
          <Loading />
        ) : needs.data.length === 0 ? (
          <EmptyState icon={<Plane />} title="No needs yet" body="Post a parent's flight and people on the same flight can reach out." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {needs.data.map((n) => (
              <NeedCard key={n.id} need={n} showStatus />
            ))}
          </div>
        )}
      </section>

      <section>
        <PageHeader
          title="My flights"
          subtitle="Flights you're taking where you offered to help."
          actions={
            <Link href="/flights/new" className={buttonVariants({ variant: "outline" })}>
              <Plus /> I&apos;m flying
            </Link>
          }
        />
        {flights.error ? (
          <LoadError error={flights.error} onRetry={flights.reload} />
        ) : !flights.data ? (
          <Loading />
        ) : flights.data.length === 0 ? (
          <EmptyState
            icon={<HandHeart />}
            title="No flights yet"
            body="Flying soon? Post your flight and we'll tell you if a family on it needs a companion."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {flights.data.map((f) => (
              <FlightCard key={f.id} flight={f} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
