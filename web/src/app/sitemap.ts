import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Public, indexable URLs only: the landing page and the help/legal pages.
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["/faq", "/support", "/contact", "/privacy", "/terms"];
  return [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "monthly", priority: 1 },
    ...pages.map((p) => ({ url: `${SITE_URL}${p}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
