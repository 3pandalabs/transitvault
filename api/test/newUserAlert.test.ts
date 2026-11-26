import { afterEach, describe, expect, it, vi } from "vitest";

// Keep this a pure-unit test: the real mailer imports env.ts.
const configured = vi.hoisted(() => ({ value: true }));
vi.mock("../src/lib/mailer.js", () => ({
  mailerConfigured: () => configured.value,
  sendMail: vi.fn(async () => ({ delivered: 1, failed: 0, skipped: 0 })),
}));

import { newUserAlertTo, newUserMail, notifyNewUser } from "../src/lib/newUserAlert.js";
import { tombstoneEmail } from "../src/lib/deletion.js";
import type { Mail } from "../src/lib/mailer.js";

const ID = "7d3c5a8e-1f2b-4c6d-9e0a-123456789abc";
const user = { id: ID, email: "asha@example.com", name: "Asha <Rao>", createdAt: new Date("2026-11-26T13:05:42Z") };

afterEach(() => {
  vi.unstubAllEnvs();
  configured.value = true;
});

describe("new user alert", () => {
  it("subject is exactly 'TransitVault New user' and the body names the account", () => {
    const m = newUserMail("ops@example.com", user);
    expect(m.subject).toBe("TransitVault New user");
    expect(m.to).toBe("ops@example.com");
    expect(m.from).toBeUndefined(); // default EMAIL_FROM_ADDRESS
    expect(m.text).toContain("App: TransitVault");
    expect(m.text).toContain("Email: asha@example.com");
    expect(m.text).toContain("Name: Asha <Rao>");
    expect(m.text).toContain("Signed up: 2026-11-26 13:05 UTC");
    expect(m.text).toContain(`User id: ${ID}`);
    expect(m.html).toContain("Asha &lt;Rao&gt;");
    expect(m.html).not.toContain("<Rao>");
  });

  it("leaves out an empty name", () => {
    expect(newUserMail("ops@example.com", { ...user, name: "" }).text).not.toContain("Name:");
  });

  it("goes to the org inbox by default, an override, or nowhere when off", () => {
    vi.stubEnv("NEW_USER_ALERT_EMAIL", "");
    expect(newUserAlertTo()).toBe("3pandas@3pandalabs.com");
    vi.stubEnv("NEW_USER_ALERT_EMAIL", " x@example.com ");
    expect(newUserAlertTo()).toBe("x@example.com");
    vi.stubEnv("NEW_USER_ALERT_EMAIL", "OFF");
    expect(newUserAlertTo()).toBeNull();
  });

  it("sends one alert, and sends nothing when off, unconfigured or for a placeholder email", () => {
    const send = vi.fn(async (_m: Mail[], _l: (msg: string) => void) => ({ delivered: 1, failed: 0, skipped: 0 }));
    const log = vi.fn();
    notifyNewUser(user, log, send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0][0]).toMatchObject({ to: "3pandas@3pandalabs.com", subject: "TransitVault New user" });

    vi.stubEnv("NEW_USER_ALERT_EMAIL", "off");
    notifyNewUser(user, log, send);
    vi.unstubAllEnvs();
    configured.value = false;
    notifyNewUser(user, log, send);
    configured.value = true;
    notifyNewUser({ ...user, email: tombstoneEmail(ID) }, log, send);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("never throws into the sign-up: a failed send only logs", async () => {
    const log = vi.fn();
    expect(() => notifyNewUser(user, log, () => Promise.reject(new Error("smtp down")))).not.toThrow();
    expect(() =>
      notifyNewUser(user, log, () => {
        throw new Error("sync boom");
      }),
    ).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(log.mock.calls.map((c) => c[0]).join("\n")).toMatch(/new user alert failed: .*smtp down/);
    expect(log.mock.calls.map((c) => c[0]).join("\n")).toMatch(/sync boom/);
  });
});
