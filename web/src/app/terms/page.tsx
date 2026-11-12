import type { Metadata } from "next";
import { A, EFFECTIVE_DATE, LegalPage, Mail, Section, UL } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The agreement between you and 3PandaLabs LLC for using TransitVault: what it is and isn't, paid help, credit, and liability.",
  alternates: { canonical: "/terms" },
};

const TOC = [
  { id: "agreement", title: "The agreement" },
  { id: "eligibility", title: "Who can use TransitVault" },
  { id: "what", title: "What TransitVault is, and isn't" },
  { id: "responsibilities", title: "Your responsibilities" },
  { id: "paid", title: "Paid help" },
  { id: "credit", title: "TransitVault credit" },
  { id: "safety", title: "Reports, blocks and removal" },
  { id: "content", title: "Your content" },
  { id: "deletion", title: "Ending your account" },
  { id: "disclaimers", title: "Disclaimers" },
  { id: "liability", title: "Limitation of liability" },
  { id: "indemnity", title: "Indemnity" },
  { id: "law", title: "Governing law" },
  { id: "changes", title: "Changes" },
  { id: "contact", title: "Contact" },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      updated={EFFECTIVE_DATE}
      toc={TOC}
      intro={
        <p>
          Short version: TransitVault connects families with fellow passengers who offer to keep an eye on someone flying
          alone. Helpers are doing a favour. They are not staff, escorts or a care service, and we don&apos;t check who
          anyone is. Use common sense, meet in public airport areas, and still book the airline&apos;s own assistance.
        </p>
      }
    >
      <Section id="agreement" title="1. The agreement">
        <p>
          These terms are the agreement between you and <strong>3PandaLabs LLC</strong>, a New Jersey (USA) limited
          liability company (&ldquo;3PandaLabs&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;), for using TransitVault. By creating
          an account or using the service you agree to them and to our <A href="/privacy">Privacy Policy</A>.
        </p>
      </Section>

      <Section id="eligibility" title="2. Who can use TransitVault">
        <p>
          You must be <strong>18 or older</strong> and able to enter a binding agreement. One account per person; keep your
          password to yourself. You may post a trip for someone else (a parent, relative or friend) if you have their
          agreement to share their trip details.
        </p>
      </Section>

      <Section id="what" title="3. What TransitVault is, and isn't">
        <p>
          TransitVault is a <strong>board</strong>: families post a trip, other members browse it, and someone on a matching
          flight can reach out in a private conversation. What happens next is between the people involved.
        </p>
        <UL>
          <li>
            <strong>Helpers are fellow passengers doing a favour.</strong> They are not our employees, agents, contractors,
            escorts, or a care, medical, mobility or assistance service, and we don&apos;t supervise them.
          </li>
          <li>
            <strong>We don&apos;t verify</strong> identities, flights, bookings, ages or anything else members tell us.
          </li>
          <li>
            <strong>TransitVault is not affiliated with any airline or airport</strong>, and can&apos;t act on your behalf
            with them.
          </li>
          <li>
            We don&apos;t track flights or people, and <strong>we can&apos;t help in real time</strong>. For anything urgent
            at the airport, speak to airline or airport staff, or call local emergency services.
          </li>
        </UL>
      </Section>

      <Section id="responsibilities" title="4. Your responsibilities">
        <UL>
          <li>Post accurate trip details and keep them up to date; close a post you no longer need.</li>
          <li>
            Don&apos;t post the traveller&apos;s full name, booking references, passport or payment details.
          </li>
          <li>
            No harassment, threats, discrimination, spam, scams, requests for money, advertising, or using TransitVault for
            anything unlawful. Don&apos;t ask a helper to carry items for anyone.
          </li>
          <li>
            <strong>Meet in public areas of the airport</strong> (gates, transfer desks, arrivals), and share contact details
            only when you&apos;re comfortable.
          </li>
          <li>
            <strong>Families: still book the airline&apos;s own special assistance</strong> (wheelchair, meet-and-assist)
            for anyone who needs it. It&apos;s usually free and should be booked at least 48 hours ahead. A helper is a
            friendly extra, not a replacement.
          </li>
          <li>Don&apos;t scrape the site, interfere with it, or try to access other people&apos;s accounts or data.</li>
        </UL>
      </Section>

      <Section id="paid" title="5. Paid help">
        <p>
          Posting, browsing, reaching out and messaging are free. When paid help is switched on, a family that accepts a
          helper for a trip pays a <strong>fee of US$10 per trip</strong>, charged when they accept the helper (by card
          through Stripe, after any TransitVault credit they have is applied).
        </p>
        <UL>
          <li>
            The fee pays for the TransitVault service. It is <strong>not</strong> a payment to the helper and doesn&apos;t
            make the helper a hired escort or service provider.
          </li>
          <li>
            After the trip, if the family confirms the helper helped (or doesn&apos;t answer within 48 hours of our
            &ldquo;did they help?&rdquo; email), the helper receives <strong>US$5 TransitVault credit</strong> as a thank-you,
            unless they chose to help for free.
          </li>
          <li>
            <strong>The fee isn&apos;t refundable as cash</strong>, except as below. If the family tells us the helper{" "}
            <strong>didn&apos;t show</strong>, the full fee comes back as TransitVault credit. If you&apos;d rather have the
            card part refunded, ask us within 30 days via <A href="/contact">Contact us</A>; card refunds are{" "}
            <strong>at our discretion</strong> and come back out of the credit we gave you, so they aren&apos;t possible once
            that credit has been spent.
          </li>
          <li>
            We may change the fee or switch paid help off. Changes don&apos;t affect a trip you have already paid for.
          </li>
          <li>Nothing here limits any refund right you have under laws that can&apos;t be excluded.</li>
        </UL>
      </Section>

      <Section id="credit" title="6. TransitVault credit">
        <UL>
          <li>
            Credit has <strong>no cash value</strong>, can&apos;t be withdrawn, sold or exchanged, and is{" "}
            <strong>non-transferable</strong>.
          </li>
          <li>It can only be used toward your own TransitVault fees.</li>
          <li>
            Credit is <strong>forfeited when you delete your account</strong>, and we may end it if TransitVault shuts down.
          </li>
          <li>
            We may reverse or adjust credit that was obtained by mistake, fraud or abuse (for example, fake trips or helpers
            working together to earn rewards).
          </li>
        </UL>
      </Section>

      <Section id="safety" title="7. Reports, blocks and removal">
        <p>
          You can report a post or a member, and block anyone. A post reported by several different people is hidden
          automatically while we look at it. We may remove content, hide posts, limit features, or suspend or close
          accounts that break these terms or put people at risk, with or without notice. If we close your account for a
          serious breach, any credit is forfeited.
        </p>
      </Section>

      <Section id="content" title="8. Your content">
        <p>
          You own what you post. You give us permission to store it, show it to other members as the service describes,
          and use it to run and protect TransitVault. You&apos;re responsible for what you post and confirm you&apos;re
          allowed to share it.
        </p>
      </Section>

      <Section id="deletion" title="9. Ending your account">
        <p>
          You can delete your account at any time from Profile → <A href="/profile/delete">Delete account</A>. Deletion
          has to wait while a paid-help trip you&apos;re part of is still in progress. What we keep afterwards is described
          in the <A href="/privacy">Privacy Policy</A>.
        </p>
      </Section>

      <Section id="disclaimers" title="10. Disclaimers">
        <p>
          TransitVault is provided <strong>&ldquo;as is&rdquo; and &ldquo;as available&rdquo;</strong>. To the maximum extent
          the law allows, we make no promises that it will be available, error-free, or that anyone will offer to help on a
          given trip, and we disclaim all implied warranties (including merchantability, fitness for a particular purpose
          and non-infringement).
        </p>
        <p>
          We are not responsible for the conduct of members, on or off TransitVault, or for what they do or don&apos;t do at
          the airport or on board. You deal with other members at your own risk.
        </p>
      </Section>

      <Section id="liability" title="11. Limitation of liability">
        <p>
          To the maximum extent permitted by law, 3PandaLabs and its members, managers and contractors are not liable for
          any indirect, incidental, special, consequential or punitive damages, or for any injury, illness, loss, theft,
          damage, missed flight or connection, delay, or expense arising from your use of TransitVault or from any
          member&apos;s conduct.
        </p>
        <p>
          Our total liability to you for any claim is limited to the <strong>fees you paid us in the 12 months</strong>{" "}
          before the claim arose (which may be zero, since most use is free). Nothing in these terms limits liability that
          the law doesn&apos;t allow to be limited.
        </p>
      </Section>

      <Section id="indemnity" title="12. Indemnity">
        <p>
          You agree to defend and compensate 3PandaLabs for claims, losses and costs (including reasonable legal fees)
          brought by others that arise from your content, your dealings with other members, or your breach of these terms or
          the law.
        </p>
      </Section>

      <Section id="law" title="13. Governing law">
        <p>
          These terms are governed by the laws of the <strong>State of New Jersey, USA</strong>, without regard to its
          conflict-of-laws rules, and disputes with 3PandaLabs are heard in the state or federal courts located in New
          Jersey. You and we both agree to that jurisdiction. Before going to court, please contact us so we can try to
          sort it out.
        </p>
      </Section>

      <Section id="changes" title="14. Changes">
        <p>
          We may update these terms. We&apos;ll change the date at the top and, for significant changes, tell members by
          email or in the app before they take effect. Using TransitVault after that means you accept the new terms.
        </p>
      </Section>

      <Section id="contact" title="15. Contact">
        <p>
          3PandaLabs LLC, New Jersey, USA · <Mail /> · <A href="/contact">Contact form</A>
        </p>
      </Section>
    </LegalPage>
  );
}
