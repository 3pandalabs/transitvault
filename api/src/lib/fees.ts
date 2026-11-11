// Paid-help money rules (api/ROUTES.md "Paid help"). Pure: no env/db.
// All amounts are integer US cents.

export const FEE_CENTS = 1000; // $10 per trip, paid by the poster when they accept a helper
export const REWARD_CENTS = 500; // $5 TransitVault credit to the helper (not cash)
export const CURRENCY = "usd";

/** Credit covers what it can (partial allowed); the card pays the remainder. */
export function splitFee(balanceCents: number, feeCents = FEE_CENTS): { creditAppliedCents: number; cashCents: number } {
  const creditAppliedCents = Math.max(0, Math.min(Math.trunc(balanceCents), feeCents));
  return { creditAppliedCents, cashCents: feeCents - creditAppliedCents };
}

export const dollars = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
