import type { Metadata } from "next";
import { cityRoute } from "@/lib/airports";
import { shareAsk, shareQuestion } from "@/lib/share";
import type { PublicNeed } from "@/lib/types";
import { PublicNeedView } from "./PublicNeedView";

// Public preview of a need (api/ROUTES.md "Sharing a need"). This is the link
// people paste into WhatsApp, so the Open Graph tags are rendered on the
// server. The body is client-rendered like the rest of the app.
//
// Never indexed: it describes an elderly person travelling alone.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GENERIC: Metadata = {
  title: "Someone needs a travel companion",
  description: "TransitVault connects elderly parents flying alone with people on the same flight.",
  robots: { index: false, follow: false },
};

async function fetchFrom(base: string | undefined, id: string): Promise<PublicNeed | null> {
  if (!base) return null;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/public/needs/${id}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    return res.ok ? ((await res.json()) as PublicNeed) : null;
  } catch {
    return null;
  }
}

/** api-internal first (Worker → origin, no Cloudflare loop), then the public API host. */
async function loadNeed(id: string): Promise<PublicNeed | null> {
  if (!UUID.test(id)) return null;
  return (await fetchFrom(process.env.INTERNAL_API_URL, id)) ?? (await fetchFrom(process.env.NEXT_PUBLIC_API_URL, id));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  try {
    const { id } = await params;
    const need = await loadNeed(id);
    if (!need) return GENERIC;
    const title = shareQuestion(need);
    const description = `${shareAsk(need)} Speaks ${need.languages.join(", ")}. On TransitVault, people on the same flight can reach out.`;
    return {
      title: { absolute: title },
      description,
      robots: { index: false, follow: false },
      openGraph: { type: "website", siteName: "TransitVault", url: `/n/${need.id}`, title, description },
      twitter: { card: "summary", title, description: `${cityRoute(need.origin, need.destination)} · ${shareAsk(need)}` },
    };
  } catch {
    return GENERIC;
  }
}

export default async function PublicNeedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PublicNeedView id={id} />;
}
