"use client";

import { HandHeart, Plus } from "lucide-react";
import Link from "next/link";
import { EmptyState, LoadError, Loading, PageHeader } from "@/components/common";
import { FlightCard } from "@/components/flights";
import { buttonVariants } from "@/components/ui/button";
import { listFlights } from "@/lib/api";
import { useAsync } from "@/lib/hooks";

export default function FlightsBoard() {
  const flights = useAsync(listFlights, "flights");
  return (
    <>
      <PageHeader
        title="People flying who can help"
        subtitle="Travellers who posted their flight and offered to keep an eye on someone. Open one on your parent's flight to ask them."
        actions={
          <Link href="/flights/new" className={buttonVariants()}>
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
          title="Nobody has posted a flight yet"
          body="Flying soon? Post your flight and we'll tell you if a family on it needs a companion."
          action={
            <Link href="/flights/new" className={buttonVariants()}>
              Post my flight
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {flights.data.map((f) => (
            <FlightCard key={f.id} flight={f} />
          ))}
        </div>
      )}
    </>
  );
}
