import {
  Accessibility,
  ArrowRight,
  BellRing,
  Flag,
  Heart,
  Lock,
  Mail,
  MessageCircle,
  Plane,
  PlaneTakeoff,
  Search,
  Share2,
  ShieldAlert,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { Backdrop } from "@/components/Backdrop";
import { DeletedNotice } from "@/components/DeletedNotice";
import { Logo } from "@/components/Wordmark";
import { geistMono } from "@/lib/fonts";
import { HomePlans } from "./HomePlans";
import "./home.css";

const STEPS = [
  {
    icon: <PlaneTakeoff />,
    title: "Post their flight",
    body: "“My mom is flying Delhi to Chicago alone, via Frankfurt.” Add the flight numbers, times and any layover.",
  },
  {
    icon: <Search />,
    title: "Travellers see it",
    body: "People flying the same route browse the open needs and spot a flight or layover they share.",
  },
  {
    icon: <MessageCircle />,
    title: "They reach out",
    body: "Someone on the same flight sends you a message. You talk it through and share contact details only if you want to.",
  },
];

// Decorative only: made-up example trips for the hero card, shown one at a time.
type Trip = {
  who: string;
  date: string;
  stops: { code: string; city: string }[];
  flights: { no: string; dep: string; arr: string }[];
  languages: string;
  help: string[];
};
const TRIPS: Trip[] = [
  {
    who: "My mother (68)",
    date: "Sat 14 Dec",
    stops: [
      { code: "DEL", city: "Delhi" },
      { code: "FRA", city: "Frankfurt" },
      { code: "ORD", city: "Chicago" },
    ],
    flights: [
      { no: "LH 761", dep: "02:50", arr: "07:25" },
      { no: "LH 430", dep: "10:05", arr: "12:20" },
    ],
    languages: "Hindi, English",
    help: ["At the gate", "Transfer at FRA"],
  },
  {
    who: "Dad (74)",
    date: "Fri 20 Dec",
    stops: [
      { code: "BOM", city: "Mumbai" },
      { code: "DXB", city: "Dubai" },
      { code: "JFK", city: "New York" },
    ],
    flights: [
      { no: "EK 501", dep: "04:30", arr: "06:20" },
      { no: "EK 203", dep: "08:30", arr: "14:25" },
    ],
    languages: "Marathi, Hindi",
    help: ["Transfer at DXB", "Help with a form"],
  },
  {
    who: "Nani (71)",
    date: "Mon 23 Dec",
    stops: [
      { code: "BLR", city: "Bengaluru" },
      { code: "LHR", city: "London" },
    ],
    flights: [{ no: "BA 118", dep: "06:45", arr: "12:15" }],
    languages: "Kannada, English",
    help: ["Sitting nearby", "At arrivals"],
  },
  {
    who: "My father (70)",
    date: "Thu 2 Jan",
    stops: [
      { code: "HYD", city: "Hyderabad" },
      { code: "DOH", city: "Doha" },
      { code: "IAD", city: "Washington" },
    ],
    flights: [
      { no: "QR 501", dep: "03:55", arr: "05:45" },
      { no: "QR 707", dep: "08:00", arr: "14:40" },
    ],
    languages: "Telugu, English",
    help: ["Transfer at DOH", "Message when landed"],
  },
];
const ROT_DUR = 28;
const rot = (i: number) =>
  ({ "--rot-dur": `${ROT_DUR}s`, "--rot-delay": `${(i * ROT_DUR) / TRIPS.length}s` }) as React.CSSProperties;

// What helpers actually do (copy from /faq "What do helpers do, and not do?").
const MARQUEE = [
  "Finding the gate together",
  "Walking with them through a transfer",
  "Helping with a form",
  "Sitting nearby",
  "Messaging you when they’ve landed",
  "A friendly face on board",
];

const FEATURES = [
  {
    icon: <SlidersHorizontal />,
    title: "Filter the board",
    body: "Browse open needs by from, to or via airport, date, flight number or language.",
  },
  {
    icon: <BellRing />,
    title: "Match alerts by email",
    body: "Flying yourself? Post “I’m flying” and you both get one email when your flights match.",
  },
  {
    icon: <Lock />,
    title: "Private conversations",
    body: "Only first names are shown. Phone numbers stay private until you choose to share them in a message.",
  },
  {
    icon: <Share2 />,
    title: "Share on WhatsApp",
    body: "Send a trip’s preview link to family groups, showing just the route, date, flights and languages.",
  },
  {
    icon: <Accessibility />,
    title: "Official airport assistance",
    body: "Reminders to book the airline’s free special assistance, plus links to official airport meet-and-assist services.",
  },
  {
    icon: <Flag />,
    title: "Report and block",
    body: "Report a post or block someone you don’t want to hear from. Thank helpers with a note afterwards.",
  },
];

export default function Landing() {
  return (
    <div className={`relative ${geistMono.variable}`}>
      <Backdrop />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 text-sm">
          <a href="#how" className="hidden rounded-full px-3 py-1.5 text-fg-muted hover:bg-zinc-100 hover:text-fg sm:inline">
            How it works
          </a>
          <a href="#free" className="hidden rounded-full px-3 py-1.5 text-fg-muted hover:bg-zinc-100 hover:text-fg sm:inline">
            Is it free?
          </a>
          <Link href="/login" className="rounded-full px-3 py-1.5 text-fg-muted hover:bg-zinc-100 hover:text-fg">
            Sign in
          </Link>
        </nav>
      </header>

      <main>
        {/* ---------- Hero ---------- */}
        <section className="relative overflow-hidden">
          <Sky />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <DeletedNotice />
            <div className="grid items-center gap-12 pt-10 pb-16 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:pb-24">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-3 py-1 text-xs font-semibold text-accent shadow-sm backdrop-blur">
                  <Plane className="size-3.5" /> For parents and relatives flying alone
                </p>
                <h1 className="mt-5 text-[2.6rem] leading-[1.05] font-semibold tracking-tight text-fg sm:text-6xl">
                  Parent flying alone? <span className="tv-ink">Post their flight.</span>
                </h1>
                <p className="mt-5 max-w-xl text-lg text-fg-muted">
                  Someone on the same flight, or the same layover, can reach out and keep them company: help at the gate,
                  with the transfer, or just a friendly face on board.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href="/signup?next=%2Fneeds%2Fnew"
                    className="tv-btn-shine inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 text-base font-medium text-accent-fg shadow-lg shadow-blue-700/20 hover:opacity-90"
                  >
                    Post a need <ArrowRight className="size-4" />
                  </Link>
                  <Link
                    href="/signup?next=%2Fneeds"
                    className="inline-flex h-12 items-center rounded-full border border-slate-300 bg-white px-6 text-base font-medium text-fg hover:bg-slate-50"
                  >
                    Browse needs
                  </Link>
                </div>
              </div>
              <HeroPass />
            </div>
          </div>
        </section>

        {/* ---------- Marquee ---------- */}
        <section aria-label="How helpers lend a hand" className="border-y border-zinc-200/70 bg-white/60 py-4 backdrop-blur">
          <div className="tv-marquee overflow-hidden">
            <div className="tv-marquee-track">
              {[0, 1].map((copy) => (
                <ul key={copy} aria-hidden={copy === 1 || undefined} className="flex shrink-0 items-center">
                  {MARQUEE.map((m) => (
                    <li key={m} className="flex items-center gap-4 px-4 text-base font-medium whitespace-nowrap text-zinc-700 sm:text-lg">
                      <Plane className="size-4 text-accent" />
                      {m}
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section id="how" className="mx-auto w-full max-w-6xl scroll-mt-10 px-4 py-20 sm:px-6">
          <div className="tv-reveal text-center">
            <p className="text-xs font-semibold tracking-widest text-accent uppercase">How it works</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">Three steps, before they fly.</h2>
          </div>
          <div className="relative mt-14">
            <div aria-hidden className="tv-path absolute top-7 right-[16%] left-[16%] hidden h-0.5 md:block">
              <div className="tv-runner">
                <Plane />
              </div>
            </div>
            <ol className="relative grid gap-6 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="tv-reveal flex flex-col items-center text-center">
                  <span className="relative grid size-14 place-items-center rounded-2xl bg-accent text-white shadow-lg shadow-blue-700/25 [&_svg]:size-6">
                    {s.icon}
                    <span className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-white text-xs font-bold text-accent ring-2 ring-blue-100">
                      {i + 1}
                    </span>
                  </span>
                  <div className="tv-step mt-5 w-full rounded-2xl border border-line bg-white/90 p-5 shadow-sm">
                    <h3 className="font-semibold text-fg">{s.title}</h3>
                    <p className="mt-1 text-sm text-fg-muted">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- Matching + conversation (dark band) ---------- */}
        <section className="relative overflow-hidden bg-slate-950 py-20 text-white">
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }}
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2">
            <div className="tv-reveal">
              <p className="text-xs font-semibold tracking-widest text-sky-300 uppercase">Two-way matching</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Same flight, same day? <span className="text-sky-300">You&apos;ll both hear about it.</span>
              </h2>
              <p className="mt-4 text-slate-300">
                Travellers can post an &ldquo;I&apos;m flying&rdquo; post with their own flights. A trip and a flight post
                match when they share a flight number within a day of each other, or have the same origin and destination
                on the same date. Both sides get one email about each match.
              </p>
              <p className="mt-4 text-slate-300">
                Then it&apos;s a private conversation. The helper offers what they can, you talk it through, and you share
                phone numbers only if you want to.
              </p>
            </div>
            <MatchDemo />
          </div>
        </section>

        {/* ---------- Features ---------- */}
        <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <div className="tv-reveal text-center">
            <p className="text-xs font-semibold tracking-widest text-accent uppercase">Made for the journey</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">Small on purpose. Kind by design.</h2>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="tv-reveal tv-step rounded-2xl border border-line bg-white/90 p-6 shadow-sm">
                <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-accent [&_svg]:size-5">{f.icon}</span>
                <h3 className="mt-4 font-semibold text-fg">{f.title}</h3>
                <p className="mt-1 text-sm text-fg-muted">{f.body}</p>
              </div>
            ))}
          </div>

          <div className="tv-reveal mt-8 flex gap-3 rounded-2xl border border-blue-200 bg-blue-50/80 p-6 text-sm text-slate-700 shadow-sm">
            <ShieldAlert className="size-5 shrink-0 text-accent" />
            <p>
              Needs are visible only to signed-in members, and only first names are shown. Don&apos;t post full names,
              booking references or passport details. Phone numbers stay private until you choose to share them in a
              message.
            </p>
          </div>
        </section>

        <HomePlans />

        {/* ---------- Closing CTA ---------- */}
        <section className="px-4 pb-20 sm:px-6">
          <div className="tv-cta relative mx-auto w-full max-w-6xl overflow-hidden rounded-[2rem] px-6 py-16 text-center text-white shadow-2xl sm:rounded-[2.5rem] sm:px-8 sm:py-20">
            <Plane aria-hidden className="absolute top-8 right-8 size-24 -rotate-12 text-white/10 sm:size-40" />
            <h2 className="relative text-3xl font-semibold tracking-tight sm:text-5xl">Post their flight before they fly.</h2>
            <p className="relative mx-auto mt-4 max-w-xl text-blue-100">
              Someone on the same flight, or the same layover, can reach out and keep them company.
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/signup?next=%2Fneeds%2Fnew"
                className="tv-btn-shine inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 text-base font-semibold text-blue-800 shadow-xl hover:-translate-y-0.5"
              >
                Post a need <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/signup?next=%2Fneeds"
                className="inline-flex h-12 items-center rounded-full border border-white/40 px-7 text-base font-medium text-white hover:bg-white/10"
              >
                Browse needs
              </Link>
            </div>
            <p className="relative mt-8 text-sm text-blue-100">
              Questions?{" "}
              <Link href="/faq" className="font-medium text-white underline-offset-2 hover:underline">
                Read the FAQ
              </Link>{" "}
              or{" "}
              <Link href="/contact" className="font-medium text-white underline-offset-2 hover:underline">
                contact us
              </Link>
              .
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

/** Drifting clouds and a faint contrail behind the hero. */
function Sky() {
  const clouds = [
    { y: "8%", w: "160px", d: "70s", delay: "-10s" },
    { y: "30%", w: "110px", d: "55s", delay: "-40s" },
    { y: "62%", w: "190px", d: "85s", delay: "-25s" },
    { y: "80%", w: "120px", d: "60s", delay: "-5s" },
  ];
  return (
    <div aria-hidden className="tv-sky">
      {clouds.map((c) => (
        <span
          key={c.y}
          className="tv-cloud"
          style={{ "--y": c.y, "--w": c.w, "--d": c.d, "--delay": c.delay } as React.CSSProperties}
        />
      ))}
      <span className="tv-contrail">
        <Plane />
      </span>
    </div>
  );
}

/** Hero mock-up: a need, drawn as a boarding pass, cycling through example trips. */
function HeroPass() {
  return (
    <div aria-hidden className="tv-stage relative mx-auto w-full max-w-[25rem]">
      <div className="tv-float">
        <div className="tv-pass overflow-hidden">
          <div className="tv-pass-top relative h-[9.5rem] px-5 pt-4 text-white">
            <div className="flex items-center justify-between text-[11px] font-semibold tracking-widest uppercase">
              <span className="inline-flex items-center gap-1.5">
                <span className="tv-ping inline-block size-1.5 rounded-full bg-emerald-300 text-emerald-300" /> Open need
              </span>
              <span className="rounded-full bg-white/20 px-2 py-0.5 tracking-wider">Example</span>
            </div>
            {TRIPS.map((t, i) => (
              <div key={t.who} className="tv-rot absolute inset-x-5 top-11" style={rot(i)} data-first={i === 0 || undefined}>
                <Route trip={t} delay={(i * ROT_DUR) / TRIPS.length} />
              </div>
            ))}
          </div>
          <div className="tv-perf mt-0" />
          <div className="relative h-[12.5rem] px-5 pt-5">
            {TRIPS.map((t, i) => (
              <div key={t.who} className="tv-rot absolute inset-x-5 top-5" style={rot(i)} data-first={i === 0 || undefined}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold tracking-wider text-fg-muted uppercase">Travelling</p>
                    <p className="text-lg font-semibold text-fg">{t.who}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold tracking-wider text-fg-muted uppercase">Date</p>
                    <p className="text-sm font-semibold text-fg">{t.date}</p>
                  </div>
                </div>
                <ul className="tv-mono mt-3 space-y-1 text-[13px] text-zinc-700">
                  {t.flights.map((f) => (
                    <li key={f.no} className="flex justify-between rounded-lg bg-zinc-50 px-2.5 py-1">
                      <span className="font-semibold text-accent">{f.no}</span>
                      <span>
                        {f.dep} → {f.arr}
                      </span>
                    </li>
                  ))}
                  {t.flights.length === 1 ? <li className="px-2.5 py-1 text-xs text-fg-muted">Direct flight</li> : null}
                </ul>
                <p className="mt-3 text-xs text-fg-muted">
                  Speaks <span className="font-medium text-fg">{t.languages}</span>
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {t.help.map((h) => (
                    <span key={h} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Toasts: what happens next, taking turns. */}
      <div className="relative mx-2 mt-5 h-[4.5rem]">
        {[
          { icon: <BellRing />, tone: "bg-amber-100 text-amber-700", title: "Match found", body: "An “I’m flying” post shares a flight" },
          { icon: <MessageCircle />, tone: "bg-blue-100 text-accent", title: "New message", body: "“I’m on the same flight, happy to help.”" },
          { icon: <Heart />, tone: "bg-rose-100 text-rose-600", title: "Thank-you note", body: "“Thank you for looking after Mom!”" },
        ].map((t, i) => (
          <div
            key={t.title}
            className="tv-toast absolute inset-x-0 flex items-center gap-3 rounded-2xl bg-white/95 p-3 shadow-xl ring-1 ring-black/5 backdrop-blur"
            style={{ "--delay": `${i * 4}s` } as React.CSSProperties}
            data-first={i === 0 || undefined}
          >
            <span className={`grid size-9 shrink-0 place-items-center rounded-xl [&_svg]:size-4 ${t.tone}`}>{t.icon}</span>
            <span className="min-w-0 text-sm">
              <span className="block font-semibold text-fg">{t.title}</span>
              <span className="block truncate text-fg-muted">{t.body}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="tv-chip absolute bottom-3 -left-28 z-10 hidden items-center gap-1.5 rounded-2xl bg-white px-3 py-2 text-xs font-semibold whitespace-nowrap text-zinc-800 shadow-xl ring-1 ring-black/5 md:flex">
        <Lock className="size-3.5 text-accent" /> First names only
      </div>
      <div className="tv-chip tv-chip-2 absolute top-[30%] -right-32 hidden items-center gap-1.5 rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold whitespace-nowrap text-white shadow-xl md:flex">
        <Mail className="size-3.5 text-sky-300" /> Email alerts
      </div>
    </div>
  );
}

/** Airport codes joined by a dashed line, with a plane flying along it. */
function Route({ trip, delay }: { trip: Trip; delay: number }) {
  const n = trip.stops.length;
  return (
    <div>
      <div className="flex items-end justify-between">
        {trip.stops.map((s, i) => (
          <div key={s.code} className={i === 0 ? "text-left" : i === n - 1 ? "text-right" : "text-center"}>
            <p className="tv-mono text-3xl leading-none font-semibold tracking-tight sm:text-4xl">{s.code}</p>
            <p className="mt-1 text-[11px] text-blue-100">{s.city}</p>
          </div>
        ))}
      </div>
      <div className="tv-track mt-3">
        {trip.stops.map((s, i) => (
          <span key={s.code} className="tv-stop" style={{ left: `${(i / (n - 1)) * 100}%` }} />
        ))}
        <div className="tv-runner" style={{ "--rot-delay": `${delay}s` } as React.CSSProperties}>
          <Plane />
        </div>
      </div>
    </div>
  );
}

/** A need and an "I'm flying" post sliding together, then the conversation. */
function MatchDemo() {
  return (
    <div aria-hidden className="tv-reveal relative mx-auto w-full max-w-md">
      <p className="mb-3 text-center text-[11px] font-semibold tracking-widest text-slate-400 uppercase">Example</p>
      <div className="relative grid grid-cols-2 gap-3">
        <div className="tv-match-l rounded-2xl bg-white p-4 text-fg shadow-xl">
          <p className="text-[10px] font-semibold tracking-wider text-accent uppercase">Need</p>
          <p className="mt-1 text-sm font-semibold">My mother</p>
          <p className="tv-mono mt-2 text-lg font-semibold">DEL → FRA</p>
          <p className="tv-mono text-xs text-fg-muted">LH 761 · 14 Dec</p>
        </div>
        <div className="tv-match-r rounded-2xl bg-sky-100 p-4 text-slate-900 shadow-xl">
          <p className="text-[10px] font-semibold tracking-wider text-sky-700 uppercase">I&apos;m flying</p>
          <p className="mt-1 text-sm font-semibold">Arjun</p>
          <p className="tv-mono mt-2 text-lg font-semibold">DEL → FRA</p>
          <p className="tv-mono text-xs text-slate-600">LH 761 · 14 Dec</p>
        </div>
        <span className="tv-match-badge absolute top-full left-1/2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-bold whitespace-nowrap text-white shadow-lg ring-4 ring-slate-950">
          <Plane className="size-3.5" /> Same flight
        </span>
      </div>
      <p className="tv-match-mail mt-7 flex items-center justify-center gap-2 text-xs text-slate-300">
        <Mail className="size-3.5 text-sky-300" /> One email to each of you
      </p>

      <div className="mt-6 space-y-2.5 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          <Lock className="size-3" /> Private conversation
        </p>
        <p className="tv-bubble max-w-[85%] rounded-2xl rounded-bl-md bg-white/10 px-3.5 py-2 text-sm" style={{ "--delay": "0s" } as React.CSSProperties}>
          Hi! I&apos;m on LH 761 too. Happy to walk with her to the Frankfurt transfer.
        </p>
        <p className="tv-bubble ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-sm" style={{ "--delay": "1.2s" } as React.CSSProperties}>
          Thank you! She speaks Hindi and a little English. Can we share photos?
        </p>
        <p className="tv-bubble max-w-[85%] rounded-2xl rounded-bl-md bg-white/10 px-3.5 py-2 text-sm" style={{ "--delay": "2.4s" } as React.CSSProperties}>
          Of course. I&apos;ll meet her at the gate.
        </p>
      </div>
    </div>
  );
}
