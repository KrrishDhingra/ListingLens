import { NextResponse } from "next/server";

// Safe diagnostic: reports whether each LemonSqueezy env var is present at
// runtime WITHOUT revealing any secret values. Open in a browser:
//   /api/debug/lemonsqueezy
export async function GET() {
  const val = (v?: string) => ({
    present: !!v && v.trim().length > 0,
    length: v ? v.trim().length : 0,
  });

  return NextResponse.json({
    LEMONSQUEEZY_API_KEY: val(process.env.LEMONSQUEEZY_API_KEY),
    LEMONSQUEEZY_STORE_ID: {
      ...val(process.env.LEMONSQUEEZY_STORE_ID),
      value: process.env.LEMONSQUEEZY_STORE_ID || null, // not secret
    },
    LEMONSQUEEZY_VARIANT_ID: {
      ...val(process.env.LEMONSQUEEZY_VARIANT_ID),
      value: process.env.LEMONSQUEEZY_VARIANT_ID || null, // not secret
    },
    LEMONSQUEEZY_WEBHOOK_SECRET: val(process.env.LEMONSQUEEZY_WEBHOOK_SECRET),
    NEXT_PUBLIC_APP_URL: {
      ...val(process.env.NEXT_PUBLIC_APP_URL),
      value: process.env.NEXT_PUBLIC_APP_URL || null,
    },
  });
}
