import type { Metadata } from "next";
import { A, LegalPage } from "@/components/LegalPage";
import { FaqList } from "./FaqList";

export const metadata: Metadata = {
  title: "FAQ",
  description: "How TransitVault works: posting a trip for a parent flying alone, matching, helpers, safety, credit and your account.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  return (
    <LegalPage
      title="Frequently asked questions"
      intro={
        <p>
          Can&apos;t find your answer? See <A href="/support">Support</A> or <A href="/contact">contact us</A>.
        </p>
      }
    >
      <FaqList />
    </LegalPage>
  );
}
