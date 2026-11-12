"use client";

import Link from "next/link";
import { money, usePaymentsConfig } from "@/components/PaidHelp";
import { SUPPORT_EMAIL } from "@/components/LegalPage";
import type { PaymentsConfig } from "@/lib/types";

// The FAQ. Paid-help questions show only when GET /payments/config says it's
// on, exactly like the landing page's "Is it free?" block, so the free board
// never mentions money. The server render (no config yet) is the free version.

type Item = { q: string; a: React.ReactNode; paid?: boolean };

const L = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="font-medium text-accent hover:underline">
    {children}
  </Link>
);

function items(c: PaymentsConfig | undefined): Item[] {
  const paid = Boolean(c?.enabled);
  const fee = money(c?.feeCents ?? 1000);
  const reward = money(c?.rewardCents ?? 500);
  return [
    {
      q: "What is TransitVault?",
      a: (
        <p>
          A board for families whose parent or relative is flying alone. You post their trip (flights, layovers,
          languages, the help they could use). Someone on the same flight, or the same layover, can reach out in a private
          conversation and offer to keep them company: help at the gate, with a transfer, or just a friendly face on board.
        </p>
      ),
    },
    {
      q: "Is it free?",
      a: paid ? (
        <p>
          Posting a trip, browsing, reaching out, messaging and posting &ldquo;I&apos;m flying&rdquo; are all free. A family
          pays <strong>{fee} per trip</strong> only when they choose to accept a helper. The helper then gets {reward}{" "}
          TransitVault credit as a thank-you after the trip (or helps for free).
        </p>
      ) : (
        <p>Yes. Posting a trip, browsing, reaching out and messaging are all free.</p>
      ),
    },
    {
      q: "Can I post for someone else?",
      a: (
        <p>
          Yes, that&apos;s the point. Most trips are posted by a son, daughter or relative for a parent who is flying.
          Describe them with a label like &ldquo;My mother&rdquo; or &ldquo;Dad (72)&rdquo;; no full names needed. Make sure
          they&apos;re happy for you to share their trip.
        </p>
      ),
    },
    {
      q: "How does matching work?",
      a: (
        <p>
          Travellers can post an &ldquo;I&apos;m flying&rdquo; post with their own flights. A trip and a flight post match
          when they share a flight number within a day of each other, or have the same origin and destination on the same
          date. Both sides get one email about each match (you can turn match alerts off in Profile), and anyone can browse
          and filter the boards by airport, date, flight or language.
        </p>
      ),
    },
    {
      q: "What do helpers do, and not do?",
      a: (
        <>
          <p>
            Helpers are fellow passengers doing a favour: finding the gate together, walking with your parent through a
            transfer, helping with a form, sitting nearby, or messaging you when they&apos;ve landed.
          </p>
          <p>
            They are <strong>not</strong> staff, escorts, carers or an assistance service, and TransitVault doesn&apos;t
            employ or check them. They don&apos;t replace the airline&apos;s assistance, can&apos;t give medical help, and
            shouldn&apos;t carry anything for anyone.
          </p>
        </>
      ),
    },
    {
      q: "Should I still book the airline's special assistance?",
      a: (
        <p>
          Yes, always, for anyone who needs it. Wheelchair and meet-and-assist service is free on most airlines; book it
          with the airline at least 48 hours before the flight. A helper is a friendly extra, not a replacement.
        </p>
      ),
    },
    {
      q: "Any safety tips?",
      a: (
        <ul className="list-disc space-y-1 pl-5">
          <li>Chat on TransitVault first; share phone numbers only when you&apos;re comfortable.</li>
          <li>Meet in public areas of the airport: the gate, transfer desk or arrivals.</li>
          <li>Swap recent photos, and give your parent the helper&apos;s name and number on paper.</li>
          <li>Never send money, and never ask anyone to carry a bag or package.</li>
          <li>Don&apos;t post full names, booking references or passport details.</li>
          <li>Report anything that feels off, and block anyone you don&apos;t want to hear from.</li>
        </ul>
      ),
    },
    {
      q: "Is my phone number or email shown to anyone?",
      a: (
        <p>
          No. Other members only see your first name and how many families have thanked you. If you want to swap numbers,
          you share them yourself in the conversation. See the <L href="/privacy">Privacy Policy</L>.
        </p>
      ),
    },
    {
      paid: true,
      q: "What is TransitVault credit, and how do I use it?",
      a: (
        <p>
          Credit is a thank-you balance in your account: helpers earn {reward} after a trip they helped on, and a family
          gets the fee back as credit if a helper didn&apos;t show. It comes off your own fee automatically the next time you
          accept a helper. It has no cash value, can&apos;t be withdrawn or transferred, and is forfeited if you delete your
          account. Your balance is in <L href="/profile">Profile</L>.
        </p>
      ),
    },
    {
      paid: true,
      q: "What if the helper doesn't show?",
      a: (
        <p>
          After the flight lands we email you to ask whether they helped. Answer &ldquo;No, they didn&apos;t show&rdquo; and
          the full {fee} comes back as TransitVault credit straight away. Prefer the card part back? <L href="/contact">Contact
          us</L> (topic &ldquo;Payments &amp; credit&rdquo;) and we&apos;ll look at a card refund. If something felt unsafe,
          report them too.
        </p>
      ),
    },
    {
      paid: true,
      q: "Can I help for free?",
      a: (
        <p>
          Of course. Tick &ldquo;I&apos;m helping for free&rdquo; when you reach out (or later, in the conversation) and you
          won&apos;t receive the {reward} credit. The family&apos;s fee stays the same either way.
        </p>
      ),
    },
    {
      q: "How do I report or block someone?",
      a: (
        <p>
          Open their post or your conversation with them and use <strong>Report</strong> or <strong>Block</strong>. A post
          reported by several people is hidden while we look at it, and blocked people can&apos;t see your posts or message
          you. For anything serious, also <L href="/contact">contact us</L>.
        </p>
      ),
    },
    {
      q: "How do I delete my account?",
      a: (
        <p>
          Profile → <L href="/profile/delete">Delete account</L>. Your posts leave the boards, your name, email and phone are
          removed, and any credit is forfeited. Conversations stay for the other person, shown as from &ldquo;Deleted
          user&rdquo;. If a paid-help trip you&apos;re part of is still in progress, it has to finish first.
        </p>
      ),
    },
    {
      q: "Who runs TransitVault?",
      a: (
        <p>
          3PandaLabs LLC, a small company in New Jersey, USA. Questions? <L href="/contact">Contact us</L> or email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-accent hover:underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      ),
    },
  ].filter((i: Item) => paid || !i.paid);
}

export function FaqList() {
  const config = usePaymentsConfig();
  return (
    <div className="divide-y divide-line">
      {items(config).map((i) => (
        <details key={i.q} className="group py-4">
          <summary className="cursor-pointer list-none text-base font-semibold text-fg marker:hidden">
            <span className="mr-2 inline-block text-accent transition-transform group-open:rotate-90">›</span>
            {i.q}
          </summary>
          <div className="mt-2 space-y-3 pl-5 text-[15px] leading-7 text-fg-muted">{i.a}</div>
        </details>
      ))}
    </div>
  );
}
