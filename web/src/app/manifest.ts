import type { MetadataRoute } from "next";

// Installable PWA. No service worker: nothing here needs to work offline.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TransitVault",
    short_name: "TransitVault",
    description: "Parent flying alone? Post their flight, and someone on the same flight can reach out.",
    start_url: "/needs",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#1d4ed8",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
