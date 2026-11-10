"use client";

import { useState } from "react";
import { ErrorText, Field, PageHeader, Panel } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage, updateMe } from "@/lib/api";
import { PHONE_RE } from "@/lib/format";
import { useAction } from "@/lib/hooks";
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
    <div className="mx-auto max-w-lg">
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
    </div>
  );
}
