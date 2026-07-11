import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { createVideoTask, VideoStyle } from "@/lib/minimax";
import { getUserFromRequest } from "@/lib/server-auth";
import { getVideoPriceCents, formatUsd } from "@/lib/pricing";
import { v4 as uuidv4 } from "uuid";

export const maxDuration = 60;

const STYLE_LABELS: Record<VideoStyle, string> = {
  walkthrough: "Property Walkthrough",
  remove_furniture: "Remove Furniture",
  drone: "Drone / Aerial Shot",
  day_to_night: "Day to Night",
  virtual_staging: "Virtual Staging",
};

const VALID_COMBOS: Array<{ resolution: string; duration: number }> = [
  { resolution: "768P", duration: 6 },
  { resolution: "768P", duration: 10 },
  { resolution: "1080P", duration: 6 },
];

const VALID_STYLES: VideoStyle[] = [
  "walkthrough",
  "remove_furniture",
  "drone",
  "day_to_night",
  "virtual_staging",
];

export async function POST(req: NextRequest) {
  // Kill switch — set VIDEO_GENERATION_ENABLED=0 in Vercel to disable instantly
  if (process.env.VIDEO_GENERATION_ENABLED === "0") {
    return NextResponse.json(
      { error: "Video generation is temporarily disabled." },
      { status: 503 }
    );
  }

  // Auth is now required — generation costs money.
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const formData = await req.formData();
  const style = formData.get("style") as VideoStyle;
  const userNotes = (formData.get("notes") as string) || undefined;
  const resolution = formData.get("resolution") as "768P" | "1080P";
  const duration = parseInt(formData.get("duration") as string) as 6 | 10;
  const files = formData.getAll("images") as File[];

  // --- Server-side validation (cannot be bypassed by UI or prompt injection) ---
  if (!files.length) {
    return NextResponse.json({ error: "No images provided" }, { status: 400 });
  }
  if (!VALID_STYLES.includes(style)) {
    return NextResponse.json({ error: "Invalid style." }, { status: 400 });
  }
  if (!VALID_COMBOS.some((c) => c.resolution === resolution && c.duration === duration)) {
    return NextResponse.json(
      { error: `Invalid resolution/duration combination. Allowed: 768P+6s, 768P+10s, 1080P+6s.` },
      { status: 400 }
    );
  }

  const priceCents = getVideoPriceCents(resolution, duration);
  if (priceCents === null) {
    return NextResponse.json({ error: "Unsupported video option." }, { status: 400 });
  }

  const userRef = adminDb.collection("users").doc(user.userId);

  // --- Billing: charge the wallet up-front (admins are free) ---
  // We reserve funds before doing any expensive work, and refund below if
  // generation fails to start.
  if (!user.isAdmin) {
    try {
      await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        const balance = (snap.data()?.walletBalanceCents as number) || 0;
        if (balance < priceCents) {
          throw new Error("INSUFFICIENT_FUNDS");
        }
        tx.set(
          userRef,
          { walletBalanceCents: FieldValue.increment(-priceCents) },
          { merge: true }
        );
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "INSUFFICIENT_FUNDS") {
        return NextResponse.json(
          {
            error: `Not enough balance. This video costs ${formatUsd(
              priceCents
            )}. Please add funds.`,
            code: "INSUFFICIENT_FUNDS",
          },
          { status: 402 }
        );
      }
      throw err;
    }
  }

  // Helper to give the money back if we fail before generation kicks off.
  const refund = async () => {
    if (!user.isAdmin) {
      await userRef.set(
        { walletBalanceCents: FieldValue.increment(priceCents) },
        { merge: true }
      );
    }
  };

  const jobId = uuidv4();
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;
  const bucket = adminStorage.bucket(bucketName);
  const imageUrls: string[] = [];

  try {
    // Upload all images to Firebase Storage
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = file.name.split(".").pop() || "jpg";
      const path = `jobs/${jobId}/${uuidv4()}.${ext}`;
      const fileRef = bucket.file(path);
      await fileRef.save(buffer, {
        contentType: file.type,
        metadata: { cacheControl: "public, max-age=31536000" },
      });
      const [signedUrl] = await fileRef.getSignedUrl({
        action: "read",
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });
      imageUrls.push(signedUrl);
    }

    const coverImageUrl = imageUrls[0];

    // Create job in Firestore
    const jobRef = adminDb.collection("jobs").doc(jobId);
    await jobRef.set({
      id: jobId,
      createdAt: Date.now(),
      userId: user.userId,
      userEmail: user.userEmail,
      chargedCents: user.isAdmin ? 0 : priceCents,
      status: "processing",
      style,
      styleLabel: STYLE_LABELS[style],
      userNotes: userNotes || null,
      imageUrls,
      coverImageUrl,
      resolution,
      duration,
      videoUrl: null,
      minimaxTaskId: null,
      error: null,
    });

    // Kick off MiniMax generation (polling happens via /api/status)
    try {
      const taskId = await createVideoTask(
        coverImageUrl,
        style,
        userNotes,
        resolution,
        duration
      );
      await jobRef.update({ minimaxTaskId: taskId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await refund();
      await jobRef.update({ status: "failed", error: message, chargedCents: 0 });
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ jobId });
  } catch (err: unknown) {
    // Any failure before generation started — return the money.
    await refund();
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
