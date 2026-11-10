"use client";

import { Check, Copy, PartyPopper, Share2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { publicNeedUrl, shareMessage, shareQuestion, whatsappUrl } from "@/lib/share";
import type { NeedSummary } from "@/lib/types";
import { Panel, PanelTitle } from "./common";
import { Button, buttonVariants } from "./ui/button";

const noop = () => () => undefined;

/** WhatsApp, copy link and the native share sheet for a need's public preview. */
export function ShareNeed({ need, justPosted = false }: { need: NeedSummary; justPosted?: boolean }) {
  const [copied, setCopied] = useState(false);
  const canShare = useSyncExternalStore(noop, () => typeof navigator.share === "function", () => false);
  const message = shareMessage(need);
  const url = publicNeedUrl(need.id);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", url);
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: shareQuestion(need), text: message.replace(url, "").trim(), url });
    } catch {
      // cancelled
    }
  }

  return (
    <Panel className={justPosted ? "border-emerald-300 bg-emerald-50/60" : undefined}>
      <PanelTitle>
        {justPosted ? (
          <span className="inline-flex items-center gap-2">
            <PartyPopper className="size-5 text-emerald-700" /> Posted! Now share it
          </span>
        ) : (
          "Share this need"
        )}
      </PanelTitle>
      <p className="text-sm text-fg-muted">
        The fastest way to find someone is your own groups: family, community and alumni WhatsApp groups, and Facebook
        groups for your city. The link shows the flights and languages only, not the age, help notes or your name.
      </p>
      <p className="mt-3 rounded-lg bg-white p-3 text-sm italic text-fg">{message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={whatsappUrl(message)} target="_blank" rel="noopener noreferrer" className={buttonVariants({ className: "bg-[#25D366] text-white" })}>
          <WhatsAppIcon /> Share on WhatsApp
        </a>
        <Button variant="outline" onClick={copy}>
          {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy link"}
        </Button>
        {canShare ? (
          <Button variant="outline" onClick={nativeShare}>
            <Share2 /> More…
          </Button>
        ) : null}
      </div>
    </Panel>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  );
}
