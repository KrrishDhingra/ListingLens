import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getUserFromRequest } from "@/lib/server-auth";
import { createTopupCheckout } from "@/lib/lemonsqueezy";
import { MIN_TOPUP_CENTS } from "@/lib/pricing";

// GET /api/wallet -> current wallet balance (in cents) for the authed user
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snap = await adminDb.collection("users").doc(user.userId).get();
  const balanceCents = (snap.data()?.walletBalanceCents as number) || 0;

  return NextResponse.json({ balanceCents, isAdmin: user.isAdmin });
}

// POST /api/wallet  { amountCents }  -> creates a LemonSqueezy top-up checkout
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { amountCents } = await req.json().catch(() => ({}));
  const amount = Number(amountCents);

  if (!Number.isFinite(amount) || amount < MIN_TOPUP_CENTS) {
    return NextResponse.json(
      { error: `Minimum top-up is ${MIN_TOPUP_CENTS / 100} USD.` },
      { status: 400 }
    );
  }
  if (amount > 100000) {
    return NextResponse.json(
      { error: "Maximum single top-up is $1000." },
      { status: 400 }
    );
  }

  try {
    const url = await createTopupCheckout(
      user.userId,
      user.userEmail,
      Math.round(amount)
    );
    return NextResponse.json({ url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
