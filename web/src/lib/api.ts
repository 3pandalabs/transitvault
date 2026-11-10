"use client";

// Typed client for api/ROUTES.md. The whole web app is client-rendered and
// talks to the API straight from the browser (same as BorrowVault): no
// server-side fetch means no orange-to-orange problem, and the API's bearer
// check stays the only authorization boundary.

import type { AuthResponse, Conversation, ConversationSummary, Me, Message, Need, NeedInput, NeedPatch, NeedSummary, User } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly body?: Record<string, unknown> | null,
  ) {
    super(message);
  }
}

// Errors whose `error` is a code rather than prose get human copy here.
const MESSAGE_COPY: Record<string, string> = {
  registration_failed: "We couldn't create that account. If you already have one, sign in instead.",
  invalid_credentials: "That email and password don't match.",
  invalid_or_expired_token: "This reset link has expired or was already used. Ask for a new one.",
  own_need: "This is your own post. People on the same flight can reach out to you.",
  need_not_open: "This need is no longer open, so you can’t reach out to it.",
  rate_limited: "You're doing that too often. Wait a minute and try again.",
};

/** Human message for any thrown value. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (Object.prototype.hasOwnProperty.call(MESSAGE_COPY, e.message)) return MESSAGE_COPY[e.message];
    if (e.status === 429) return MESSAGE_COPY.rate_limited;
    if (e.status === 404) return "Not found.";
    if (e.message && e.message !== "request_failed") return e.message;
    if (e.status === 403) return "You can't do that.";
    return "Something went wrong.";
  }
  if (e instanceof TypeError) return "Couldn't reach the server. Check your connection and try again.";
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong.";
}

// ---- tokens ----

const ACCESS_KEY = "tv_access_token";
const REFRESH_KEY = "tv_refresh_token";
const TOKEN_EVENT = "tv-tokens";

export function getTokens() {
  if (typeof window === "undefined") return { access: null, refresh: null };
  try {
    return {
      access: window.localStorage.getItem(ACCESS_KEY),
      refresh: window.localStorage.getItem(REFRESH_KEY),
    };
  } catch {
    return { access: null, refresh: null };
  }
}

export function setTokens(access: string, refresh: string) {
  window.localStorage.setItem(ACCESS_KEY, access);
  window.localStorage.setItem(REFRESH_KEY, refresh);
  window.dispatchEvent(new Event(TOKEN_EVENT));
}

export function clearTokens() {
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
  window.dispatchEvent(new Event(TOKEN_EVENT));
}

/** Subscribe to token changes in this tab and others (for useSyncExternalStore). */
export function subscribeTokens(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(TOKEN_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(TOKEN_EVENT, onChange);
  };
}

// One refresh in flight at a time: refresh tokens rotate, so two parallel 401s
// each spending the same refresh token would log the user out.
let refreshing: Promise<string | null> | null = null;

function refreshTokens(): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const { refresh } = getTokens();
    if (!refresh) return null;
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (!res.ok) {
        clearTokens();
        return null;
      }
      const data = (await res.json()) as AuthResponse;
      setTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function toError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as ({ error?: string; code?: string } & Record<string, unknown>) | null;
  return new ApiError(res.status, body?.error ?? "request_failed", body?.code, body);
}

type Opts = { method?: string; body?: unknown; auth?: boolean };

async function call<T>(path: string, { method = "GET", body, auth = true }: Opts = {}): Promise<T> {
  const send = (token: string | null) =>
    fetch(`${API_URL}${path}`, {
      method,
      headers: {
        // Only when there IS a body: Fastify rejects a declared-JSON empty body.
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(auth && token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let res = await send(auth ? getTokens().access : null);
  if (auth && res.status === 401) {
    const fresh = await refreshTokens();
    if (!fresh) throw new ApiError(401, "Your session has ended. Please sign in again.");
    res = await send(fresh);
  }
  if (!res.ok) throw await toError(res);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

const enc = encodeURIComponent;

// ---- auth / profile ----

export const signup = (b: { email: string; password: string; name: string; phone: string }) =>
  call<AuthResponse>("/auth/signup", { method: "POST", body: b, auth: false });
export const login = (b: { email: string; password: string }) =>
  call<AuthResponse>("/auth/login", { method: "POST", body: b, auth: false });
export async function logout() {
  const { refresh } = getTokens();
  try {
    if (refresh) await call<void>("/auth/logout", { method: "POST", body: { refreshToken: refresh } });
  } finally {
    clearTokens();
  }
}
export const requestPasswordReset = (email: string) =>
  call<void>("/auth/password-reset/request", { method: "POST", body: { email }, auth: false });
export const confirmPasswordReset = (token: string, password: string) =>
  call<void>("/auth/password-reset/confirm", { method: "POST", body: { token, password }, auth: false });

export const getMe = () => call<Me>("/me");
export const updateMe = (b: { name?: string; phone?: string }) => call<{ user: User }>("/me", { method: "PATCH", body: b });

// ---- needs ----

export const listNeeds = () => call<NeedSummary[]>("/needs");
export const listMyNeeds = () => call<NeedSummary[]>("/needs/mine");
export const createNeed = (b: NeedInput) => call<Need>("/needs", { method: "POST", body: b });
export const getNeed = (id: string) => call<Need>(`/needs/${enc(id)}`);
export const updateNeed = (id: string, b: NeedPatch) => call<Need>(`/needs/${enc(id)}`, { method: "PATCH", body: b });
export const reachOut = (id: string, b: { message: string; myFlightNumbers?: string[] }) =>
  call<Conversation>(`/needs/${enc(id)}/reach-out`, { method: "POST", body: b });

// ---- conversations ----

export const listConversations = () => call<ConversationSummary[]>("/conversations");
export const getConversation = (id: string) => call<Conversation>(`/conversations/${enc(id)}`);
export const listMessages = (id: string) => call<Message[]>(`/conversations/${enc(id)}/messages`);
export const sendMessage = (id: string, body: string) =>
  call<Message>(`/conversations/${enc(id)}/messages`, { method: "POST", body: { body } });
