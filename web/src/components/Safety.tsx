"use client";

import { Ban, Flag, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { blockUser, errorMessage, report, unblockUser } from "@/lib/api";
import { useAction } from "@/lib/hooks";
import type { ReportReason, ReportTarget } from "@/lib/types";
import { ErrorText, Field } from "./common";
import { Button } from "./ui/button";
import { Textarea } from "./ui/input";

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam or advertising" },
  { value: "scam", label: "Scam, or asking for money" },
  { value: "inappropriate", label: "Inappropriate or abusive" },
  { value: "other", label: "Something else" },
];

const selectClass = "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-base md:text-sm";

/** "Report" link that opens a small inline form. */
export function ReportButton({ targetType, targetId, label = "Report" }: { targetType: ReportTarget; targetId: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("spam");
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const send = useAction();

  if (done) {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm text-emerald-700">
        <ShieldCheck className="size-4" /> Thanks, we&apos;ll take a look.
      </p>
    );
  }
  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Flag /> {label}
      </Button>
    );
  }
  return (
    <form
      className="w-full space-y-3 rounded-xl border border-line bg-bg-subtle p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void send.run(async () => {
          await report({ targetType, targetId, reason, note: note.trim() || undefined });
          setDone(true);
        }, errorMessage);
      }}
    >
      <Field label="What's wrong?" htmlFor={`reason-${targetId}`}>
        <select id={`reason-${targetId}`} className={selectClass} value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Details (optional)" htmlFor={`note-${targetId}`}>
        <Textarea id={`note-${targetId}`} rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <ErrorText>{send.error}</ErrorText>
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="destructive" disabled={send.busy}>
          {send.busy ? "Sending…" : "Send report"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Block / unblock toggle. `blocked` is what the caller knows; it flips locally after success. */
export function BlockButton({
  userId,
  firstName,
  blocked: initial = false,
  onChange,
}: {
  userId: string;
  firstName: string;
  blocked?: boolean;
  onChange?: (blocked: boolean) => void;
}) {
  const [blocked, setBlocked] = useState(initial);
  const [confirming, setConfirming] = useState(false);
  const act = useAction();

  function toggle() {
    void act.run(async () => {
      if (blocked) await unblockUser(userId);
      else await blockUser(userId);
      setBlocked(!blocked);
      setConfirming(false);
      onChange?.(!blocked);
    }, errorMessage);
  }

  if (!blocked && confirming) {
    return (
      <div className="w-full space-y-2 rounded-xl border border-line bg-bg-subtle p-4 text-sm">
        <p>
          Block {firstName}? Neither of you will be able to message the other, and you won&apos;t see each other&apos;s posts. You can
          unblock from your profile.
        </p>
        <ErrorText>{act.error}</ErrorText>
        <div className="flex gap-2">
          <Button size="sm" variant="destructive" onClick={toggle} disabled={act.busy}>
            Block
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }
  return (
    <>
      <Button variant="ghost" size="sm" onClick={blocked ? toggle : () => setConfirming(true)} disabled={act.busy}>
        <Ban /> {blocked ? `Unblock ${firstName}` : `Block ${firstName}`}
      </Button>
      <ErrorText>{act.error}</ErrorText>
    </>
  );
}
