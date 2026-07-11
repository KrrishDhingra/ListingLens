import crypto from "crypto";

// LemonSqueezy integration (merchant of record).
// Required env vars:
//   LEMONSQUEEZY_API_KEY      - API key (Settings > API)
//   LEMONSQUEEZY_STORE_ID     - numeric store id
//   LEMONSQUEEZY_VARIANT_ID   - variant id of the "Wallet top-up" product
//   LEMONSQUEEZY_WEBHOOK_SECRET - signing secret configured on the webhook
//   NEXT_PUBLIC_APP_URL       - base URL for post-checkout redirect

const LS_BASE = "https://api.lemonsqueezy.com/v1";

/**
 * Create a LemonSqueezy checkout for an arbitrary top-up amount.
 * We override the variant price with `custom_price` (cents) and tag the
 * checkout with the user's id so the webhook knows whose wallet to credit.
 * Returns the hosted checkout URL.
 */
export async function createTopupCheckout(
  userId: string,
  email: string | null,
  amountCents: number
): Promise<string> {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  const variantId = process.env.LEMONSQUEEZY_VARIANT_ID;
  const missing: string[] = [];
  if (!apiKey) missing.push("LEMONSQUEEZY_API_KEY");
  if (!storeId) missing.push("LEMONSQUEEZY_STORE_ID");
  if (!variantId) missing.push("LEMONSQUEEZY_VARIANT_ID");
  if (missing.length) {
    throw new Error(`LemonSqueezy not configured — missing: ${missing.join(", ")}`);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";

  const body = {
    data: {
      type: "checkouts",
      attributes: {
        custom_price: amountCents,
        checkout_data: {
          email: email || undefined,
          custom: { user_id: userId },
        },
        product_options: appUrl
          ? { redirect_url: `${appUrl}/jobs?topup=success` }
          : undefined,
      },
      relationships: {
        store: { data: { type: "stores", id: String(storeId) } },
        variant: { data: { type: "variants", id: String(variantId) } },
      },
    },
  };

  const res = await fetch(`${LS_BASE}/checkouts`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`LemonSqueezy checkout failed ${res.status}: ${text}`);
  }

  const json = JSON.parse(text);
  const url = json?.data?.attributes?.url;
  if (!url) throw new Error("LemonSqueezy did not return a checkout URL");
  return url as string;
}

/**
 * Verify a webhook came from LemonSqueezy by comparing the X-Signature header
 * against an HMAC-SHA256 of the raw request body using the signing secret.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signatureHeader, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
