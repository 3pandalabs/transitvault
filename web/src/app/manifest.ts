import type { MetadataRoute } from "next";

// Web app manifest, served at /manifest.webmanifest. Two consumers:
//
// 1. Browsers offering "Install app" / "Add to Home screen". No service
//    worker: nothing here needs to work offline.
// 2. The Android app (android/, a Trusted Web Activity built with Bubblewrap),
//    whose twa-manifest.json mirrors the name, colours, icons and start URL
//    below. Change one, change the other, and rebuild the AAB.
//
// The raster icons are rendered by infra/play-store/tools/build-graphics.mjs
// from src/app/icon.svg; rerun it rather than editing them by hand.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/needs",
    name: "TransitVault",
    short_name: "TransitVault",
    description: "Parent flying alone? Post their flight, and someone on the same flight can reach out.",
    start_url: "/needs",
    scope: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#1d4ed8",
    categories: ["travel", "lifestyle", "social"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
