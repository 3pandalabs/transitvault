"use client";

import { AlertTriangle, Loader2, X } from "lucide-react";
import Link from "next/link";
import { errorMessage } from "@/lib/api";
import { useState } from "react";
import type { NeedStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge, type BadgeVariant } from "./ui/badge";
import { Button } from "./ui/button";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-fg-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 text-sm text-fg-muted" role="status">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-red-600">
      {children}
    </p>
  );
}

/** A load failure always offers a retry, never a dead end. */
export function LoadError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="my-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
      <p className="flex items-center gap-2">
        <AlertTriangle className="size-4" /> {errorMessage(error)}
      </p>
      <div className="mt-3 flex gap-2">
        {onRetry ? (
          <Button size="sm" variant="outline" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
        <Link href="/needs">
          <Button size="sm" variant="ghost">
            Back to needs
          </Button>
        </Link>
      </div>
    </div>
  );
}

/** Empty states must always offer the next action. */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-zinc-300 bg-white/70 px-6 py-10 text-center">
      {icon ? <div className="mb-3 text-fg-muted [&_svg]:size-8">{icon}</div> : null}
      <p className="font-medium text-fg">{title}</p>
      {body ? <p className="mt-1 max-w-md text-sm text-fg-muted">{body}</p> : null}
      {action ? <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <section className={cn("rounded-2xl border border-line bg-white p-5 shadow-sm", className)} {...props} />;
}

export function PanelTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-base font-semibold text-fg">{children}</h2>
      {aside}
    </div>
  );
}

const NEED: Record<NeedStatus, [string, BadgeVariant]> = {
  open: ["Looking for a companion", "info"],
  found: ["Companion found", "good"],
  closed: ["Closed", "muted"],
};

export const NeedStatusBadge = ({ status }: { status: NeedStatus }) => <Badge variant={NEED[status][1]}>{NEED[status][0]}</Badge>;

/**
 * Free-text chips (languages, flight numbers). Enter or comma adds; the
 * backspace key on an empty box removes the last one.
 */
export function ChipsInput({
  value,
  onChange,
  placeholder,
  max = 8,
  normalize = (v: string) => v.trim(),
  ariaLabel,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  max?: number;
  normalize?: (v: string) => string;
  ariaLabel: string;
}) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const v = normalize(raw);
    if (v && !value.includes(v) && value.length < max) onChange([...value, v]);
    setDraft("");
  };
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5 focus-within:ring-2 focus-within:ring-slate-400">
      {value.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-sm">
          {v}
          <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))}>
            <X className="size-3.5" />
          </button>
        </span>
      ))}
      {value.length < max ? (
        <input
          aria-label={ariaLabel}
          className="min-w-[8rem] flex-1 bg-transparent px-1 text-base outline-none md:text-sm"
          placeholder={value.length ? "" : placeholder}
          value={draft}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(",")) add(v.slice(0, -1));
            else setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => draft && add(draft)}
        />
      ) : null}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  const body = (
    <>
      {children}
      {hint ? <span className="block text-xs text-fg-muted">{hint}</span> : null}
    </>
  );
  // With an id, a sibling <label>; without one, the label wraps the control.
  return htmlFor ? (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-fg">
        {label}
      </label>
      {body}
    </div>
  ) : (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium text-fg">{label}</span>
      {body}
    </label>
  );
}
