// Captures the Play listing's 8 phone screenshots from a LOCAL TransitVault
// stack, after seeding realistic demo data through the local API. Output is
// exactly 1080 x 1920: a 360 x 640 CSS viewport at device scale 3 (9:16).
//
//   # local stack: api on TV_API, web (next start/dev) on TV_SITE, fresh dev DB
//   cd infra/play-store/tools && npm install
//   TV_SITE=http://localhost:3000 TV_API=http://localhost:8080 npm run screenshots
//   npm run frame        # captioned versions -> ../screenshots/framed/
//
// It CREATES users, needs, a flight post and a conversation, so it refuses to
// run against anything but localhost. Run it on a freshly migrated dev DB, so
// the board shows only the demo posts. Dates are relative to today, so the
// shots always show upcoming trips.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SITE = process.env.TV_SITE ?? "http://localhost:3000";
const API = process.env.TV_API ?? "http://localhost:8080";
if (![SITE, API].every((u) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(u))) {
  throw new Error("capture-screenshots seeds demo data: TV_SITE and TV_API must be localhost");
}
const OUT = process.env.TV_SHOTS_OUT ?? fileURLToPath(new URL("../screenshots/raw/", import.meta.url));
mkdirSync(OUT, { recursive: true });

const PASSWORD = "Demo-TransitVault-2026";
const TAG = Date.now().toString(36).slice(-4);

// ---- dates: trips 2-4 weeks out ---------------------------------------------
const day = (offset) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
// Leg times are airport-local wall clock encoded with Z (api/ROUTES.md).
const leg = (flightNumber, from, to, dep, arr) => ({ flightNumber, from, to, departsAt: `${dep}:00Z`, arrivesAt: `${arr}:00Z` });
const D1 = day(18);
const D2 = day(21);
const D3 = day(24);
const D4 = day(27);
const D5 = day(30);

