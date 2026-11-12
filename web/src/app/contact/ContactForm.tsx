"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { ErrorText, Field } from "@/components/common";
import { SUPPORT_EMAIL } from "@/components/LegalPage";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { ApiError, errorMessage, getMe, sendContact } from "@/lib/api";
import { useAsync, useQueryParam } from "@/lib/hooks";
import { useSignedIn } from "@/lib/session";
import type { ContactTopic } from "@/lib/types";

// POST /contact (api/ROUTES.md "Contact"). Prefilled when signed in; a hidden
// honeypot field catches bots. If the mailer is down, the error shows the
// support address to write to directly.

const TOPICS: { value: ContactTopic; label: string }[] = [
  { value: "general", label: "General question" },
  { value: "safety", label: "Safety report" },
  { value: "payments", label: "Payments & credit" },
  { value: "delete_data", label: "Delete my data" },
  { value: "other", label: "Other" },
];

const isTopic = (v: string | null): v is ContactTopic => TOPICS.some((t) => t.value === v);

export function ContactForm() {
  const signedIn = useSignedIn();
  const me = useAsync(getMe, signedIn ? "me" : null).data?.user;
  const topicParam = useQueryParam("topic");
  const [form, setForm] = useState<{ name?: string; email?: string; topic?: ContactTopic; message: string; website: string }>({ message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<React.ReactNode>(null);
  const [sent, setSent] = useState(false);

  // Typed values win; otherwise the signed-in user's details prefill.
  const name = form.name ?? me?.name ?? "";
  const email = form.email ?? me?.email ?? "";
  const topic = form.topic ?? (isTopic(topicParam) ? topicParam : "general");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await sendContact({ name: name.trim(), email: email.trim(), topic, message: form.message.trim(), website: form.website || undefined });
      setSent(true);
    } catch (err) {
      const down = err instanceof ApiError && (err.status === 503 || err.status >= 500);
      setError(
        down ? (
          <>
            We couldn&apos;t send your message right now. Please email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">
              {SUPPORT_EMAIL}
            </a>{" "}
            instead.
          </>
        ) : (
          errorMessage(err)
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div role="status" className="flex gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <CheckCircle2 className="size-5 shrink-0" />
        <p>Thanks, your message is on its way. We&apos;ll reply to {email} as soon as we can.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Your name" htmlFor="c-name">
        <Input id="c-name" required maxLength={120} autoComplete="name" value={name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      </Field>
      <Field label="Email" htmlFor="c-email" hint="We'll reply here.">
        <Input
          id="c-email"
          type="email"
          required
          maxLength={320}
          autoComplete="email"
          value={email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
      </Field>
      <Field label="Topic" htmlFor="c-topic">
        <select
          id="c-topic"
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          value={topic}
          onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value as ContactTopic }))}
        >
          {TOPICS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      {topic === "delete_data" ? (
        <p className="text-sm text-fg-muted">
          You can delete your account yourself, straight away, in Profile → Delete account. Use this form if you can&apos;t
          sign in.
        </p>
      ) : null}
      <Field label="Message" htmlFor="c-message">
        <Textarea
          id="c-message"
          required
          maxLength={4000}
          rows={6}
          value={form.message}
          onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
        />
      </Field>
      {/* Honeypot: hidden from people and screen readers; bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor="c-website">Website</label>
        <input id="c-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
      </div>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : null} Send message
      </Button>
    </form>
  );
}
