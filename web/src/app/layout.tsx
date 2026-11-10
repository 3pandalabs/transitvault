import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Footer } from "@/components/Footer";
import { geistSans } from "@/lib/fonts";
import { SITE_URL } from "@/lib/site";

const TITLE = "TransitVault: a companion on your parent's flight";
const DESCRIPTION =
  "Parent flying alone? Post their flight, connections and layovers. Someone on the same flight can reach out and keep them company.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s · TransitVault" },
  description: DESCRIPTION,
  applicationName: "TransitVault",
  openGraph: { type: "website", siteName: "TransitVault", locale: "en_IN", url: SITE_URL, title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = { themeColor: "#1d4ed8" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`flex min-h-screen flex-col antialiased ${geistSans.variable}`}>
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
