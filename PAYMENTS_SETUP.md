# Wallet & Payments Setup (LemonSqueezy)

Users top up a **prepaid wallet** with any amount, then each video draws down
their balance at **4× our MiniMax cost**. Admin (`krrishdhingra574@gmail.com`)
is always free. This file lists the one-time setup you need to do.

## Pricing (4× cost)

| Variation   | Our cost | Price (4×) |
|-------------|----------|------------|
| 768P · 6s   | $0.16    | **$0.64**  |
| 768P · 10s  | $0.32    | **$1.28**  |
| 1080P · 6s  | $0.33    | **$1.32**  |
| 1080P · 10s | —        | not supported |

Edit these in `src/lib/pricing.ts` (`COST_CENTS` + `PRICE_MULTIPLIER`).
Minimum top-up is `$7` (`MIN_TOPUP_CENTS`).

## LemonSqueezy steps

1. Create an account at lemonsqueezy.com and activate your store.
2. Create a **product** called "Wallet top-up" with a single variant. Any base
   price is fine — the app overrides it per checkout with `custom_price`.
3. Get these IDs/keys:
   - **API key** — Settings → API → create key → `LEMONSQUEEZY_API_KEY`
   - **Store ID** — Settings → Stores (numeric) → `LEMONSQUEEZY_STORE_ID`
   - **Variant ID** — open the product, the variant's numeric id → `LEMONSQUEEZY_VARIANT_ID`
4. Create a **webhook**: Settings → Webhooks → add.
   - Callback URL: `https://YOUR_DOMAIN/api/webhooks/lemonsqueezy`
   - Signing secret: any random 6–40 char string → `LEMONSQUEEZY_WEBHOOK_SECRET`
   - Events: at least **order_created**
5. Set `NEXT_PUBLIC_APP_URL` to your deployed URL (used for post-payment redirect).

## Env vars

Add to `.env.local` (local) and Vercel (production):

```
LEMONSQUEEZY_API_KEY=
LEMONSQUEEZY_STORE_ID=
LEMONSQUEEZY_VARIANT_ID=
LEMONSQUEEZY_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=https://your-domain
```

Keep the existing **secret** env vars (`MINIMAX_API_KEY`, all `FIREBASE_*`) — those
must never be hardcoded. `VIDEO_GENERATION_ENABLED` (kill switch) stays too.
`RATE_LIMIT_PER_USER_PER_DAY` and `UNLIMITED_EMAILS` are **removed** — the wallet
now governs usage and the admin email is hardcoded in `src/lib/server-auth.ts`.

## How it flows

1. User clicks **+ Add funds** → enters an amount → `POST /api/wallet` creates a
   LemonSqueezy checkout (`custom_price`, tagged with their `user_id`).
2. They pay on LemonSqueezy (LemonSqueezy handles all tax/VAT as merchant of record).
3. LemonSqueezy calls `POST /api/webhooks/lemonsqueezy` → signature verified →
   wallet credited (idempotent per order).
4. On generate, the video price is deducted up-front; if generation fails to
   start or MiniMax fails, the charge is **automatically refunded**.

## Testing without going live

Use LemonSqueezy **test mode** (toggle in dashboard, test API key). For the
webhook to reach `localhost`, tunnel it (e.g. `ngrok http 3000`) and use the
tunnel URL as the callback.

## Still to build (deferred)

- Public "featured creations" gallery on the home page + default-checked
  display-consent at signup.
- Hide model/cost hints in the UI (remove the "Estimated cost / Powered by
  MiniMax" copy on the home page).
