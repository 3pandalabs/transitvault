"use client";

import { ShieldAlert } from "lucide-react";
import { useState } from "react";
import { errorMessage } from "@/lib/api";
import { useAction } from "@/lib/hooks";
import type { Leg, NeedInput } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChipsInput, ErrorText, Field, Panel, PanelTitle } from "./common";
import { emptyLeg, legsProblem, LegsEditor } from "./LegsEditor";
import { Button } from "./ui/button";
import { Input, Textarea } from "./ui/input";

const titleCase = (v: string) => v.trim().replace(/\s+/g, " ").replace(/\b\p{L}/gu, (c) => c.toUpperCase());

export function NeedForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: NeedInput;
  submitLabel: string;
  onSubmit: (input: NeedInput) => Promise<unknown>;
}) {
  const [travelerLabel, setTravelerLabel] = useState(initial?.travelerLabel ?? "");
  const [age, setAge] = useState(initial?.travelerAge ? String(initial.travelerAge) : "");
  const [languages, setLanguages] = useState<string[]>(initial?.languages ?? []);
  const [assistance, setAssistance] = useState(initial?.assistance ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [legs, setLegs] = useState<Leg[]>(initial?.legs ?? [emptyLeg()]);
  const save = useAction();

  const connecting = legs.length > 1;
  function setConnecting(on: boolean) {
    if (on && legs.length === 1) setLegs([...legs, emptyLeg(legs[0].to)]);
    if (!on) setLegs(legs.slice(0, 1));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    void save.run(async () => {
      if (!travelerLabel.trim()) throw new Error("Say who is travelling, e.g. “My mother”.");
      const ageNum = age ? Number(age) : undefined;
      if (ageNum !== undefined && (!Number.isInteger(ageNum) || ageNum < 1 || ageNum > 120)) throw new Error("Age should be a whole number.");
      if (!languages.length) throw new Error("Add at least one language they speak.");
      const problem = legsProblem(legs);
      if (problem) throw new Error(problem);
      await onSubmit({
        travelerLabel: travelerLabel.trim(),
        travelerAge: ageNum,
        languages,
        assistance: assistance.trim() || undefined,
        notes: notes.trim() || undefined,
        legs,
      });
    }, errorMessage);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <ShieldAlert className="size-5 shrink-0" />
        <p>
          Your post is visible to everyone signed in to TransitVault. Don&apos;t put full names, phone numbers, booking
          references or passport details here. Share contact details in messages, only with people you choose.
        </p>
      </div>

      <Panel>
        <PanelTitle>Who is travelling</PanelTitle>
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <Field label="Who is travelling" htmlFor="label" hint="For example “My mother” or “Dad”.">
            <Input id="label" maxLength={80} value={travelerLabel} onChange={(e) => setTravelerLabel(e.target.value)} />
          </Field>
          <Field label="Age (optional)" htmlFor="age">
            <Input id="age" inputMode="numeric" maxLength={3} value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, ""))} />
          </Field>
        </div>
        <div className="mt-4 space-y-4">
          <Field label="Languages they speak" hint="Type a language and press Enter, e.g. Hindi, Punjabi, English.">
            <ChipsInput ariaLabel="Add a language" value={languages} onChange={setLanguages} normalize={titleCase} placeholder="Hindi" />
          </Field>
          <Field label="Help needed (optional)" htmlFor="assistance">
            <Textarea
              id="assistance"
              maxLength={1000}
              placeholder="e.g. Needs a wheelchair at Frankfurt, help with the immigration form, doesn't read English."
              value={assistance}
              onChange={(e) => setAssistance(e.target.value)}
            />
          </Field>
        </div>
      </Panel>

      <Panel>
        <PanelTitle>Flights</PanelTitle>
        <div className="mb-4 inline-flex rounded-full border border-line bg-bg-subtle p-1" role="radiogroup" aria-label="Direct or connecting">
          {[
            { on: false, label: "Direct flight" },
            { on: true, label: "Connecting / layover" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={connecting === o.on}
              onClick={() => setConnecting(o.on)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm",
                connecting === o.on ? "bg-white font-medium text-fg shadow-sm" : "text-fg-muted",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="mb-3 text-sm text-fg-muted">
          Enter each flight as printed on the ticket. Times are local to each airport.
        </p>
        <LegsEditor legs={legs} onChange={setLegs} />
      </Panel>

      <Panel>
        <Field label="Anything else (optional)" htmlFor="notes">
          <Textarea id="notes" maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </Panel>

      <ErrorText>{save.error}</ErrorText>
      <Button type="submit" size="lg" disabled={save.busy}>
        {save.busy ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
