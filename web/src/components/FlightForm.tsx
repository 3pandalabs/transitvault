"use client";

import { HandHeart } from "lucide-react";
import { useState } from "react";
import { errorMessage } from "@/lib/api";
import { useAction } from "@/lib/hooks";
import type { FlightInput, Leg } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChipsInput, ErrorText, Field, Panel, PanelTitle } from "./common";
import { emptyLeg, legsProblem, LegsEditor } from "./LegsEditor";
import { Button } from "./ui/button";
import { Textarea } from "./ui/input";

const titleCase = (v: string) => v.trim().replace(/\s+/g, " ").replace(/\b\p{L}/gu, (c) => c.toUpperCase());

/** "I'm flying" post: the traveller's own flights, languages and a note. */
export function FlightForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: FlightInput;
  submitLabel: string;
  onSubmit: (input: FlightInput) => Promise<unknown>;
}) {
  const [languages, setLanguages] = useState<string[]>(initial?.languages ?? []);
  const [note, setNote] = useState(initial?.note ?? "");
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
      if (!languages.length) throw new Error("Add at least one language you speak.");
      const problem = legsProblem(legs);
      if (problem) throw new Error(problem);
      await onSubmit({ legs, languages, note: note.trim() || undefined });
    }, errorMessage);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <HandHeart className="size-5 shrink-0" />
        <p>
          Post your flight once. We&apos;ll email you when a family needs a companion on it, and families on your flight can
          ask you directly. Your post shows your first name only.
        </p>
      </div>

      <Panel>
        <PanelTitle>Your flights</PanelTitle>
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
              className={cn("rounded-full px-4 py-1.5 text-sm", connecting === o.on ? "bg-white font-medium text-fg shadow-sm" : "text-fg-muted")}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="mb-3 text-sm text-fg-muted">Enter each flight as printed on your ticket. Times are local to each airport.</p>
        <LegsEditor legs={legs} onChange={setLegs} />
      </Panel>

      <Panel className="space-y-4">
        <Field label="Languages you speak" hint="Type a language and press Enter.">
          <ChipsInput ariaLabel="Add a language" value={languages} onChange={setLanguages} normalize={titleCase} placeholder="Hindi" />
        </Field>
        <Field label="Note (optional)" htmlFor="note">
          <Textarea
            id="note"
            maxLength={1000}
            placeholder="e.g. Happy to help at the Frankfurt layover and with the immigration form."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </Panel>

      <ErrorText>{save.error}</ErrorText>
      <Button type="submit" size="lg" disabled={save.busy}>
        {save.busy ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
