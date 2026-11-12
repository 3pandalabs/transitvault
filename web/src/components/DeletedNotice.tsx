"use client";

import { CheckCircle2 } from "lucide-react";
import { useQueryParam } from "@/lib/hooks";

/** Landing-page banner after self-service account deletion (`/?deleted=1`). */
export function DeletedNotice() {
  if (useQueryParam("deleted") !== "1") return null;
  return (
    <div role="status" className="mt-6 flex gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
      <CheckCircle2 className="size-5 shrink-0" />
      <p>Your TransitVault account has been deleted and you&apos;ve been signed out. Thank you for being part of it.</p>
    </div>
  );
}
