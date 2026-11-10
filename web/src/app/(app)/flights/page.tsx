"use client";

import { HandHeart, Plus, SearchX } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { BoardFilters, useBoardQuery } from "@/components/BoardFilters";
import { EmptyState, LoadError, Loading, PageHeader } from "@/components/common";
import { FlightCard } from "@/components/flights";
import { buttonVariants } from "@/components/ui/button";
import { listFlights } from "@/lib/api";
import { useAsync } from "@/lib/hooks";

export default function FlightsBoard() {
  return (
    <Suspense fallback={<Loading />}>
      <Board />
    </Suspense>
  );
}

function Board() {
  const query = useBoardQuery();
  const flights = useAsync(() => listFlights(query), `flights?${query}`);
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
      <BoardFilters key={query} />
      {flights.error ? (
        <LoadError error={flights.error} onRetry={flights.reload} />
      ) : !flights.data ? (
        <Loading />
      ) : flights.data.length === 0 && query ? (
        <EmptyState icon={<SearchX />} title="Nothing matches these filters" body="Try a nearby date, or clear a filter or two." />
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
