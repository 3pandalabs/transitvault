import { AlertTriangle, Flag, HelpCircle, Mail as MailIcon, ShieldCheck, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Mail } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Support",
  description: "Help with TransitVault: FAQ, safety tips, reporting a member, deleting your account, and how to contact us.",
  alternates: { canonical: "/support" },
};

const CARDS = [
  { href: "/faq", icon: <HelpCircle />, title: "FAQ", body: "How posting, matching, helpers and credit work." },
  { href: "/contact", icon: <MailIcon />, title: "Contact us", body: "Questions, payments and credit, safety reports, anything else." },
  { href: "/profile/delete", icon: <Trash2 />, title: "Delete your account", body: "Profile → Delete account. Signed in only." },
  { href: "/terms", icon: <ShieldCheck />, title: "Terms and Privacy", body: "What TransitVault is and isn't, and what we keep." },
];

export default function SupportPage() {
  return (
    <LegalPage title="Support">
      <div role="note" className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertTriangle className="size-5 shrink-0" />
        <p>
          <strong>Urgent issue at the airport?</strong> Contact the airline or airport staff first (or local emergency
          services). TransitVault can&apos;t track flights or intervene in real time.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href} className="rounded-2xl border border-line bg-white p-4 hover:border-accent">
            <span className="flex items-center gap-2 font-semibold text-fg [&_svg]:size-5 [&_svg]:text-accent">
              {c.icon} {c.title}
            </span>
            <span className="mt-1 block text-sm text-fg-muted">{c.body}</span>
          </Link>
        ))}
      </div>

      <section>
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-fg">
          <ShieldCheck className="size-5 text-accent" /> Safety tips
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-7 text-fg">
          <li>Book the airline&apos;s own wheelchair or meet-and-assist service for anyone who needs it (48 hours ahead).</li>
          <li>Chat on TransitVault first; share phone numbers only when you&apos;re comfortable.</li>
          <li>Meet in public areas of the airport: the gate, transfer desk or arrivals.</li>
          <li>Never send money or passport details, and never carry anything for anyone.</li>
          <li>Give the traveller the helper&apos;s name and number on paper, and keep the itinerary in their bag.</li>
        </ul>
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-fg">
          <Flag className="size-5 text-accent" /> Reporting a member or post
        </h2>
        <div className="mt-3 space-y-3 text-[15px] leading-7 text-fg">
          <p>
            Open the post (on the board) or your conversation with the person and tap <strong>Report</strong>. Pick a
            reason and add a note if it helps. A post reported by several people is hidden while we review it.
          </p>
          <p>
            Tap <strong>Block</strong> to stop someone seeing your posts or messaging you. You can unblock them later in
            Profile. For anything serious, also use the <Link href="/contact" className="font-medium text-accent hover:underline">contact form</Link>{" "}
            with the topic &ldquo;Safety report&rdquo;.
          </p>
        </div>
      </section>

      <p className="text-[15px] text-fg">
        Email: <Mail />
      </p>
    </LegalPage>
  );
}
