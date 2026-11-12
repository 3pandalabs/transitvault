// End-to-end scenarios for paid help, the poster nudges, account deletion and the contact form, run locally
// against the real HTTP API (infra/README.md "Local scenarios").
//
//   npm run scenarios                 # report → api/scenario-report/ (gitignored)
//   npm run scenarios -- --out <dir>  # report somewhere else
//
// What it starts, all throwaway and all torn down at the end (even on failure):
//   - a Postgres container (`transitvault-scenarios-pg`, no named volume; removed with `docker rm -f -v`)
//     on SCENARIOS_PG_PORT (default 5438, the repo's dev port; stop your dev DB first)
//   - an in-process mock Stripe (Checkout Sessions + Refunds) and a mock mail
//     gateway that captures every email (SMTP is forced off, so nothing real is sent)
//   - the API (`node --import tsx src/index.ts`) on SCENARIOS_API_PORT (default 8099)
//     with PAYMENTS_ENABLED=true and a local webhook secret
//
// Time is simulated by shifting the stored leg times / acceptance times in the
// throwaway DB, then calling the hourly sweeps directly (sweepPaidHelp,
// sweepNudges) instead of waiting an hour. Webhooks are signed with the local
// secret exactly like Stripe does. Exit code 1 if any check fails.

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import pg from "pg";
import { signPayload } from "../src/lib/stripe.js";

const API_DIR = resolve(import.meta.dirname, "..");
const PG_PORT = Number(process.env.SCENARIOS_PG_PORT ?? 5438);
const API_PORT = Number(process.env.SCENARIOS_API_PORT ?? 8099);
const CONTAINER = "transitvault-scenarios-pg";
const outArg = process.argv.indexOf("--out");
const OUT_DIR = resolve(outArg > 0 ? process.argv[outArg + 1] : join(API_DIR, "scenario-report"));
const DB_URL = `postgres://transitvault:transitvault@localhost:${PG_PORT}/transitvault`;
const WEBHOOK_SECRET = "whsec_local_scenarios";
const API = `http://localhost:${API_PORT}`;
const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;

// ---- recording -----------------------------------------------------------------

type Mail = { n: number; scenario: string; step: string; to: string; subject: string; html: string; text: string; file: string; replyTo?: string };
type Check = { scenario: string; name: string; pass: boolean; detail: string };
type ScenarioInfo = { key: string; title: string; facts: string[] };

const mails: Mail[] = [];
const checks: Check[] = [];
const scenarios: ScenarioInfo[] = [];
let scenario = "setup";
let step = "setup";

function begin(key: string, title: string) {
  scenario = key;
  scenarios.push({ key, title, facts: [] });
}
const fact = (s: string) => scenarios.at(-1)!.facts.push(s);
function check(name: string, pass: boolean, detail = "") {
  checks.push({ scenario, name, pass, detail });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}
const mailsSince = (i: number) => mails.slice(i);

/** Waits until no email has arrived for 400 ms (the API sends fire-and-forget). */
async function settle() {
  let last = -1;
  for (let i = 0; i < 20 && last !== mails.length; i++) {
    last = mails.length;
    await sleep(400);
  }
}

// ---- mocks: Stripe + mail gateway ------------------------------------------------

type Session = { id: string; amount: number; acceptanceId: string; email: string };
const sessions = new Map<string, Session>();
const byIdempotencyKey = new Map<string, Session>();
const refunds: { id: string; paymentIntent: string }[] = [];

const readBody = (req: IncomingMessage) =>
  new Promise<string>((ok) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => ok(b));
  });

