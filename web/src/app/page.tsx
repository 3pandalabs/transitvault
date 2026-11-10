import { MessageCircle, PlaneTakeoff, Search, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Backdrop } from "@/components/Backdrop";
import { Logo } from "@/components/Wordmark";

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

export default function Landing() {
  return (
    <div className="relative">
      <Backdrop />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Logo />
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/login" className="rounded-full px-3 py-1.5 text-fg-muted hover:bg-zinc-100 hover:text-fg">
            Sign in
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4">
        <section className="py-14 sm:py-20">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-fg sm:text-5xl">
            Parent flying alone? Post their flight.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-fg-muted">
            Someone on the same flight, or the same layover, can reach out and keep them company: help at the gate, with
            the transfer, or just a friendly face on board.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/signup?next=%2Fneeds%2Fnew"
              className="inline-flex h-12 items-center rounded-full bg-accent px-6 text-base font-medium text-accent-fg hover:opacity-90"
            >
              Post a need
            </Link>
            <Link
              href="/signup?next=%2Fneeds"
              className="inline-flex h-12 items-center rounded-full border border-slate-300 bg-white px-6 text-base font-medium text-fg hover:bg-slate-50"
            >
              Browse needs
            </Link>
          </div>
        </section>

        <section className="grid gap-4 pb-10 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="rounded-2xl border border-line bg-white/85 p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-accent [&_svg]:size-5">
                {s.icon}
                <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Step {i + 1}</span>
              </div>
              <h2 className="font-semibold">{s.title}</h2>
              <p className="mt-1 text-sm text-fg-muted">{s.body}</p>
            </div>
          ))}
        </section>

        <section className="mb-16 flex gap-3 rounded-2xl border border-line bg-white/85 p-6 text-sm text-fg-muted shadow-sm">
          <ShieldAlert className="size-5 shrink-0 text-accent" />
          <p>
            Needs are visible only to signed-in members, and only first names are shown. Don&apos;t post full names,
            booking references or passport details. Phone numbers stay private until you choose to share them in a
            message.
          </p>
        </section>
      </main>
    </div>
  );
}
