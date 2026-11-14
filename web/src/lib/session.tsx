"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { getMe, getTokens, subscribeTokens } from "./api";
import { useAsync } from "./hooks";
import type { Me, User } from "./types";

const noop = () => () => {};

/** False during SSR and the hydration render, true after. useSignedIn() is
 * false on the server snapshot, so gate redirects on this: otherwise every
 * reload or deep link bounces a signed-in user to /login (TV-1). */
export function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false);
}

let exitTo: string | null = null;

/** Where AppShell should send the user when tokens disappear, instead of
 * /login. Set it just before clearTokens() (e.g. after deleting the account). */
export function leaveTo(url: string) {
  exitTo = url;
}

export function takeExit(): string | null {
  const url = exitTo;
  exitTo = null;
  return url;
}

export function useSignedIn() {
  return useSyncExternalStore(
    subscribeTokens,
    () => getTokens().access !== null || getTokens().refresh !== null,
    () => false,
  );
}

type Session = { user: User; refresh: () => void; setMe: (me: Me) => void };

const Ctx = createContext<Session | null>(null);

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession outside SessionProvider");
  return s;
}

export function SessionProvider({
  me,
  refresh,
  setMe,
  children,
}: {
  me: Me;
  refresh: () => void;
  setMe: (me: Me) => void;
  children: React.ReactNode;
}) {
  const value = useMemo<Session>(() => ({ user: me.user, refresh, setMe }), [me, refresh, setMe]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMeLoader(enabled: boolean) {
  return useAsync(getMe, enabled ? "me" : null);
}
