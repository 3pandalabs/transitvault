import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Footer } from "@/components/Footer";
import { geistSans } from "@/lib/fonts";
import { SITE_URL } from "@/lib/site";

const TITLE = "TransitVault — A companion on your parent's flight | by 3PandaLabs";
const DESCRIPTION =
  "Parent flying alone? Post their flight, connections and layovers. Someone on the same flight can reach out and keep them company.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Home "<App> — <line> | by 3PandaLabs"; every other page "<Page> — TransitVault".
  title: { default: TITLE, template: "%s — TransitVault" },
  description: DESCRIPTION,
  applicationName: "TransitVault",
  openGraph: {
    type: "website",
    siteName: "TransitVault by 3PandaLabs",
    locale: "en_IN",
    url: "/",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "TransitVault — A companion on your parent's flight" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/og.png"] },
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
