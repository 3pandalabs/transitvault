import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../env.js";

// Access tokens carry only the user id. The role is always read from the
// database (lib/authz.ts), so a role change takes effect immediately instead of
// after the token's 15 minutes.
export type AccessTokenPayload = { sub: string };

const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const p = jwt.verify(token, env.JWT_SECRET) as { sub: string; typ?: string };
  // A stream token is not an access token.
  if (p.typ !== undefined) throw new Error("wrong token type");
  return { sub: p.sub };
}

// Refresh tokens are `${sessionId}.${secret}` (same scheme as RsvpVault):
// the id finds the row, only a bcrypt hash of the secret is stored.
export function generateRefreshSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function parseRefreshToken(token: string): { sessionId: string; secret: string } | null {
  const idx = token.indexOf(".");
  if (idx < 0) return null;
  const sessionId = token.slice(0, idx);
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return null;
  return { sessionId, secret: token.slice(idx + 1) };
}

