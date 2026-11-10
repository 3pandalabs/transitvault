"use client";

import { Plane, Plus } from "lucide-react";
import Link from "next/link";
import { EmptyState, LoadError, Loading, PageHeader } from "@/components/common";
import { NeedCard } from "@/components/needs";
import { buttonVariants } from "@/components/ui/button";
import { listMyNeeds } from "@/lib/api";
import { useAsync } from "@/lib/hooks";

export default function MyNeeds() {
  const needs = useAsync(listMyNeeds, "my-needs");
  return (
    <>
      <PageHeader
        title="My needs"
        subtitle="Flights you've posted, and how many people have reached out."
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
        <EmptyState
          icon={<Plane />}
          title="You haven't posted anything yet"
          body="Post a parent's flight and people on the same flight can reach out."
          action={
            <Link href="/needs/new" className={buttonVariants()}>
              Post a need
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {needs.data.map((n) => (
            <NeedCard key={n.id} need={n} showStatus />
          ))}
        </div>
      )}
    </>
  );
}
