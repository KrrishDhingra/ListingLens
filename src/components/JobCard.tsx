"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import type { Job } from "@/lib/types";

interface Props {
  job: Job;
  highlight?: boolean;
}

const STATUS_META = {
  uploading: { label: "Uploading…", color: "text-blue-600 bg-blue-50", dot: "bg-blue-500" },
  processing: { label: "Generating video…", color: "text-amber-600 bg-amber-50", dot: "bg-amber-400" },
  success: { label: "Ready", color: "text-green-700 bg-green-50", dot: "bg-green-500" },
  failed: { label: "Failed", color: "text-red-600 bg-red-50", dot: "bg-red-500" },
};

export default function JobCard({ job: initialJob, highlight }: Props) {
  const [job, setJob] = useState<Job>(initialJob);
  const [showVideo, setShowVideo] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Poll for status updates if still processing
    if (job.status !== "processing" && job.status !== "uploading") return;

    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/status?jobId=${job.id}`);
        const updated = await res.json();
        setJob(updated);
        if (updated.status === "success" || updated.status === "failed") {
          clearInterval(intervalRef.current!);
        }
      } catch {
        // silently retry
      }
    }, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [job.id, job.status]);

  const meta = STATUS_META[job.status];
  const timeAgo = formatTimeAgo(job.createdAt);

  return (
    <div
      className={`bg-white rounded-3xl border ${
        highlight ? "border-brand-400 shadow-md shadow-brand-500/10" : "border-slate-200"
      } overflow-hidden transition-all`}
    >
      <div className="flex gap-4 p-5">
        {/* Cover thumbnail */}
        <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl overflow-hidden bg-slate-100 flex-shrink-0 relative">
          {job.coverImageUrl ? (
            <Image src={job.coverImageUrl} alt="Cover" fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl">🏠</div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-slate-800 text-sm sm:text-base truncate">
              {job.styleLabel}
            </h3>
            <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${meta.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} ${job.status === "processing" ? "animate-pulse" : ""}`} />
              {meta.label}
            </span>
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
            <span>📐 {job.resolution}</span>
            <span>⏱ {job.duration}s</span>
            <span>📸 {job.imageUrls?.length || 1} photo{(job.imageUrls?.length || 1) !== 1 ? "s" : ""}</span>
            <span>🕐 {timeAgo}</span>
          </div>

          {job.userNotes && (
            <p className="text-xs text-slate-400 italic truncate">"{job.userNotes}"</p>
          )}

          {job.status === "processing" && (
            <div className="flex items-center gap-2 text-xs text-amber-600">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              MiniMax Hailuo is rendering your video…
            </div>
          )}

          {job.status === "failed" && (
            <p className="text-xs text-red-500">{job.error || "Generation failed. Please try again."}</p>
          )}

          {job.status === "success" && job.videoUrl && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowVideo(!showVideo)}
                className="text-xs bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                {showVideo ? "Hide Video" : "▶ Play Video"}
              </button>
              <a
                href={job.videoUrl}
                download
                className="text-xs border border-slate-200 hover:border-slate-300 text-slate-600 px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                ⬇ Download
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Video player */}
      {showVideo && job.videoUrl && (
        <div className="px-5 pb-5">
          <video
            src={job.videoUrl}
            controls
            autoPlay
            loop
            className="w-full rounded-2xl bg-black"
          />
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