function startMocks(): Promise<Server> {
  const server = createServer(async (req, res) => {
    const body = await readBody(req);
    const json = (status: number, v: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(v));
    };
    if (req.url === "/v1/checkout/sessions" && req.method === "POST") {
      const f = new URLSearchParams(body);
      const key = String(req.headers["idempotency-key"] ?? "");
      let s = byIdempotencyKey.get(key);
      if (!s) {
        s = {
          id: `cs_test_${sessions.size + 1}`,
          amount: Number(f.get("line_items[0][price_data][unit_amount]")),
          acceptanceId: f.get("metadata[acceptance_id]") ?? "",
          email: f.get("customer_email") ?? "",
        };
        sessions.set(s.id, s);
        if (key) byIdempotencyKey.set(key, s);
      }
      return json(200, { id: s.id, url: `https://checkout.mock/${s.id}` });
    }
    if (req.url === "/v1/refunds" && req.method === "POST") {
      const r = { id: `re_test_${refunds.length + 1}`, paymentIntent: new URLSearchParams(body).get("payment_intent") ?? "" };
      refunds.push(r);
      return json(200, { id: r.id, status: "succeeded" });
    }
    if (req.url === "/send" && req.method === "POST") {
      const p = JSON.parse(body) as { messages: { to: string; subject: string; html: string; text: string; replyTo?: string }[] };
      for (const m of p.messages) {
        const n = mails.length + 1;
        const slug = m.subject.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50).replace(/-$/, "");
        mails.push({ n, scenario, step, ...m, file: `emails/${String(n).padStart(2, "0")}-${slug}.html` });
      }
      return json(200, { delivered: p.messages.length, failed: 0 });
    }
    json(404, { error: { message: `mock: no route ${req.method} ${req.url}` } });
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

// ---- infrastructure ----------------------------------------------------------------

function docker(args: string[], quiet = false) {
  const r = spawnSync("docker", args, { encoding: "utf8" });
  if (r.status !== 0 && !quiet) throw new Error(`docker ${args.join(" ")}: ${r.stderr || r.stdout}`);
  return r;
}

async function startPostgres() {
  docker(["rm", "-f", "-v", CONTAINER], true);
  docker([
    "run", "-d", "--rm", "--name", CONTAINER,
    "-e", "POSTGRES_USER=transitvault", "-e", "POSTGRES_PASSWORD=transitvault", "-e", "POSTGRES_DB=transitvault",
    "-p", `${PG_PORT}:5432`, "postgres:17-alpine",
  ]);
  for (let i = 0; i < 60; i++) {
    // pg_isready over TCP: the image's init phase only listens on the socket.
    if (docker(["exec", CONTAINER, "pg_isready", "-h", "127.0.0.1", "-U", "transitvault"], true).status === 0) return;
    await sleep(1000);
  }
  throw new Error("postgres did not become ready");
}

function apiEnv(mockBase: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DATABASE_URL: DB_URL,
    PORT: String(API_PORT),
    JWT_SECRET: "scenarios-jwt-secret-0123456789abcdef",
    WEB_ORIGIN: "http://localhost:3000",
    // Mail: SMTP forced off (dotenv never overrides a set var), gateway = the mock.
    SMTP_USER: "",
    SMTP_PASS: "",
    MAILER_URL: mockBase,
    MAILER_TOKEN: "scenarios",
    PAYMENTS_ENABLED: "true",
    STRIPE_SECRET_KEY: "sk_test_scenarios",
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    STRIPE_API_BASE: mockBase,
    OPS_TOKEN: "",
    METRICS_TOKEN: "",
    LOG_LEVEL: "warn",
  };
}

function run(args: string[], env: NodeJS.ProcessEnv) {
  const r = spawnSync(process.execPath, args, { cwd: API_DIR, env, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`node ${args.join(" ")} failed: ${r.stderr || r.stdout}`);
}

async function startApi(env: NodeJS.ProcessEnv): Promise<ChildProcess> {
  const child = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], { cwd: API_DIR, env, stdio: ["ignore", "ignore", "pipe"] });
  child.stderr?.on("data", (d) => process.stderr.write(`[api] ${d}`));
  for (let i = 0; i < 60; i++) {
    if (child.exitCode !== null) throw new Error("API exited at startup");
    try {
      if ((await fetch(`${API}/health`)).ok) return child;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  throw new Error("API did not start");
}

// ---- HTTP helpers --------------------------------------------------------------------

type User = { id: string; email: string; name: string; token: string };

async function call<T = any>(method: string, path: string, token: string | null, body?: unknown, expect = [200, 201]): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!expect.includes(res.status)) throw new Error(`${method} ${path} → ${res.status} ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}

async function signup(i: number, name: string): Promise<User> {
  const email = `user${i}@scenarios.test`;
  const r = await call("POST", "/auth/signup", null, { email, password: "scenarios-password", name, phone: `+1555000000${i}` });
  return { id: r.user.id, email, name, token: r.accessToken };
}

async function webhookPaid(sessionId: string) {
  const s = sessions.get(sessionId)!;
  const event = {
    id: `evt_${sessionId}`,
    type: "checkout.session.completed",
    data: { object: { id: s.id, payment_status: "paid", payment_intent: `pi_${s.id}`, client_reference_id: s.acceptanceId, metadata: { acceptance_id: s.acceptanceId } } },
  };
  const raw = JSON.stringify(event);
  const res = await fetch(`${API}/stripe/webhook`, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": signPayload(raw, WEBHOOK_SECRET) }, body: raw });
  return (await res.json()) as { received: boolean; result: string };
}

const credits = (u: User) => call<{ balanceCents: number; entries: { amountCents: number; reason: string }[] }>("GET", "/me/credits", u.token);
const sessionIdOf = (url: string | null) => (url ?? "").split("/").pop()!;
const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

// ---- simulated time: legs whose REAL first departure is a given instant ----------------
// DEL (UTC+5:30) → FRA (UTC+1 in Nov–Mar, +2 in summer) → ORD (UTC−6 / −5). The
// wall-clock is computed with the same Intl zone rules lib/landing.ts uses.

function wall(utcMs: number, zone: string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(utcMs))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`;
}

function legsDepartingAt(depMs: number) {
  const d = Math.floor(depMs / 60_000) * 60_000;
  return [
    { flightNumber: "LH761", from: "DEL", to: "FRA", departsAt: wall(d, "Asia/Kolkata"), arrivesAt: wall(d + 8 * HOUR, "Europe/Berlin") },
    { flightNumber: "LH430", from: "FRA", to: "ORD", departsAt: wall(d + 10 * HOUR, "Europe/Berlin"), arrivesAt: wall(d + 19 * HOUR, "America/Chicago") },
  ];
}

let db: pg.Pool | undefined;
async function moveTrip(needId: string, depMs: number) {
  const legs = legsDepartingAt(depMs);
  await db!.query("update needs set legs = $2::jsonb, travel_date = $3 where id = $1", [needId, JSON.stringify(legs), legs[0].departsAt.slice(0, 10)]);
  return legs;
}

