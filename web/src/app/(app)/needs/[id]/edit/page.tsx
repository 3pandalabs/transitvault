"use client";

import { useParams, useRouter } from "next/navigation";
import { LoadError, Loading, PageHeader } from "@/components/common";
import { NeedForm } from "@/components/NeedForm";
import { getNeed, updateNeed } from "@/lib/api";
import { useAsync } from "@/lib/hooks";

export default function EditNeed() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const need = useAsync(() => getNeed(id), `need:${id}`);

  if (need.error) return <LoadError error={need.error} onRetry={need.reload} />;
  if (!need.data) return <Loading />;
  const n = need.data;
  if (!n.mine) return <LoadError error={new Error("Only the person who posted this can edit it.")} />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Edit need" />
      <NeedForm
        submitLabel="Save changes"
        initial={{
          travelerLabel: n.travelerLabel,
          travelerAge: n.travelerAge ?? undefined,
          languages: n.languages,
          assistance: n.assistance ?? undefined,
          notes: n.notes ?? undefined,
          legs: n.legs,
        }}
        onSubmit={async (input) => {
          await updateNeed(id, input);
          router.push(`/needs/${id}`);
        }}
      />
    </div>
  );
}
