"use client";

import { useParams, useRouter } from "next/navigation";
import { LoadError, Loading, PageHeader } from "@/components/common";
import { FlightForm } from "@/components/FlightForm";
import { getFlight, updateFlight } from "@/lib/api";
import { useAsync } from "@/lib/hooks";

export default function EditFlight() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const flight = useAsync(() => getFlight(id), `flight:${id}`);

  if (flight.error) return <LoadError error={flight.error} onRetry={flight.reload} />;
  if (!flight.data) return <Loading />;
  const f = flight.data;
  if (!f.mine) return <LoadError error={new Error("Only the person who posted this can edit it.")} />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Edit my flight" />
      <FlightForm
        submitLabel="Save changes"
        initial={{ legs: f.legs, languages: f.languages, note: f.note ?? undefined }}
        onSubmit={async (input) => {
          await updateFlight(id, input);
          router.push(`/flights/${id}`);
        }}
      />
    </div>
  );
}