async function postNeed(u: User, label: string, depMs: number) {
  return call("POST", "/needs", u.token, { travelerLabel: label, languages: ["Hindi"], assistance: "Wheelchair at FRA", legs: legsDepartingAt(depMs) });
}

// ---- the sweeps, called directly (imported after env is set) ---------------------------

type Sweeps = { sweepPaidHelp: (log: any) => Promise<unknown>; sweepNudges: (log: any) => Promise<{ noHelper: number; nudged: number }> };
let sweeps: Sweeps;
const quietLog: any = { info() {}, warn() {}, error() {}, debug() {}, trace() {}, fatal() {}, child: () => quietLog };

// ---- scenarios -----------------------------------------------------------------------

async function paidTrip(o: { poster: User; helper: User; label: string; declineReward: boolean }) {
  const need = await postNeed(o.poster, o.label, Date.now() + 7 * DAY);
  step = `${o.helper.name} reaches out`;
  const conv = await call("POST", `/needs/${need.id}/reach-out`, o.helper.token, {
    message: "I'm on LH761 and LH430 too, happy to help.",
    myFlightNumbers: ["LH761", "LH430"],
    ...(o.declineReward ? { declineReward: true } : {}),
  });
  step = `${o.poster.name} accepts`;
  const acc = await call("POST", `/conversations/${conv.id}/accept`, o.poster.token);
  const sid = sessionIdOf(acc.checkoutUrl);
  const s = sessions.get(sid);
  check("accept returns a Stripe Checkout URL", Boolean(acc.checkoutUrl && s), acc.checkoutUrl ?? "none");
  check("Checkout amount is $10 (no credit to apply)", s?.amount === 1000, s ? usd(s.amount) : "no session");
  check("acceptance is pending_payment before the webhook", acc.conversation.acceptance?.status === "pending_payment");
  step = "Stripe webhook: checkout.session.completed";
  const wh = await webhookPaid(sid);
  check("signed webhook confirms", wh.result === "confirmed", wh.result);
  const replay = await webhookPaid(sid);
  check("webhook replay is a no-op", replay.result === "noop", replay.result);
  await settle();
  const c1 = await call("GET", `/conversations/${conv.id}`, o.poster.token);
  const n1 = await call("GET", `/needs/${need.id}`, o.poster.token);
  check("acceptance confirmed, $10 cash / $0 credit", c1.acceptance?.status === "confirmed" && c1.acceptance.cashCents === 1000 && c1.acceptance.creditAppliedCents === 0);
  check("need status found", n1.status === "found", n1.status);

  step = "trip lands; hourly sweep (landing + 4 h passed)";
  await moveTrip(need.id, Date.now() - 24 * HOUR);
  await db!.query("update helper_acceptances set lands_at = now() - interval '4 hours 1 minute', feedback_due_at = now() - interval '1 minute' where conversation_id = $1", [conv.id]);
  const before = mails.length;
  await sweeps.sweepPaidHelp(quietLog);
  await settle();
  const asks = mailsSince(before).filter((m) => m.subject.startsWith("Did ") && m.subject.includes(" help "));
  check('exactly one "did they help?" email, to the poster', asks.length === 1 && asks[0].to === o.poster.email, asks.map((m) => m.to).join(", "));
  await sweeps.sweepPaidHelp(quietLog);
  await settle();
  check('second sweep sends no duplicate "did they help?"', mails.length === before + asks.length);
  const token = decodeURIComponent(/token=([^&\s]+)&answer=yes/.exec(asks[0]?.text ?? "")?.[1] ?? "");

  step = `${o.poster.name} clicks "Yes" (/feedback)`;
  const view = await call("GET", `/feedback?token=${encodeURIComponent(token)}`, null);
  check("GET /feedback (link open) records nothing", view.outcome === null);
  const fb = await call("POST", "/feedback", null, { token, helped: true });
  check("POST /feedback records helped", fb.outcome === "helped");
  const again = await fetch(`${API}/feedback`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, helped: false }) });
  check("answering again is refused", again.status === 404 || again.status === 409, String(again.status));
  await settle();
  const c2 = await call("GET", `/conversations/${conv.id}`, o.poster.token);
  return { need, conv, acceptance: c2.acceptance };
}

