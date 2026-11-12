import type { Metadata } from "next";
import { A, EFFECTIVE_DATE, LegalPage, Mail, Section, UL } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What TransitVault collects, why, who processes it, how long we keep it, and how to delete your account.",
  alternates: { canonical: "/privacy" },
};

const TOC = [
  { id: "who", title: "Who we are" },
  { id: "collect", title: "What we collect" },
  { id: "why", title: "Why we use it" },
  { id: "shown", title: "What other members see" },
  { id: "processors", title: "Who processes it for us" },
  { id: "retention", title: "How long we keep it" },
  { id: "rights", title: "Your choices and rights" },
  { id: "storage", title: "Cookies and local storage" },
  { id: "children", title: "Children" },
  { id: "security", title: "Security" },
  { id: "changes", title: "Changes" },
  { id: "contact", title: "Contact" },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated={EFFECTIVE_DATE}
      toc={TOC}
      intro={
        <p>
          TransitVault is a board where families post a trip for a parent or relative flying alone, and fellow travellers on
          the same flight can offer to keep them company. This policy explains, in plain English, what information we
          handle to make that work.
        </p>
      }
    >
      <Section id="who" title="1. Who we are">
        <p>
          TransitVault is run by <strong>3PandaLabs LLC</strong>, a New Jersey (USA) limited liability company
          (&ldquo;3PandaLabs&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). We decide how your information is used. Contact us at{" "}
          <Mail />.
        </p>
      </Section>

      <Section id="collect" title="2. What we collect">
        <UL>
          <li>
            <strong>Your account:</strong> name, email address, phone number, and your password (stored only as a one-way
            hash; we can&apos;t read it). Your match-alert setting.
          </li>
          <li>
            <strong>Trips you post:</strong> the traveller&apos;s label (e.g. &ldquo;My mother&rdquo;), age if you give it,
            languages they speak, the help they need and any notes, and the flights (flight numbers, airports, times). For an
            &ldquo;I&apos;m flying&rdquo; post: your flights, languages and note.
          </li>
          <li>
            <strong>Messages</strong> you send in conversations, and thank-you notes.
          </li>
          <li>
            <strong>Safety records:</strong> reports you make or that are made about your posts or account, and who you
            have blocked.
          </li>
          <li>
            <strong>Payment records</strong> (only if you use paid help): the fee, how much was paid by card and how much
            with credit, your TransitVault credit ledger, and Stripe&apos;s reference numbers.{" "}
            <strong>Card details are entered on Stripe&apos;s page and handled by Stripe; we never see or store them.</strong>
          </li>
          <li>
            <strong>Contact form messages:</strong> your name, email, topic and message, which reach us as an email.
          </li>
          <li>
            <strong>Basic server logs:</strong> the page or API path requested, time, response code and IP address, kept
            to run the service and stop abuse. We don&apos;t log query strings, and we don&apos;t use analytics or advertising
            trackers.
          </li>
        </UL>
        <p>
          Please don&apos;t post the traveller&apos;s full name, booking references or passport details. TransitVault never
          asks for them.
        </p>
      </Section>

      <Section id="why" title="3. Why we use it">
        <UL>
          <li>To run your account and sign you in.</li>
          <li>To show trips on the board, match needs with &ldquo;I&apos;m flying&rdquo; posts, and open conversations.</li>
          <li>
            To send service emails: someone reached out, a match alert (you can turn these off), reminders about your own
            posts, paid-help confirmations and the &ldquo;did they help?&rdquo; question, and password resets.
          </li>
          <li>To take paid-help payments and keep the credit ledger and records we need for tax and accounting.</li>
          <li>To keep the community safe: handle reports, hide reported posts, enforce blocks and our Terms.</li>
          <li>To answer you when you contact us.</li>
        </UL>
        <p>We don&apos;t sell your information, and we don&apos;t use it for advertising.</p>
      </Section>

      <Section id="shown" title="4. What other members see">
        <p>
          Trips are visible only to signed-in members. Other members see your <strong>first name</strong>, how many
          families have thanked you, and the trip details you post. A shared preview link (<code>/n/…</code>) shows only the
          traveller label, route, date, flights and languages, never age, notes, assistance or your name.
        </p>
        <p>
          <strong>Your phone number and email address are never shown to other members.</strong> If you want to swap
          numbers with someone, you share them yourself in a conversation. Conversations are visible only to the two people
          in them.
        </p>
      </Section>

      <Section id="processors" title="5. Who processes it for us">
        <p>We use a small number of service providers, only to run TransitVault:</p>
        <UL>
          <li>
            <strong>Cloudflare</strong> (USA): hosts the website, DNS and network protection, and stores our nightly
            database backups (Cloudflare R2).
          </li>
          <li>
            <strong>Hetzner Online</strong> (data centre in Germany): runs our API server and database, where your account,
            posts and messages are stored.
          </li>
          <li>
            <strong>Stripe</strong> (USA): processes card payments for paid help, under its own privacy policy.
          </li>
          <li>
            <strong>Google</strong> (Gmail): sends our service emails, so it handles the recipient address and the email
            content.
          </li>
        </UL>
        <p>
          Your information may therefore be processed in the United States, Germany and wherever these providers operate.
          We may also disclose information if the law requires it, or to protect someone&apos;s safety.
        </p>
      </Section>

      <Section id="retention" title="6. How long we keep it">
        <UL>
          <li>
            <strong>Account data</strong>: until you delete your account.
          </li>
          <li>
            <strong>When you delete your account</strong>, your name, email, phone and password are removed straight away,
            your open posts are closed, and you&apos;re signed out everywhere. Messages you sent stay in the other
            person&apos;s conversation (shown as from &ldquo;Deleted user&rdquo;), because they are part of their history
            too.
          </li>
          <li>
            <strong>Backups</strong>: nightly database backups are kept for up to <strong>30 days</strong>, so deleted data
            disappears from them within that time.
          </li>
          <li>
            <strong>Payment and credit records</strong> are kept even after you delete your account, as tax and accounting
            rules require, but in de-identified form: they are linked only to the anonymised &ldquo;Deleted user&rdquo;
            record, not to your name or email. Stripe keeps its own records of card payments.
          </li>
          <li>
            <strong>Contact form emails</strong> stay in our support mailbox as long as needed to deal with your request.
          </li>
        </UL>
      </Section>

      <Section id="rights" title="7. Your choices and rights">
        <UL>
          <li>
            <strong>See and correct</strong> your name and phone in <A href="/profile">Profile</A>, and edit or close your
            posts any time.
          </li>
          <li>
            <strong>Turn off match alerts</strong> in Profile.
          </li>
          <li>
            <strong>Delete your account</strong> yourself: Profile → <A href="/profile/delete">Delete account</A>.
          </li>
          <li>
            <strong>Ask us</strong> for a copy of your information, or anything else about your privacy, via{" "}
            <A href="/contact">the contact form</A> or <Mail />. We&apos;ll reply within 30 days. Depending on where you
            live, you may also have the right to complain to your local data-protection authority.
          </li>
        </UL>
      </Section>

      <Section id="storage" title="8. Cookies and local storage">
        <p>
          TransitVault sets <strong>no cookies</strong> and uses no analytics or advertising trackers. When you sign in, the
          app keeps two sign-in tokens in your browser&apos;s local storage so you stay signed in; signing out (or deleting
          your account) removes them. Stripe&apos;s checkout page, if you use it, is run by Stripe and sets its own cookies.
        </p>
      </Section>

      <Section id="children" title="9. Children">
        <p>
          Account holders must be <strong>18 or older</strong>. TransitVault is not meant for children. Details about the
          traveller are entered by an adult family member, who is responsible for having the traveller&apos;s agreement to
          share them. If you believe a child has created an account, contact us
          and we&apos;ll delete it.
        </p>
      </Section>

      <Section id="security" title="10. Security">
        <p>
          Connections are encrypted (HTTPS), passwords are hashed, and access to the database is limited to the service
          itself. No system is perfectly secure, so please don&apos;t share more about the traveller than a helper needs.
        </p>
      </Section>

      <Section id="changes" title="11. Changes">
        <p>
          If we change this policy we&apos;ll update the date at the top, and for significant changes we&apos;ll tell
          members by email or in the app before they take effect.
        </p>
      </Section>

      <Section id="contact" title="12. Contact">
        <p>
          3PandaLabs LLC, New Jersey, USA · <Mail /> · <A href="/contact">Contact form</A>
        </p>
      </Section>
    </LegalPage>
  );
}
