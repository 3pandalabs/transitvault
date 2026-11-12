import type { Metadata } from "next";
import { A, LegalPage, Mail } from "@/components/LegalPage";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Contact TransitVault: questions, payments and credit, safety reports, or deleting your data.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <LegalPage
      title="Contact us"
      intro={
        <>
          <p>
            Send us a message below, or email <Mail /> directly. Many answers are already in the <A href="/faq">FAQ</A>.
          </p>
          <p className="text-sm text-fg-muted">
            Urgent issue at the airport? Contact the airline or airport staff first. We can&apos;t intervene in real time.
          </p>
        </>
      }
    >
      <div className="relative">
        <ContactForm />
      </div>
    </LegalPage>
  );
}