async function scenario1(u1: User, u2: User, u6: User) {
  begin("1", "Paid help: accept, pay $10, lands, Yes → helper gets $5 credit, and spends it");
  const { acceptance } = await paidTrip({ poster: u1, helper: u2, label: "My mother", declineReward: false });
  const b2 = await credits(u2);
  const b1 = await credits(u1);
  check("user2 (helper) credit = 500 cents", b2.balanceCents === 500, `${b2.balanceCents}`);
  check("user2 ledger: one helper_reward +500", b2.entries.length === 1 && b2.entries[0].reason === "helper_reward" && b2.entries[0].amountCents === 500);
  check("user1 paid $10 cash, credit stays 0", acceptance.cashCents === 1000 && b1.balanceCents === 0, `cash ${usd(acceptance.cashCents)}, credit ${b1.balanceCents}`);
  check("acceptance shows rewardCreditedCents 500", acceptance.rewardCreditedCents === 500);
  const rewardMail = mails.find((m) => m.scenario === "1" && m.to === u2.email && m.subject.includes("earned"));
  check('helper got "You earned $5 TransitVault credit"', Boolean(rewardMail), rewardMail?.subject ?? "none");
  fact(`user1 paid ${usd(acceptance.cashCents)} by card; user2 credit after Yes: ${usd(b2.balanceCents)}`);

  step = "user2 posts their own need; user6 reaches out; user2 accepts";
  const need2 = await postNeed(u2, "My father", Date.now() + 9 * DAY);
  const conv2 = await call("POST", `/needs/${need2.id}/reach-out`, u6.token, { message: "Same flights, I can help." });
  const acc2 = await call("POST", `/conversations/${conv2.id}/accept`, u2.token);
  const s2 = sessions.get(sessionIdOf(acc2.checkoutUrl));
  check("user2's accept: $5 credit applied, $5 charged", acc2.conversation.acceptance?.creditAppliedCents === 500 && acc2.conversation.acceptance?.cashCents === 500 && s2?.amount === 500, `checkout ${s2 ? usd(s2.amount) : "none"}`);
  const mid = await credits(u2);
  check("user2 credit drops to 0 while checkout is open (fee_applied −500)", mid.balanceCents === 0, `${mid.balanceCents}`);
  step = "Stripe webhook for user2's $5";
  const wh = await webhookPaid(s2!.id);
  await settle();
  const c = await call("GET", `/conversations/${conv2.id}`, u2.token);
  check("user2's acceptance confirmed", wh.result === "confirmed" && c.acceptance?.status === "confirmed", wh.result);
  const conf = mails.find((m) => m.scenario === "1" && m.to === u2.email && m.subject.includes("is confirmed as the helper"));
  check('confirmation says "$5 by card and $5 from your TransitVault credit"', Boolean(conf?.text.includes("You paid $5 by card and $5 from your TransitVault credit")));
  const after = await credits(u2);
  check("user2 final credit = 0", after.balanceCents === 0, `${after.balanceCents}`);
  fact(`user2's own trip: ${usd(500)} credit applied + ${usd(s2?.amount ?? 0)} card; balance ${usd(after.balanceCents)}`);
}

async function scenario2(u3: User, u4: User) {
  begin("2", 'Paid help, helper chose "I\'m helping for free": no reward');
  const { acceptance, conv } = await paidTrip({ poster: u3, helper: u4, label: "My mother-in-law", declineReward: true });
  const b4 = await credits(u4);
  check("conversation.rewardDeclined = true", (await call("GET", `/conversations/${conv.id}`, u4.token)).rewardDeclined === true);
  check("user4 (helper) credit = 0", b4.balanceCents === 0, `${b4.balanceCents}`);
  check("user4 has no ledger entries (no helper_reward)", b4.entries.length === 0, `${b4.entries.length}`);
  check("acceptance rewardCreditedCents 0", acceptance.rewardCreditedCents === 0);
  const helperConf = mails.find((m) => m.scenario === "2" && m.to === u4.email && m.subject.includes("accepted your help"));
  check('helper\'s confirmation says "You chose to help for free"', Boolean(helperConf?.text.includes("You chose to help for free")));
  const thanks = mails.find((m) => m.scenario === "2" && m.to === u4.email && m.subject.startsWith("Thank you for helping"));
  check('helper got "Thank you for helping" (no credit)', Boolean(thanks), thanks?.subject ?? "none");
  fact(`user3 paid ${usd(acceptance.cashCents)} by card; user4 credit ${usd(b4.balanceCents)}`);
}

