"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/common";
import { NeedForm } from "@/components/NeedForm";
import { createNeed } from "@/lib/api";

export default function NewNeed() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Post a need"
        subtitle="Someone travelling alone? Add their flights. People on the same flight or layover can reach out to you."
      />
      <NeedForm
        submitLabel="Post need"
        onSubmit={async (input) => {
          const need = await createNeed(input);
          router.push(`/needs/${need.id}?posted=1`);
        }}
      />
    </div>
  );
}
