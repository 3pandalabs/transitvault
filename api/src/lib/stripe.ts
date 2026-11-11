// Stripe over plain HTTPS: Checkout Sessions, Refunds and webhook signatures.
// No SDK: three calls don't justify a dependency, and the API base is
// overridable (STRIPE_API_BASE) so the local smoke test can use a mock.
// Pure apart from fetch: config comes in as arguments, no env import.

import { createHmac, timingSafeEqual } from "node:crypto";

export type StripeConfig = { secretKey: string; apiBase: string };

export class StripeError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Stripe's form encoding: nested objects/arrays as a[b][0][c]=v. */
export function formEncode(obj: Record<string, unknown>, prefix = "", out = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => formEncode({ [i]: item }, key, out));
    else if (typeof v === "object") formEncode(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function stripePost<T>(cfg: StripeConfig, path: string, body: Record<string, unknown>, idempotencyKey?: string): Promise<T> {
  const res = await fetch(`${cfg.apiBase.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${cfg.secretKey}`,
      "content-type": "application/x-www-form-urlencoded",
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
    },
    body: formEncode(body).toString(),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
  if (!res.ok || !json) throw new StripeError(res.status, json?.error?.message ?? `stripe ${path} failed (${res.status})`);
  return json;
}

export type CheckoutSession = { id: string; url: string | null };

export function createCheckoutSession(
  cfg: StripeConfig,
  o: {
    acceptanceId: string;
    amountCents: number;
    currency: string;
    productName: string;
    customerEmail: string;
    successUrl: string;
    cancelUrl: string;
    expiresAt: Date;
  },
): Promise<CheckoutSession> {
  return stripePost<CheckoutSession>(
    cfg,
    "/v1/checkout/sessions",
    {
      mode: "payment",
      line_items: [{ quantity: 1, price_data: { currency: o.currency, unit_amount: o.amountCents, product_data: { name: o.productName } } }],
      client_reference_id: o.acceptanceId,
      customer_email: o.customerEmail,
      metadata: { acceptance_id: o.acceptanceId },
      payment_intent_data: { metadata: { acceptance_id: o.acceptanceId } },
      success_url: o.successUrl,
      cancel_url: o.cancelUrl,
      expires_at: Math.floor(o.expiresAt.getTime() / 1000),
    },
    `checkout-${o.acceptanceId}`,
  );
}

export function createRefund(cfg: StripeConfig, o: { paymentIntentId: string; acceptanceId: string }): Promise<{ id: string; status: string }> {
  return stripePost(cfg, "/v1/refunds", { payment_intent: o.paymentIntentId, metadata: { acceptance_id: o.acceptanceId } }, `refund-${o.acceptanceId}`);
}

// ---- webhooks --------------------------------------------------------------

export const SIGNATURE_TOLERANCE_S = 300;

/** Builds a `Stripe-Signature` header (tests and the local smoke test). */
export function signPayload(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const sig = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

/**
 * Stripe's scheme: HMAC-SHA256 over `${t}.${rawBody}` with the endpoint's
 * signing secret. Any `v1` may match, and `t` must be within the tolerance.
 */
export function verifySignature(
  payload: string,
  header: string | undefined,
  secret: string,
  nowS = Math.floor(Date.now() / 1000),
  toleranceS = SIGNATURE_TOLERANCE_S,
): boolean {
  if (!header || !secret) return false;
  let t: number | null = null;
  const sigs: string[] = [];
  for (const part of header.split(",")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === "t" && /^\d+$/.test(v)) t = Number(v);
    if (k === "v1" && v) sigs.push(v);
  }
  if (t === null || !sigs.length || Math.abs(nowS - t) > toleranceS) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex"));
  return sigs.some((s) => {
    const got = Buffer.from(s);
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

export type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      payment_status?: string;
      payment_intent?: string | null;
      client_reference_id?: string | null;
      metadata?: Record<string, string> | null;
    };
  };
};