async function scenario3(u5: User, u4: User) {
  begin("3", 'Travel day "sorry, no one offered to help" + the day-after nudge');
  const lonely = await postNeed(u5, "My mother", Date.now() + 7 * DAY);
  const control = await postNeed(u5, "Dad (74)", Date.now() + 7 * DAY);
  await call("POST", `/needs/${control.id}/reach-out`, u4.token, { message: "I'm on LH761, can help." });
  // Both posted well before the travel day.
  await db!.query("update needs set created_at = now() - interval '3 days' where id = any($1)", [[lonely.id, control.id]]);
  await settle();
  const sorryFor = (from: number) => mailsSince(from).filter((m) => m.subject.startsWith("Sorry, no one offered"));
  const nudgesFor = (from: number) => mailsSince(from).filter((m) => m.subject.includes("find a companion"));

  step = "sweep 7 h before departure (before the window)";
  await moveTrip(lonely.id, Date.now() + 7 * HOUR);
  await moveTrip(control.id, Date.now() + 7 * HOUR);
  let from = mails.length;
  let r = await sweeps.sweepNudges(quietLog);
  await settle();
  check("7 h before departure: no email", sorryFor(from).length === 0 && r.noHelper === 0, `noHelper=${r.noHelper}`);

  step = "sweep 5 h before departure (inside the 6 h window)";
  await moveTrip(lonely.id, Date.now() + 5 * HOUR);
  await moveTrip(control.id, Date.now() + 5 * HOUR);
  from = mails.length;
  r = await sweeps.sweepNudges(quietLog);
  await settle();
  const sorry = sorryFor(from);
  check('exactly one "sorry" email, to user5', sorry.length === 1 && sorry[0].to === u5.email, sorry.map((m) => m.to).join(", ") || "none");
  check('it addresses "your mother" and the route', Boolean(sorry[0]?.text.includes("your mother's flights") && sorry[0]?.subject.includes("DEL → ORD")));
  check("it has the airline-assistance and itinerary tips, no paid-help mention", Boolean(sorry[0] && /meet-and-assist/.test(sorry[0].text) && /48 hours/.test(sorry[0].text) && /itinerary/.test(sorry[0].text) && !/\$|credit|fee|pay/i.test(sorry[0].text)));
  check("control need (1 conversation): no sorry email", !sorry.some((m) => m.text.includes("dad (74)")));
  const st = await call("GET", `/needs/${lonely.id}`, u5.token);
  check("need status unchanged (open)", st.status === "open", st.status);

  step = "sweep again inside the window";
  from = mails.length;
  r = await sweeps.sweepNudges(quietLog);
  await settle();
  check("second sweep: no duplicate", sorryFor(from).length === 0 && r.noHelper === 0);

  step = "sweep the day after travel";
  await moveTrip(lonely.id, Date.now() - 30 * HOUR);
  await moveTrip(control.id, Date.now() - 30 * HOUR);
  from = mails.length;
  r = await sweeps.sweepNudges(quietLog);
  await settle();
  const nudges = nudgesFor(from);
  check('lonely need: NO "did you find a companion?" nudge', !nudges.some((m) => m.text.includes("My mother")));
  check("control need: gets the day-after nudge, once", nudges.length === 1 && nudges[0].text.includes("Dad (74)"), nudges.map((m) => m.subject).join(" | ") || "none");
  from = mails.length;
  await sweeps.sweepNudges(quietLog);
  await settle();
  check("next sweep: nothing more", mails.length === from);
  const rows = await db!.query("select traveler_label, status, no_helper_emailed_at is not null as sorry, nudged_at is not null as nudged from needs where id = any($1) order by traveler_label", [[lonely.id, control.id]]);
  for (const x of rows.rows) fact(`${x.traveler_label}: status ${x.status}, sorry email ${x.sorry ? "sent" : "not sent"}, day-after nudge ${x.nudged ? "sent" : "not sent"}`);
}

/** Any status, parsed body: for the checks that expect a refusal. */
async function req(method: string, path: string, token: string | null, body?: unknown): Promise<{ status: number; body: any }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const PASSWORD = "scenarios-password";
const isPlaceholder = (to: string) => to.toLowerCase().endsWith("@transitvault.invalid");

