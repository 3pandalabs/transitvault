import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Only the landing page is public. Authed pages also send `robots: { index:
// false }` from their layout, which is the stronger signal (a robots.txt-blocked
// URL can still be indexed from a link).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/needs", "/my-needs", "/messages", "/profile", "/login", "/signup", "/forgot-password", "/reset-password"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
