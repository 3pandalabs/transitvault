import { Geist, Geist_Mono } from "next/font/google";

// Scoped to the marketing/login pages only (see those pages' usage) — the
// dashboard and guest invitation pages keep their own fonts, so this isn't
// wired into the root layout's body font-family.
export const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

// Home page only: airport codes and flight numbers on the boarding-pass mock-ups.
export const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