async function scenario4(u7: User, u8: User) {
  begin("4", "Account deletion: open need + flight post + credit + conversations, then re-signup");

  // user7 earns $5 credit by helping user8 (a resolved acceptance does NOT block deletion).
  const trip = await paidTrip({ poster: u8, helper: u7, label: "My father", declineReward: false });
  const c0 = await credits(u7);
  check("setup: user7 has $5 credit from helping", c0.balanceCents === 500, `${c0.balanceCents}`);

  step = `${u7.name} posts a need and an "I'm flying" post`;
  const need = await postNeed(u7, "My mother", Date.now() + 7 * DAY);
  const flight = await call("POST", "/flights", u7.token, { legs: legsDepartingAt(Date.now() + 10 * DAY), languages: ["Malayalam", "English"] });
  step = `${u8.name} reaches out; ${u7.name} replies`;
  const conv = await call("POST", `/needs/${need.id}/reach-out`, u8.token, { message: "I'm on LH761 too, happy to keep her company." });
  await call("POST", `/conversations/${conv.id}/messages`, u7.token, { body: "Thank you so much! She lands at gate B." });
  await settle();
  const board0 = await call<any[]>("GET", "/needs", u8.token);
  check("before: user7's need is on the board", board0.some((n) => n.id === need.id));

  step = `${u7.name} opens Delete account`;
  const pre = await call("GET", "/me/deletion", u7.token);
  check("preflight: canDelete, no blockers, $5 credit to forfeit", pre.canDelete === true && pre.blockers.length === 0 && pre.creditCents === 500, JSON.stringify(pre));
  const wrong = await req("POST", "/me/delete", u7.token, { password: "not-the-password" });
  check("wrong password → 403 wrong_password", wrong.status === 403 && wrong.body?.error === "wrong_password", `${wrong.status} ${wrong.body?.error}`);

  step = `${u7.name} deletes the account`;
  const mailsBefore = mails.length;
  const del = await req("POST", "/me/delete", u7.token, { password: PASSWORD });
  check("POST /me/delete → 204", del.status === 204, String(del.status));

  step = "after deletion: what other people see";
  const board1 = await call<any[]>("GET", "/needs", u8.token);
  check("need gone from the board", !board1.some((n) => n.id === need.id));
  const flights1 = await call<any[]>("GET", "/flights", u8.token);
  check('"I\'m flying" post gone from the flights board', !flights1.some((f) => f.id === flight.flight.id));
  const pub = await req("GET", `/public/needs/${need.id}`, null);
  check("public share preview → 404", pub.status === 404, String(pub.status));
  const cv = await call("GET", `/conversations/${conv.id}`, u8.token);
  check('other party still sees the conversation, as "Deleted user"', cv.otherParty.firstName === "Deleted user" && cv.otherParty.deleted === true, `${cv.otherParty.firstName} deleted=${cv.otherParty.deleted}`);
  const msgs = await call<any[]>("GET", `/conversations/${conv.id}/messages`, u8.token);
  check("both messages are kept", msgs.length === 2 && msgs.some((m) => m.body.includes("gate B")), `${msgs.length} messages`);
  const cvTrip = await call("GET", `/conversations/${trip.conv.id}`, u8.token);
  check('the earlier paid-help conversation shows "Deleted user" too', cvTrip.otherParty.firstName === "Deleted user");
  const send = await req("POST", `/conversations/${conv.id}/messages`, u8.token, { body: "Hello?" });
  check("messaging a deleted account → 409 other_party_deleted", send.status === 409 && send.body?.error === "other_party_deleted", `${send.status} ${send.body?.error}`);
  const thank = await req("POST", `/conversations/${trip.conv.id}/thanks`, u8.token, {});
  check("thanking a deleted account → 409 other_party_deleted", thank.status === 409 && thank.body?.error === "other_party_deleted", `${thank.status} ${thank.body?.error}`);

  step = "after deletion: the database";
  const ur = (await db!.query("select name, email, phone, alerts_enabled, deleted_at is not null as deleted from users where id = $1", [u7.id])).rows[0];
  check(
    "user row anonymised (name, placeholder email, no phone, alerts off)",
    ur.name === "Deleted user" && ur.email === `deleted+${u7.id}@transitvault.invalid` && ur.phone === "" && ur.alerts_enabled === false && ur.deleted,
    JSON.stringify(ur),
  );
  const led = (await db!.query("select reason, amount_cents from credit_entries where user_id = $1 order by created_at", [u7.id])).rows;
  const sum = led.reduce((t: number, e: any) => t + e.amount_cents, 0);
  check(
    "credit zeroed by one account_deleted −500 entry (ledger kept)",
    sum === 0 && led.some((e: any) => e.reason === "account_deleted" && e.amount_cents === -500),
    led.map((e: any) => `${e.reason} ${e.amount_cents}`).join(", "),
  );
  const acc = (await db!.query("select count(*)::int as n from helper_acceptances where helper_id = $1", [u7.id])).rows[0];
  check("paid-help acceptance record kept for accounting", acc.n === 1, `${acc.n}`);
  const posts = (
    await db!.query(
      "select (select status from needs where id = $1) as need, (select status from flight_posts where id = $2) as flight, (select count(*)::int from sessions where user_id = $3) as sessions",
      [need.id, flight.flight.id, u7.id],
    )
  ).rows[0];
  check("need + flight post closed, sessions revoked", posts.need === "closed" && posts.flight === "closed" && posts.sessions === 0, JSON.stringify(posts));

  step = "after deletion: signing in";
  const me = await req("GET", "/me", u7.token);
  check("old access token → 401 account_deleted", me.status === 401 && me.body?.error === "account_deleted", `${me.status} ${me.body?.error}`);
  const login = await req("POST", "/auth/login", null, { email: u7.email, password: PASSWORD });
  check("login with the old email → 401", login.status === 401, String(login.status));
  const reset = await req("POST", "/auth/password-reset/request", null, { email: u7.email });
  await settle();
  check("password reset for the old email → 204, no email sent", reset.status === 204 && !mailsSince(mailsBefore).some((m) => m.to === u7.email));

  step = "sweeps and alerts after deletion";
  // Put the closed need inside the travel-day "sorry" window, and post a matching flight.
  await db!.query("update needs set created_at = now() - interval '3 days' where id = $1", [need.id]);
  await moveTrip(need.id, Date.now() + 5 * HOUR);
  await call("POST", "/flights", u8.token, { legs: legsDepartingAt(Date.now() + 5 * HOUR), languages: ["Hindi"] });
  await sweeps.sweepNudges(quietLog);
  await sweeps.sweepPaidHelp(quietLog);
  await settle();
  const after = mailsSince(mailsBefore);
  check(
    "no email to the deleted account (old address or placeholder)",
    !after.some((m) => m.to === u7.email || isPlaceholder(m.to)),
    after.map((m) => m.to).join(", ") || "no emails at all",
  );

  step = `${u7.name}'s email signs up again`;
  const again = await call("POST", "/auth/signup", null, { email: u7.email, password: PASSWORD, name: "Gita Nair", phone: "+15550000077" });
  check("the old email can sign up again, as a new account", again.user.id !== u7.id, `${again.user.id.slice(0, 8)} ≠ ${u7.id.slice(0, 8)}`);
  const fresh = await call("GET", "/me/credits", again.accessToken);
  const mine = await call<any[]>("GET", "/needs/mine", again.accessToken);
  const convs = await call<any[]>("GET", "/conversations", again.accessToken);
  check("the new account starts empty (no credit, posts or conversations)", fresh.balanceCents === 0 && mine.length === 0 && convs.length === 0);
  fact(`user7 deleted with ${usd(500)} credit (forfeited), an open need, a flight post and 2 conversations; then signed up again as a fresh account`);
}

