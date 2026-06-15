import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { createVideoTask, VideoStyle } from "@/lib/minimax";
import { v4 as uuidv4 } from "uuid";

export const maxDuration = 60;

const STYLE_LABELS: Record<VideoStyle, string> = {
  walkthrough: "Property Walkthrough",
  remove_furniture: "Remove Furniture",
  drone: "Drone / Aerial Shot",
  day_to_night: "Day to Night",
  virtual_staging: "Virtual Staging",
};

export async function POST(req: NextRequest) {
  const formData = await req.formData();

  const style = (formData.get("style") as VideoStyle) || "walkthrough";
  const userNotes = (formData.get("notes") as string) || undefined;
  const resolution = (formData.get("resolution") as "768P" | "1080P") || "1080P";
  const duration = parseInt(formData.get("duration") as string) as 6 | 10 || 6;
  const files = formData.getAll("images") as File[];

  if (!files.length) {
    return NextResponse.json({ error: "No images provided" }, { status: 400 });
  }

  const jobId = uuidv4();
  const bucket = adminStorage.bucket();
  const imageUrls: string[] = [];

  // Upload all images to Firebase Storage
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() || "jpg";
    const path = `jobs/${jobId}/${uuidv4()}.${ext}`;
    const fileRef = bucket.file(path);

    await fileRef.save(buffer, { contentType: file.type });
    await fileRef.makePublic();

    const url = `https://storage.googleapis.com/${bucket.name}/${path}`;
    imageUrls.push(url);
  }

  // Use first image as the cover and for video generation
  const coverImageUrl = imageUrls[0];

  // Create job in Firestore
  const jobRef = adminDb.collection("jobs").doc(jobId);
  await jobRef.set({
    id: jobId,
    createdAt: Date.now(),
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

  // Kick off MiniMax video generation (non-blocking — polling happens via /api/status)
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
    await jobRef.update({ status: "failed", error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ jobId });
}
