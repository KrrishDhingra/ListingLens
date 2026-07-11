// Central pricing table. All amounts are in US cents.
//
// `costCents` = our approximate MiniMax generation cost per video
// (anchored on the app's own cost hint / MiniMax "video points": 1 point ~= 16c).
// `priceCents` = what we charge the user = 4x cost (rounded to the cent).
//
// 1080P + 10s is intentionally absent — MiniMax Hailuo-2.3 does not support it.
export type Resolution = "768P" | "1080P";
export type Duration = 6 | 10;

interface VariationPricing {
  resolution: Resolution;
  duration: Duration;
  costCents: number;
  priceCents: number;
}

// Keep the 4x multiplier in one place so it's trivial to change later.
export const PRICE_MULTIPLIER = 4;

const COST_CENTS: Array<{
  resolution: Resolution;
  duration: Duration;
  costCents: number;
}> = [
  { resolution: "768P", duration: 6, costCents: 16 },
  { resolution: "768P", duration: 10, costCents: 32 },
  { resolution: "1080P", duration: 6, costCents: 33 },
];

export const PRICING: VariationPricing[] = COST_CENTS.map((c) => ({
  ...c,
  priceCents: Math.round(c.costCents * PRICE_MULTIPLIER),
}));

/** Look up the sell price (in cents) for a resolution+duration combo. */
export function getVideoPriceCents(
  resolution: string,
  duration: number
): number | null {
  const match = PRICING.find(
    (p) => p.resolution === resolution && p.duration === duration
  );
  return match ? match.priceCents : null;
}

/** Format a cents amount as a USD string, e.g. 132 -> "$1.32". */
export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Minimum wallet top-up (in cents). Keeps a single charge above LemonSqueezy /
// card-processing flat fees, and covers at least ~5 videos as requested.
export const MIN_TOPUP_CENTS = 700; // $7.00 ~= five 1080P/6s videos
