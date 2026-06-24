import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { queryVideoTask } from "@/lib/minimax";

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });

  const snap = await adminDb.collection("jobs").doc(jobId).get();
  if (!snap.exists) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const job = snap.data()!;

  // Already terminal — return as-is
  if (job.status === "success" || job.status === "failed") {
    return NextResponse.json(job);
  }

  if (!job.minimaxTaskId) {
    return NextResponse.json(job);
  }

  // Poll MiniMax
  try {
    const result = await queryVideoTask(job.minimaxTaskId);

    if (result.status === "Success" && result.fileId) {
      // Download the video and re-upload to Firebase Storage so it's our CDN
      const videoRes = await fetch(
        `https://api.minimax.io/v1/files/retrieve?file_id=${result.fileId}`,
        { headers: { Authorization: `Bearer ${process.env.MINIMAX_API_KEY}` } }
      );

      let videoUrl = result.downloadUrl || "";

      if (videoRes.ok) {
        const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
        const { adminStorage } = await import("@/lib/firebase-admin");
        const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;
        const bucket = adminStorage.bucket(bucketName);
        const videoPath = `jobs/${jobId}/output.mp4`;
        const videoFile = bucket.file(videoPath);
        await videoFile.save(videoBuffer, { contentType: "video/mp4" });
        const [signedUrl] = await videoFile.getSignedUrl({
          action: "read",
          expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
        });
        videoUrl = signedUrl;
      }

      await adminDb.collection("jobs").doc(jobId).update({
        status: "success",
        videoUrl,
      });

      return NextResponse.json({ ...job, status: "success", videoUrl });
    }

    if (result.status === "Fail") {
      await adminDb.collection("jobs").doc(jobId).update({
        status: "failed",
        error: "MiniMax video generation failed",
      });
      return NextResponse.json({ ...job, status: "failed" });
    }

    // Still processing
    return NextResponse.json({ ...job, status: "processing" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ...job, status: "processing", pollError: message });
  }
}

// Return all jobs (for the dashboard)
export async function POST() {
  const snap = await adminDb
    .collection("jobs")
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  const jobs = snap.docs.map((d) => d.data());
  return NextResponse.json({ jobs });
}
