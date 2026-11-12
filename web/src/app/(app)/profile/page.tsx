"use client";

import { Bell, BellOff, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ErrorText, Field, LoadError, Loading, PageHeader, Panel, PanelTitle } from "@/components/common";
import { CreditPanel } from "@/components/PaidHelp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage, listBlocks, unblockUser, updateMe } from "@/lib/api";
import { PHONE_RE } from "@/lib/format";
import { useAction, useAsync } from "@/lib/hooks";
import { useSession } from "@/lib/session";

export default function Profile() {
  const { user, setMe } = useSession();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [saved, setSaved] = useState(false);
  const save = useAction();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    void save.run(async () => {
      const p = phone.replace(/[\s\-()]/g, "");
      if (!name.trim()) throw new Error("Enter your name.");
      if (!PHONE_RE.test(p)) throw new Error("Enter a phone number with 10–15 digits, e.g. +14155550123.");
      setMe(await updateMe({ name: name.trim(), phone: p }));
      setSaved(true);
    }, errorMessage);
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <PageHeader title="Profile" subtitle={user.email} />
      <Panel>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Name" htmlFor="name" hint="Others only see your first name.">
            <Input id="name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Phone" htmlFor="phone" hint="Never shown to other people. Share it in a message if you want to.">
            <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <ErrorText>{save.error}</ErrorText>
          {saved ? <p className="text-sm text-emerald-700">Saved.</p> : null}
          <Button type="submit" disabled={save.busy}>
            {save.busy ? "Saving…" : "Save"}
          </Button>
        </form>
      </Panel>
      <CreditPanel />
      <AlertsPanel />
      <BlockedPanel />
      <DeleteAccountPanel />
    </div>
  );
}

function AlertsPanel() {
  const { user, setMe } = useSession();
  const act = useAction();
  const on = user.alertsEnabled;
  return (
    <Panel>
      <PanelTitle>Match alerts</PanelTitle>
      <p className="text-sm text-fg-muted">
        Email me when someone posts a need on a flight I&apos;m taking, or offers to help on my parent&apos;s flight.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <Button
          variant={on ? "default" : "outline"}
          disabled={act.busy}
          onClick={() => void act.run(async () => setMe(await updateMe({ alertsEnabled: !on })), errorMessage)}
          aria-pressed={on}
        >
          {on ? <Bell /> : <BellOff />} {on ? "Alerts on" : "Alerts off"}
        </Button>
        <span className="text-sm text-fg-muted">{on ? "Tap to turn off." : "Tap to turn on."}</span>
      </div>
      <ErrorText>{act.error}</ErrorText>
    </Panel>
  );
}

function BlockedPanel() {
  const blocks = useAsync(listBlocks, "blocks");
  const act = useAction();
  return (
    <Panel>
      <PanelTitle>Blocked people</PanelTitle>
      {blocks.error ? (
        <LoadError error={blocks.error} onRetry={blocks.reload} />
      ) : !blocks.data ? (
        <Loading />
      ) : blocks.data.length === 0 ? (
        <p className="text-sm text-fg-muted">You haven&apos;t blocked anyone.</p>
      ) : (
        <ul className="divide-y divide-line">
          {blocks.data.map((b) => (
            <li key={b.userId} className="flex items-center justify-between gap-3 py-2">
              <span>{b.firstName}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={act.busy}
                onClick={() =>
                  void act.run(async () => {
                    await unblockUser(b.userId);
                    blocks.reload();
                  }, errorMessage)
                }
              >
                Unblock
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ErrorText>{act.error}</ErrorText>
    </Panel>
  );
}

function DeleteAccountPanel() {
  return (
    <Panel>
      <PanelTitle>Delete account</PanelTitle>
      <p className="text-sm text-fg-muted">
        Permanently delete your TransitVault account. Your posts leave the boards and you&apos;re signed out everywhere.
      </p>
      <Link
        href="/profile/delete"
        className="mt-3 inline-flex h-10 items-center gap-2 rounded-full border border-rose-300 bg-white px-4 text-sm font-medium text-rose-700 hover:bg-rose-50"
      >
        <Trash2 className="size-4" /> Delete my account
      </Link>
    </Panel>
  );
}
