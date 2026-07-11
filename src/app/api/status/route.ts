import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { queryVideoTask, downloadVideo } from "@/lib/minimax";

// Refund a failed job's charge back to the user's wallet (idempotent: it zeroes
// chargedCents so a repeated poll can't double-refund).
async function refundJob(jobId: string, job: any) {
  const charged = Number(job?.chargedCents || 0);
  if (charged > 0 && job?.userId) {
    await adminDb
      .collection("users")
      .doc(job.userId)
      .set(
        { walletBalanceCents: FieldValue.increment(charged) },
        { merge: true }
      );
    await adminDb.collection("jobs").doc(jobId).update({ chargedCents: 0 });
  }
}

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
      // MiniMax finished rendering. The download/save below is a terminal step:
      // if it fails, the video won't magically appear on a later poll, so we
      // mark the job `failed` instead of looping forever on "processing".
      try {
        // Proper two-step download: files/retrieve -> download_url -> fetch bytes
        const { buffer: videoBuffer, contentType } = await downloadVideo(
          result.fileId
        );

        // Sanity check — a real MP4 is >10KB. Anything smaller is an error
        // payload (e.g. JSON metadata); fail loudly instead of saving garbage.
        if (videoBuffer.byteLength <= 10000) {
          throw new Error(
            `Video download returned invalid content (${videoBuffer.byteLength}B): ${videoBuffer
              .toString("utf-8")
              .slice(0, 300)}`
          );
        }

        const { adminStorage } = await import("@/lib/firebase-admin");
        const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;
        const bucket = adminStorage.bucket(bucketName);
        const videoPath = `jobs/${jobId}/output.mp4`;
        const videoFile = bucket.file(videoPath);
        await videoFile.save(videoBuffer, { contentType });
        const [videoUrl] = await videoFile.getSignedUrl({
          action: "read",
          expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
        });

        await adminDb.collection("jobs").doc(jobId).update({
          status: "success",
          videoUrl,
        });

        return NextResponse.json({ ...job, status: "success", videoUrl });
      } catch (downloadErr: unknown) {
        const message =
          downloadErr instanceof Error ? downloadErr.message : String(downloadErr);
        await adminDb.collection("jobs").doc(jobId).update({
          status: "failed",
          error: `Video download failed: ${message}`,
        });
        await refundJob(jobId, job);
        return NextResponse.json({ ...job, status: "failed", error: message });
      }
    }

    if (result.status === "Fail") {
      await adminDb.collection("jobs").doc(jobId).update({
        status: "failed",
        error: "MiniMax video generation failed",
      });
      await refundJob(jobId, job);
      return NextResponse.json({ ...job, status: "failed" });
    }

    // Still processing (Queueing/Processing) — transient, keep polling
    return NextResponse.json({ ...job, status: "processing" });
  } catch (err: unknown) {
    // Only reached for transient errors while *querying* task status
    // (e.g. network blip). Safe to retry on the next poll.
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
