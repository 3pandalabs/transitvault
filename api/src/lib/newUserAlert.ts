import { isTombstoneEmail } from "./deletion.js";
import { mailerConfigured, sendMail, type Mail } from "./mailer.js";

// "TransitVault New user" email to the org inbox whenever someone signs up
// (2026-11-26, owner request; same shape as AdVault's lib/newUserAlert.ts).
// The only place a user row is created is POST /auth/signup, and only a row
// the insert actually created alerts (a taken email returns 409 and sends
// nothing). There are no seed, admin or backfill paths.
//
// Fire-and-forget: never awaited by the sign-up, never throws into it; a send
// failure only logs. Sent through the app's normal sendMail (SMTP, gateway
// fallback) from the default EMAIL_FROM_ADDRESS.
// NEW_USER_ALERT_EMAIL overrides the recipient; "off" turns the alert off.

export const DEFAULT_NEW_USER_ALERT_EMAIL = "3pandas@3pandalabs.com";

export function newUserAlertTo(): string | null {
  const v = process.env.NEW_USER_ALERT_EMAIL?.trim();
  if (v?.toLowerCase() === "off") return null;
  return v || DEFAULT_NEW_USER_ALERT_EMAIL;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim().slice(0, 200);

export type NewUser = { id: string; email: string; name?: string | null; createdAt?: Date | null };

export function newUserMail(to: string, u: NewUser, now = new Date()): Mail {
  const at = (u.createdAt ?? now).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const name = u.name ? oneLine(u.name) : "";
  const rows: [string, string][] = [
    ["App", "TransitVault"],
    ["Email", oneLine(u.email)],
    ...(name ? ([["Name", name]] as [string, string][]) : []),
    ["Signed up", at],
    ["User id", u.id],
  ];
  return {
    to,
    subject: "TransitVault New user",
    text: `New TransitVault sign-up.\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n`,
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1f2937;max-width:560px;">
  <p style="font-size:15px;"><b>New TransitVault sign-up</b></p>
  <table style="font-size:14px;border-collapse:collapse;">${rows
    .map(([k, v]) => `<tr><td style="color:#6b7280;padding:2px 12px 2px 0;">${esc(k)}</td><td>${esc(v)}</td></tr>`)
    .join("")}</table>
</div>`,
  };
}

/** Sends the alert in the background. Never throws, never awaited by the sign-up. */
export function notifyNewUser(u: NewUser, log: (msg: string) => void, send: typeof sendMail = sendMail): void {
  try {
    const to = newUserAlertTo();
    if (!to || isTombstoneEmail(u.email) || !mailerConfigured()) return;
    void send([newUserMail(to, u)], log).catch((err) => log(`new user alert failed: ${String(err)}`));
  } catch (err) {
    log(`new user alert failed: ${String(err)}`);
  }
}
