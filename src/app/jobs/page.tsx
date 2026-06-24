"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import JobCard from "@/components/JobCard";
import AuthGuard from "@/components/AuthGuard";
import type { Job } from "@/lib/types";
import { Suspense } from "react";

function JobsPageInner() {
  const searchParams = useSearchParams();
  const highlight = searchParams.get("highlight") || "";
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    try {
      const res = await fetch("/api/status", { method: "POST" });
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    // Refresh every 10s if any jobs are still processing
    const interval = setInterval(() => {
      setJobs((prev) => {
        if (prev.some((j) => j.status === "processing" || j.status === "uploading")) {
          fetchJobs();
        }
        return prev;
      });
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-3 text-slate-500">
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Loading your videos…
      </div>
    );
  }

  if (!jobs.length) {
    return (
      <div className="text-center py-24 space-y-4">
        <p className="text-5xl">🎬</p>
        <h2 className="text-xl font-bold text-slate-700">No videos yet</h2>
        <p className="text-slate-500">Generate your first property walkthrough to see it here.</p>
        <Link
          href="/"
          className="inline-block mt-2 px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold transition-colors"
        >
          Create First Video
        </Link>
      </div>
    );
  }

  const processing = jobs.filter((j) => j.status === "processing" || j.status === "uploading");
  const done = jobs.filter((j) => j.status === "success" || j.status === "failed");

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Videos</h1>
          <p className="text-slate-500 mt-1">{jobs.length} video{jobs.length !== 1 ? "s" : ""} total</p>
        </div>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition-colors"
        >
          + New Video
        </Link>
      </div>

      {processing.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">In Progress</h2>
          <div className="space-y-3">
            {processing.map((job) => (
              <JobCard key={job.id} job={job} highlight={job.id === highlight} />
            ))}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Completed</h2>
          <div className="space-y-3">
            {done.map((job) => (
              <JobCard key={job.id} job={job} highlight={job.id === highlight} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function JobsPage() {
  return (
    <AuthGuard>
      <Suspense fallback={<div className="flex items-center justify-center py-24 text-slate-500">Loading…</div>}>
        <JobsPageInner />
      </Suspense>
    </AuthGuard>
  );
}