async function scenario5(u9: User, u10: User) {
  // Reuses user3 (poster) and user4 (helper): the signup limit is 10 per hour per IP.
  begin("5", "Account deletion blocked while paid help is in flight");
  const need = await postNeed(u9, "My aunt", Date.now() + 7 * DAY);
  const conv = await call("POST", `/needs/${need.id}/reach-out`, u10.token, { message: "I'm on that flight." });
  step = `${u9.name} accepts ${u10.name} (checkout open)`;
  const acc = await call("POST", `/conversations/${conv.id}/accept`, u9.token);

  const h1 = await req("POST", "/me/delete", u10.token, { password: PASSWORD });
  check(
    "helper, checkout open → 409 paid_help_in_progress (pending_payment, helper)",
    h1.status === 409 && h1.body?.error === "paid_help_in_progress" && h1.body.blockers?.[0]?.kind === "pending_payment" && h1.body.blockers[0].role === "helper",
    `${h1.status} ${JSON.stringify(h1.body?.blockers)}`,
  );
  const p1 = await req("POST", "/me/delete", u9.token, { password: PASSWORD });
  check("poster, checkout open → 409 (pending_payment, poster)", p1.status === 409 && p1.body.blockers?.[0]?.role === "poster", `${p1.status}`);

  step = "Stripe webhook confirms; trip not yet resolved";
  await webhookPaid(sessionIdOf(acc.checkoutUrl));
  await settle();
  const pre = await call("GET", "/me/deletion", u10.token);
  check("preflight: canDelete false, trip_unresolved", pre.canDelete === false && pre.blockers[0]?.kind === "trip_unresolved", JSON.stringify(pre.blockers));
  const h2 = await req("POST", "/me/delete", u10.token, { password: PASSWORD });
  check("helper, confirmed + unresolved → 409", h2.status === 409, String(h2.status));
  const still = await req("GET", "/me", u10.token);
  check("the refused account still works", still.status === 200);

  step = `the trip lands and ${u9.name} answers "helped"`;
  await moveTrip(need.id, Date.now() - 24 * HOUR);
  await db!.query("update helper_acceptances set lands_at = now() - interval '5 hours', feedback_due_at = now() - interval '1 minute' where conversation_id = $1", [conv.id]);
  await call("POST", `/conversations/${conv.id}/outcome`, u9.token, { helped: true });
  await settle();
  const h3 = await req("POST", "/me/delete", u10.token, { password: PASSWORD });
  check("once resolved, the helper can delete → 204", h3.status === 204, String(h3.status));
  const led = (await db!.query("select reason, amount_cents from credit_entries where user_id = $1 order by created_at", [u10.id])).rows;
  check(
    "helper's $5 reward was credited, then forfeited (balance 0)",
    led.length === 2 && led[0].reason === "helper_reward" && led[1].reason === "account_deleted" && led[1].amount_cents === -500,
    led.map((e: any) => `${e.reason} ${e.amount_cents}`).join(", "),
  );
  const c = await req("GET", `/conversations/${conv.id}`, u9.token);
  check('poster\'s confirmed-helper conversation now shows "Deleted user"', c.body?.otherParty?.firstName === "Deleted user");
}

async function scenario6(u9: User) {
  begin("6", "Contact form (POST /contact)");
  step = "a visitor sends the contact form";
  let from = mails.length;
  const r1 = await req("POST", "/contact", null, { name: "Kavya Iyer", email: "kavya@scenarios.test", topic: "payments", message: "My helper didn't show. Can I get a card refund?" });
  await settle();
  const m1 = mailsSince(from);
  check("204 and exactly one email to the ops address", r1.status === 204 && m1.length === 1 && m1[0].to === "support@3pandalabs.com", `${r1.status} → ${m1.map((m) => m.to).join(", ")}`);
  check("Reply-To is the sender, topic in the subject", m1[0]?.replyTo === "kavya@scenarios.test" && m1[0].subject.includes("Payments & credit"), `${m1[0]?.replyTo} | ${m1[0]?.subject}`);

  step = "a signed-in user sends it";
  from = mails.length;
  await req("POST", "/contact", u9.token, { name: u9.name, email: u9.email, topic: "delete_data", message: "Please delete my data." });
  await settle();
  check("the email names the signed-in user's id", mailsSince(from)[0]?.text.includes(u9.id) === true);

  step = "a bot fills the honeypot";
  from = mails.length;
  const bot = await req("POST", "/contact", null, { name: "Bot", email: "bot@scenarios.test", topic: "other", message: "spam", website: "http://spam.example" });
  await settle();
  check("honeypot → 204, nothing sent", bot.status === 204 && mails.length === from, String(bot.status));

  step = "rate limit: 5 per hour per IP";
  const bad = await req("POST", "/contact", null, { name: "", email: "not-an-email", topic: "general", message: "" });
  check("invalid body → 400", bad.status === 400, String(bad.status));
  const fifth = await req("POST", "/contact", null, { name: "Bot", email: "bot@scenarios.test", topic: "other", message: "x", website: "y" });
  const sixth = await req("POST", "/contact", null, { name: "Kavya Iyer", email: "kavya@scenarios.test", topic: "general", message: "Hello again" });
  check("6th request in the hour → 429 rate_limited", fifth.status === 204 && sixth.status === 429 && sixth.body?.error === "rate_limited", `${fifth.status}, ${sixth.status}`);
}

// ---- report --------------------------------------------------------------------------

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const PAGE_CSS = `body{font:15px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;margin:0;padding:16px;background:#f8fafc;color:#1f2937}
main{max-width:960px;margin:0 auto}table{border-collapse:collapse;width:100%;margin:8px 0 20px;background:#fff}
td,th{border:1px solid #e5e7eb;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f1f5f9}
.pass{color:#047857;font-weight:600}.fail{color:#b91c1c;font-weight:600}.meta{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:16px}
.mail{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px}pre{white-space:pre-wrap;background:#f1f5f9;padding:8px;border-radius:6px}
@media (prefers-color-scheme: dark){body{background:#0f172a;color:#e5e7eb}table,.meta{background:#111827}th{background:#1f2937}td,th,.meta{border-color:#374151}pre{background:#1f2937}}`;

