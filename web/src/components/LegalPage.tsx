// Long-form layout for the public help and legal pages (/privacy, /terms,
// /faq, /support, /contact), adapted from BorrowVault's components/legal.tsx.
// Server components; the repo has no typography plugin, so prose styles live here.
import Link from "next/link";
import { Backdrop } from "@/components/Backdrop";
import { Logo } from "@/components/Wordmark";

/** The one public mailbox, same as BorrowVault and RentVault publish. Also the API's OPS_EMAIL default. */
export const SUPPORT_EMAIL = "support@3pandalabs.com";
export const EFFECTIVE_DATE = "12 November 2026";

export type TocEntry = { id: string; title: string };

const NAV = [
  { href: "/faq", label: "FAQ" },
  { href: "/support", label: "Support" },
  { href: "/contact", label: "Contact" },
];

export function LegalPage({
  title,
  updated,
  intro,
  toc,
  children,
}: {
  title: string;
  /** Shown as "Effective …" on the legal pages; omit on help pages. */
  updated?: string;
  intro?: React.ReactNode;
  toc?: TocEntry[];
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <Backdrop />
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
        <Logo />
        <nav className="flex gap-4 text-sm text-fg-muted">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-fg">
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16">
        <article className="rounded-3xl border border-line bg-white/90 p-6 backdrop-blur-sm sm:p-10">
          <h1 className="text-3xl font-semibold tracking-tight text-fg">{title}</h1>
          {updated ? <p className="mt-2 text-sm text-fg-muted">Effective {updated}</p> : null}
          {intro ? <div className="mt-6 space-y-4 text-[15px] leading-7 text-fg">{intro}</div> : null}
          {toc?.length ? (
            <nav aria-label="Contents" className="mt-8 rounded-2xl border border-line bg-bg-subtle p-5">
              <p className="text-sm font-semibold text-fg">Contents</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                {toc.map((e) => (
                  <li key={e.id}>
                    <a href={`#${e.id}`} className="text-accent hover:underline">
                      {e.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
          <div className="mt-10 space-y-10">{children}</div>
        </article>
      </main>
    </div>
  );
}

export function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="text-xl font-semibold tracking-tight text-fg">{title}</h2>
      <div className="mt-3 space-y-4 text-[15px] leading-7 text-fg">{children}</div>
    </section>
  );
}

export function UL({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5">{children}</ul>;
}

export function Mail({ to = SUPPORT_EMAIL }: { to?: string }) {
  return (
    <a href={`mailto:${to}`} className="font-medium text-accent hover:underline">
      {to}
    </a>
  );
}

export function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-accent hover:underline">
      {children}
    </Link>
  );
}
