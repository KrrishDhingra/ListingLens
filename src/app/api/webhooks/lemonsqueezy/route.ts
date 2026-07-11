import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyWebhookSignature } from "@/lib/lemonsqueezy";
import { FieldValue } from "firebase-admin/firestore";

// LemonSqueezy sends the signature in the X-Signature header and nests our
// checkout custom data under meta.custom_data.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventName = payload?.meta?.event_name;
  // We only care about successful one-off purchases (wallet top-ups).
  if (eventName !== "order_created") {
    return NextResponse.json({ ok: true, ignored: eventName });
  }

  const userId = payload?.meta?.custom_data?.user_id;
  const orderId = String(payload?.data?.id ?? "");
  const attrs = payload?.data?.attributes ?? {};
  // Credit the amount the user chose to add (subtotal), not the tax-inclusive
  // total — tax is collected by LemonSqueezy as merchant of record.
  const creditCents = Number(attrs.subtotal ?? attrs.total ?? 0);
  const paid = attrs.status === "paid";

  if (!userId || !orderId || !paid || creditCents <= 0) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Idempotency: record the order under the user and only credit once.
  const userRef = adminDb.collection("users").doc(userId);
  const orderRef = userRef.collection("topups").doc(orderId);

  await adminDb.runTransaction(async (tx) => {
    const existing = await tx.get(orderRef);
    if (existing.exists) return; // already processed this order

    tx.set(orderRef, {
      orderId,
      amountCents: creditCents,
      createdAt: Date.now(),
    });
    tx.set(
      userRef,
      { walletBalanceCents: FieldValue.increment(creditCents) },
      { merge: true }
    );
  });

  return NextResponse.json({ ok: true });
}
