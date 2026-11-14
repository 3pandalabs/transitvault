// Captioned versions of the raw screenshots for the Play listing: a 1080 x 1920
// canvas in TransitVault's brand colours (web/src/app/globals.css: accent
// #1d4ed8, fg #18181b, bg #fafafa, plus the app backdrop's emerald/amber wash),
// a headline on top, the phone screenshot below with rounded corners.
//
//   cd infra/play-store/tools && npm install && npm run frame
//   in:  ../screenshots/raw/*.png   out: ../screenshots/framed/<same name>.png
import { chromium } from "playwright";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const RAW = process.env.TV_RAW ?? here("../screenshots/raw/");
const OUT = process.env.TV_FRAMED ?? here("../screenshots/framed/");
const files = existsSync(RAW) ? readdirSync(RAW).filter((f) => f.endsWith(".png")).sort() : [];
if (!files.length) throw new Error("No PNGs in screenshots/raw/: run `npm run screenshots` first.");
mkdirSync(OUT, { recursive: true });

// [headline, sub line]
const CAPTIONS = {
  "01-landing.png": ["Mum flying alone?", "Find a kind face on the same flight"],
  "02-needs-board.png": ["Families ask for a travel companion", "Browse trips by route, date, flight or language"],
  "03-need-detail.png": ["Every leg, every layover", "Times exactly as printed on the ticket"],
  "04-post-a-need.png": ["Post the trip in a minute", "Direct or connecting, up to four flights"],
  "05-im-flying-matches.png": ["On a flight? Offer to help", "We match you with families on your flight"],
  "06-conversation.png": ["Talk privately, then meet at the gate", "Your phone and email are never shown"],
  "07-airport-assistance.png": ["A checklist for the travel day", "Plus official airport assistance links"],
  "08-share-page.png": ["Share it on WhatsApp", "Someone on the flight may see it"],
};

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const html = (img, [title, sub]) => `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;700&display=swap" rel="stylesheet">
<style>
  html,body{margin:0}
  .c{width:1080px;height:1920px;box-sizing:border-box;overflow:hidden;font-family:Inter,system-ui,sans-serif;
     display:flex;flex-direction:column;align-items:center;
     background:radial-gradient(70% 38% at 0% 0%, rgba(52,211,153,.45) 0%, transparent 70%),
                radial-gradient(60% 34% at 100% 4%, rgba(252,211,77,.5) 0%, transparent 70%),
                linear-gradient(180deg,#fafafa 0%,#eef2ff 100%)}
  .t{height:420px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:0 90px;box-sizing:border-box}
  h1{margin:0;font-size:76px;line-height:1.1;font-weight:700;letter-spacing:-1.5px;color:#18181b}
  p{margin:26px 0 0;font-size:40px;line-height:1.25;font-weight:500;color:#1d4ed8}
  .phone{width:840px;padding:18px;border-radius:64px;background:#18181b;box-shadow:0 40px 80px -24px rgba(29,78,216,.45)}
  img{display:block;width:100%;border-radius:48px}
</style></head><body><div class="c"><div class="t"><h1>${esc(title)}</h1><p>${esc(sub)}</p></div>
<div class="phone"><img src="data:image/png;base64,${img}"></div></div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
for (const f of files) {
  const caption = CAPTIONS[f] ?? [f.replace(/^\d+-|\.png$/g, "").replace(/-/g, " "), ""];
  await page.setContent(html(readFileSync(RAW + f).toString("base64"), caption), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: OUT + f });
  console.log(`framed ${f}  "${caption[0]}"`);
}
await browser.close();