function writeReport() {
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(join(OUT_DIR, "emails"), { recursive: true });
  for (const m of mails) {
    writeFileSync(
      join(OUT_DIR, m.file),
      `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(m.subject)}</title><style>${PAGE_CSS}</style></head><body><main>
<p><a href="../index.html">← all scenarios</a></p>
<div class="meta"><b>To:</b> ${esc(m.to)}<br>${m.replyTo ? `<b>Reply-To:</b> ${esc(m.replyTo)}<br>` : ""}<b>Subject:</b> ${esc(m.subject)}<br><b>Scenario:</b> ${esc(m.scenario)} · <b>Step:</b> ${esc(m.step)}</div>
<div class="mail">${m.html}</div>
<details><summary>Plain-text part</summary><pre>${esc(m.text)}</pre></details>
</main></body></html>`,
    );
  }
  const total = checks.filter((c) => c.pass).length;
  const sections = scenarios
    .map((s) => {
      const cs = checks.filter((c) => c.scenario === s.key);
      const ms = mails.filter((m) => m.scenario === s.key);
      const ok = cs.every((c) => c.pass);
      return `<h2>Scenario ${esc(s.key)}: ${esc(s.title)} <span class="${ok ? "pass" : "fail"}">${ok ? "PASS" : "FAIL"}</span></h2>
<ul>${s.facts.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
<table><tr><th>Check</th><th>Result</th><th>Detail</th></tr>${cs
        .map((c) => `<tr><td>${esc(c.name)}</td><td class="${c.pass ? "pass" : "fail"}">${c.pass ? "PASS" : "FAIL"}</td><td>${esc(c.detail)}</td></tr>`)
        .join("")}</table>
<table><tr><th>#</th><th>Step</th><th>To</th><th>Subject</th></tr>${ms
        .map((m) => `<tr><td>${m.n}</td><td>${esc(m.step)}</td><td>${esc(m.to)}</td><td><a href="${m.file}">${esc(m.subject)}</a></td></tr>`)
        .join("")}</table>`;
    })
    .join("\n");
  writeFileSync(
    join(OUT_DIR, "index.html"),
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TransitVault scenarios</title><style>${PAGE_CSS}</style></head><body><main>
<h1>TransitVault scenarios</h1><p>${new Date().toISOString()} · <span class="${total === checks.length ? "pass" : "fail"}">${total}/${checks.length} checks passed</span> · ${mails.length} emails captured</p>
${sections}</main></body></html>`,
  );
}

// ---- main ----------------------------------------------------------------------------

let api: ChildProcess | null = null;
let mocks: Server | null = null;
let pgStarted = false;
let crashed: unknown = null;
try {
  mocks = await startMocks();
  const mockBase = `http://127.0.0.1:${(mocks.address() as AddressInfo).port}`;
  console.log(`Starting Postgres (${CONTAINER}, port ${PG_PORT})…`);
  pgStarted = true;
  await startPostgres();
  const env = apiEnv(mockBase);
  run(["--import", "tsx", "src/db/migrate.ts"], env);
  console.log(`Starting the API on ${API}…`);
  api = await startApi(env);
  Object.assign(process.env, env);
  db = new pg.Pool({ connectionString: DB_URL });
  sweeps = {
    ...(await import("../src/lib/payments.js")),
    ...(await import("../src/lib/nudges.js")),
  } as unknown as Sweeps;

  const [u1, u2, u3, u4, u5, u6, u7, u8] = await Promise.all(
    ["Asha Mehta", "Bilal Khan", "Chitra Rao", "Dev Patel", "Esha Gupta", "Farhan Ali", "Gita Nair", "Hari Singh"].map((n, i) =>
      signup(i + 1, n),
    ),
  );
  console.log("\nScenario 1");
  await scenario1(u1, u2, u6);
  console.log("\nScenario 2");
  await scenario2(u3, u4);
  console.log("\nScenario 3");
  await scenario3(u5, u4);
  console.log("\nScenario 4");
  await scenario4(u7, u8);
  console.log("\nScenario 5");
  await scenario5(u3, u4);
  console.log("\nScenario 6");
  await scenario6(u3);
} catch (err) {
  crashed = err;
  check("harness ran to completion", false, String(err));
} finally {
  if (api?.pid) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(api.pid), "/T", "/F"]);
    else api.kill("SIGTERM");
  }
  await db?.end().catch(() => {});
  mocks?.close();
  if (pgStarted) docker(["rm", "-f", "-v", CONTAINER], true);
}

writeReport();
console.log("\n Scenario | Check | Result");
for (const c of checks) console.log(` ${c.scenario.padEnd(8)} | ${c.name.padEnd(78)} | ${c.pass ? "PASS" : "FAIL"}`);
const failed = checks.filter((c) => !c.pass).length;
console.log(`\n${checks.length - failed}/${checks.length} checks passed, ${mails.length} emails captured. Report: ${join(OUT_DIR, "index.html")}`);
if (crashed) console.error(crashed);
process.exit(failed ? 1 : 0);
