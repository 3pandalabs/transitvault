"use client";

import { Plane, Plus, SearchX } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { BoardFilters, useBoardQuery } from "@/components/BoardFilters";
import { EmptyState, LoadError, Loading, PageHeader } from "@/components/common";
import { NeedCard } from "@/components/needs";
import { buttonVariants } from "@/components/ui/button";
import { listNeeds } from "@/lib/api";
import { useAsync } from "@/lib/hooks";

export default function NeedsBoard() {
  return (
    <Suspense fallback={<Loading />}>
      <Board />
    </Suspense>
  );
}

function Board() {
  const query = useBoardQuery();
  const needs = useAsync(() => listNeeds(query), `needs?${query}`);
  return (
    <>
      <PageHeader
        title="Travellers looking for a companion"
        subtitle="If you're on one of these flights, reach out. A friendly face at the gate or the layover makes a big difference."
        actions={
          <Link href="/needs/new" className={buttonVariants()}>
            <Plus /> Post a need
          </Link>
        }
      />
      <BoardFilters key={query} />
      {needs.error ? (
        <LoadError error={needs.error} onRetry={needs.reload} />
      ) : !needs.data ? (
        <Loading />
      ) : needs.data.length === 0 && query ? (
        <EmptyState icon={<SearchX />} title="Nothing matches these filters" body="Try a nearby date, or clear a filter or two." />
      ) : needs.data.length === 0 ? (
        <EmptyState
          icon={<Plane />}
          title="No open needs right now"
          body="When someone posts a parent's flight, it shows up here."
          action={
            <Link href="/needs/new" className={buttonVariants()}>
              Post a need
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {needs.data.map((n) => (
            <NeedCard key={n.id} need={n} />
          ))}
        </div>
      )}
    </>
  );
}
