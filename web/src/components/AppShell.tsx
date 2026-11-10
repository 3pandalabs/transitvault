"use client";

import { LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, logout } from "@/lib/api";
import { SessionProvider, useMeLoader, useSignedIn } from "@/lib/session";
import { cn } from "@/lib/utils";
import { Backdrop } from "./Backdrop";
import { LoadError, Loading } from "./common";
import { Logo } from "./Wordmark";

function loginUrl() {
  const here = window.location.pathname + window.location.search;
  return here === "/needs" ? "/login" : `/login?next=${encodeURIComponent(here)}`;
}

/**
 * Gate on what renders, NOT a security boundary: every request carries a
 * bearer token the API validates. No middleware (see ../../CLAUDE.md).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const me = useMeLoader(signedIn);

  useEffect(() => {
    if (!signedIn) router.replace(loginUrl());
  }, [signedIn, router]);

  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) router.replace(loginUrl());
  }, [me.error, router]);

  if (!signedIn) return null;

  return (
    <div className="min-h-screen">
      <Backdrop />
      {me.data ? (
        <SessionProvider me={me.data} refresh={me.reload} setMe={me.setData}>
          <Header />
          <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">{children}</main>
        </SessionProvider>
      ) : (
        <main className="mx-auto max-w-6xl px-4 py-8">
          {me.error ? <LoadError error={me.error} onRetry={me.reload} /> : <Loading />}
        </main>
      )}
    </div>
  );
}

const LINKS = [
  { href: "/needs", label: "Browse needs" },
  { href: "/needs/new", label: "Post a need" },
  { href: "/my-needs", label: "My needs" },
  { href: "/messages", label: "Messages" },
  { href: "/profile", label: "Profile" },
];

/** The most specific nav link that matches the current path. */
function activeHref(pathname: string): string | undefined {
  return LINKS.map((l) => l.href)
    .filter((h) => pathname === h || pathname.startsWith(`${h}/`))
    .sort((a, b) => b.length - a.length)[0];
}

function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await logout().catch(() => undefined);
    router.replace("/login");
  }

  const active = activeHref(pathname);
  const nav = LINKS.map((l) => (
    <Link
      key={l.href}
      href={l.href}
      onClick={() => setOpen(false)}
      className={cn(
        "rounded-full px-3 py-1.5 text-sm text-fg-muted hover:bg-zinc-100 hover:text-fg",
        active === l.href ? "bg-zinc-100 font-medium text-fg" : "",
      )}
    >
      {l.label}
    </Link>
  ));

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
        <Logo href="/needs" />
        <nav className="hidden items-center gap-1 md:flex">{nav}</nav>
        <div className="flex items-center gap-2">
          <button
            onClick={signOut}
            className="hidden items-center gap-1 rounded-full px-3 py-1.5 text-sm text-fg-muted hover:bg-zinc-100 hover:text-fg md:inline-flex"
          >
            <LogOut className="size-4" /> Sign out
          </button>
          <button className="rounded-full p-2 md:hidden" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {open ? (
        <div className="border-t border-line px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">{nav}</nav>
          <button onClick={signOut} className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 text-sm text-fg-muted">
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      ) : null}
    </header>
  );
}