// ---- API ----------------------------------------------------------------------
let n = 0;
async function call(method, path, body, token) {
  const headers = { "cf-connecting-ip": `10.250.0.${(n++ % 250) + 1}` }; // local only: keeps auth rate limits out of the way
  if (body) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json)}`);
  return json;
}
async function person(slug, name, phone) {
  const email = `${slug}.${TAG}@demo.transitvault.test`;
  const r = await call("POST", "/auth/signup", { email, password: PASSWORD, name, phone });
  return { email, name, token: r.accessToken, refresh: r.refreshToken };
}

// ---- seed -------------------------------------------------------------------------
const priya = await person("priya", "Priya Sharma", "+16305550101");
const arjun = await person("arjun", "Arjun Malhotra", "+919810055501");
const lakshmi = await person("lakshmi", "Lakshmi Narayanan", "+14085550188");
const farhan = await person("farhan", "Farhan Siddiqui", "+12025550177");
const deepa = await person("deepa", "Deepa Menon", "+12015550166");
const harsh = await person("harsh", "Harsh Patel", "+447700900456");
const rahul = await person("rahul", "Rahul Iyer", "+919845055502");

// Needs (Priya's is the hero: Delhi -> Frankfurt -> Chicago on Lufthansa).
const mummy = await call(
  "POST",
  "/needs",
  {
    travelerLabel: "My mother",
    travelerAge: 72,
    languages: ["Hindi", "Punjabi"],
    assistance: "Wheelchair booked at Frankfurt. Please help her find the gate for the Chicago flight and fill in the US customs form.",
    notes: "She'll be wearing a maroon shawl and carries a small blue handbag.",
    legs: [leg("LH761", "DEL", "FRA", `${D1}T02:55`, `${D1}T07:15`), leg("LH430", "FRA", "ORD", `${D1}T10:05`, `${D1}T12:35`)],
  },
  priya.token,
);
await call(
  "POST",
  "/needs",
  {
    travelerLabel: "Amma",
    travelerAge: 70,
    languages: ["Tamil", "English"],
    assistance: "First international trip. Help at the Dubai transfer would mean a lot.",
    legs: [leg("EK565", "BLR", "DXB", `${D2}T04:25`, `${D2}T07:10`), leg("EK225", "DXB", "SFO", `${D2}T09:05`, `${D2}T13:50`)],
  },
  lakshmi.token,
);
await call(
  "POST",
  "/needs",
  {
    travelerLabel: "Abbu",
    travelerAge: 78,
    languages: ["Urdu", "Telugu"],
    assistance: "Walks slowly; wheelchair requested at Doha.",
    legs: [leg("QR501", "HYD", "DOH", `${D3}T04:10`, `${D3}T06:05`), leg("QR707", "DOH", "IAD", `${D3}T08:20`, `${D3}T14:55`)],
  },
  farhan.token,
);
await call(
  "POST",
  "/needs",
  {
    travelerLabel: "Achan",
    travelerAge: 75,
    languages: ["Malayalam", "English"],
    assistance: "Needs help with immigration at Newark.",
    legs: [leg("AI191", "BOM", "EWR", `${D4}T01:30`, `${D4}T07:45`)],
  },
  deepa.token,
);
await call(
  "POST",
  "/needs",
  {
    travelerLabel: "Bapuji",
    travelerAge: 81,
    languages: ["Gujarati", "Hindi"],
    legs: [leg("AI171", "AMD", "LHR", `${D5}T13:40`, `${D5}T18:10`)],
  },
  harsh.token,
);
// Rahul is flying Bengaluru -> Dubai -> San Francisco and offers help.
await call("POST", "/flights", { legs: [leg("EK565", "BLR", "DXB", `${D2}T04:25`, `${D2}T07:10`), leg("EK225", "DXB", "SFO", `${D2}T09:05`, `${D2}T13:50`)], languages: ["Tamil", "Kannada", "English"], note: "Travelling home after Diwali. Happy to sit with someone at the Dubai transfer." }, rahul.token);

// ---- browser ------------------------------------------------------------------
const browser = await chromium.launch();
async function phone(who) {
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  });
  if (who) {
    const s = await call("POST", "/auth/login", { email: who.email, password: PASSWORD });
    await ctx.addInitScript(
      ([a, r]) => {
        if (!localStorage.getItem("tv_refresh_token")) {
          localStorage.setItem("tv_access_token", a);
          localStorage.setItem("tv_refresh_token", r);
        }
      },
      [s.accessToken, s.refreshToken],
    );
  }
  return ctx.newPage();
}
// Signed-in pages are reached by a client-side navigation from the landing
// page, the way a user moves through the app: a hard load of a signed-in route
// currently bounces to /login even with valid tokens (TV-1 in the 2026-11-13
// local E2E report), and a client-side push isn't affected.
async function open(page, path) {
  if (!page.url().startsWith(SITE)) await page.goto(SITE + "/", { waitUntil: "networkidle" });
  await page.evaluate((p) => window.next.router.push(p), path);
  await page.waitForURL((u) => u.pathname + u.search === path, { timeout: 10000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
}
/** Scroll so the element with `text` sits `above` CSS px below the top. */
async function scrollTo(page, text, above = 70) {
  const el = page.getByText(text, { exact: false }).first();
  await el.waitFor({ timeout: 8000 });
  const y = await el.evaluate((e) => e.getBoundingClientRect().top + window.scrollY);
  await page.evaluate((top) => window.scrollTo(0, Math.max(0, top)), y - above);
  await page.waitForTimeout(300);
}
async function shoot(page, file) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: OUT + file }); // viewport only: 360x640 @3 = 1080x1920
  console.log("captured", file);
}

// 1. Landing (signed out)
{
  const p = await phone(null);
  await open(p, "/");
  await shoot(p, "01-landing.png");
  await p.context().close();
}
// 2. Needs board, as Arjun (a helper)
const ap = await phone(arjun);
await open(ap, "/needs");
await scrollTo(ap, "Travellers looking for a companion", 16);
await shoot(ap, "02-needs-board.png");

// 3. Need detail with legs, as Arjun
await open(ap, `/needs/${mummy.id}`);
await scrollTo(ap, "Flights", 12);
await shoot(ap, "03-need-detail.png");

// 4. Post-a-need form, as Priya (filled in, not submitted)
const pp = await phone(priya);
await open(pp, "/needs/new");
await pp.getByLabel("Who is travelling").fill("Papa");
await pp.getByLabel("Age (optional)").fill("76");
for (const l of ["Hindi", "English"]) {
  await pp.getByLabel("Add a language").fill(l);
  await pp.getByLabel("Add a language").press("Enter");
}
await pp.getByLabel("Help needed (optional)").fill("Needs help at the Frankfurt transfer and with the immigration form.");
await pp.getByRole("radio", { name: /Connecting/ }).click();
await pp.getByLabel("Flight 1 number").fill("LH761");
await pp.getByLabel("Flight 1 from").fill("DEL");
await pp.getByLabel("Flight 1 to").fill("FRA");
await pp.getByLabel("Flight 2 number").fill("LH430");
await pp.getByLabel("Flight 2 to").fill("ORD");
await pp.locator('input[type="datetime-local"]').nth(0).fill(`${D5}T02:55`);
await pp.locator('input[type="datetime-local"]').nth(1).fill(`${D5}T07:15`);
await pp.locator('input[type="datetime-local"]').nth(2).fill(`${D5}T10:05`);
await pp.locator('input[type="datetime-local"]').nth(3).fill(`${D5}T12:35`);
await pp.locator("body").click({ position: { x: 5, y: 5 } });
await scrollTo(pp, "Who is travelling", 110);
await shoot(pp, "04-post-a-need.png");

// 5. "I'm flying" with matches, as Arjun: he posts his Lufthansa flight
await open(ap, "/flights/new");
for (const l of ["Hindi", "English"]) {
  await ap.getByLabel("Add a language").fill(l);
  await ap.getByLabel("Add a language").press("Enter");
}
await ap.getByLabel("Flight 1 number").fill("LH761");
await ap.getByLabel("Flight 1 from").fill("DEL");
await ap.getByLabel("Flight 1 to").fill("FRA");
await ap.locator('input[type="datetime-local"]').nth(0).fill(`${D1}T02:55`);
await ap.locator('input[type="datetime-local"]').nth(1).fill(`${D1}T07:15`);
await ap.getByLabel("Note (optional)").fill("Flying back to Frankfurt for work. Happy to help at the layover.");
await ap.getByRole("button", { name: /Post my flight/ }).click();
await ap.getByText("Your flight is posted").waitFor();
await scrollTo(ap, "Your flight is posted", 24);
await ap.waitForTimeout(500);
await shoot(ap, "05-im-flying-matches.png");

// 6. Conversation: Arjun reaches out, Priya replies, Arjun answers
const conv = await call("POST", `/needs/${mummy.id}/reach-out`, { message: "Namaste Priya ji! I'm on LH761 too, seat 34C. I can walk your mother from the wheelchair desk to the Chicago gate in Frankfurt.", myFlightNumbers: ["LH761"] }, arjun.token);
const priyaApi = await call("POST", "/auth/login", { email: priya.email, password: PASSWORD });
await new Promise((r) => setTimeout(r, 1100));
await call("POST", `/conversations/${conv.id}/messages`, { body: "Thank you so much, Arjun! She speaks Hindi and a little English. Can I share your number with her?" }, priyaApi.accessToken);
await new Promise((r) => setTimeout(r, 1100));
await call("POST", `/conversations/${conv.id}/messages`, { body: "Of course. I'll message you here once we land in Frankfurt, and again at the gate. 🙏" }, arjun.token);
await open(pp, `/messages/${conv.id}`);
await scrollTo(pp, "seat 34C", 150);
await shoot(pp, "06-conversation.png");

// 7. Airport assistance / day-of checklist, as Priya on her own need
await open(pp, `/needs/${mummy.id}`);
const summary = pp.locator("summary", { hasText: "Before the flight" }).first();
const isOpen = await summary.evaluate((s) => s.parentElement?.hasAttribute("open"));
if (!isOpen) await summary.click();
await scrollTo(pp, "Before the flight", 12);
await shoot(pp, "07-airport-assistance.png");

// 8. Public share page, signed out (what a WhatsApp link opens)
{
  const p = await phone(null);
  await open(p, `/n/${mummy.id}`);
  await shoot(p, "08-share-page.png");
  await p.context().close();
}

await browser.close();
console.log(`done -> ${OUT}`);
