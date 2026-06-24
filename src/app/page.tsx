"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ImageUploader from "@/components/ImageUploader";
import StylePicker from "@/components/StylePicker";
import AuthGuard from "@/components/AuthGuard";
import type { VideoStyle } from "@/lib/minimax";

function HomePageInner() {
  const router = useRouter();
  const [images, setImages] = useState<File[]>([]);
  const [style, setStyle] = useState<VideoStyle>("walkthrough");
  const [notes, setNotes] = useState("");
  const [resolution, setResolution] = useState<"768P" | "1080P">("1080P");
  const [duration, setDuration] = useState<6 | 10>(6);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!images.length) {
      setError("Please upload at least one property photo.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const fd = new FormData();
      images.forEach((img) => fd.append("images", img));
      fd.append("style", style);
      fd.append("notes", notes);
      fd.append("resolution", resolution);
      fd.append("duration", String(duration));

      const res = await fetch("/api/generate", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Something went wrong");

      router.push(`/jobs?highlight=${data.jobId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-slate-900 mb-3">
          AI Property Walkthrough Videos
        </h1>
        <p className="text-lg text-slate-500">
          Upload your photos → pick a style → get a cinematic video in minutes.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-10">
        {/* Step 1 */}
        <section className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-brand-500 text-white text-sm font-bold flex items-center justify-center">1</span>
            <h2 className="text-lg font-bold text-slate-800">Upload Property Photos</h2>
          </div>
          <p className="text-sm text-slate-500 pl-11">
            The <strong>first photo</strong> is used as the cover frame for the video. Add interior and exterior shots.
          </p>
          <ImageUploader onImagesChange={setImages} />
        </section>

        {/* Step 2 */}
        <section className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-brand-500 text-white text-sm font-bold flex items-center justify-center">2</span>
            <h2 className="text-lg font-bold text-slate-800">Choose Video Style</h2>
          </div>
          <StylePicker value={style} onChange={setStyle} />
        </section>

        {/* Step 3 */}
        <section className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-brand-500 text-white text-sm font-bold flex items-center justify-center">3</span>
            <h2 className="text-lg font-bold text-slate-800">Video Settings</h2>
          </div>

          <div className="pl-11 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Resolution */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Resolution</label>
              <div className="flex gap-2">
                {(["768P", "1080P"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setResolution(r)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                      resolution === r
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {r}
                    {r === "1080P" && <span className="ml-1 text-xs text-amber-500">⭐</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Duration</label>
              <div className="flex gap-2">
                {([6, 10] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                      duration === d
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="pl-11">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Additional Notes <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Focus on the kitchen island, highlight the garden view, use warm lighting..."
              rows={3}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>
        </section>

        {/* Pricing hint */}
        <div className="bg-slate-100 rounded-2xl px-5 py-4 text-sm text-slate-600">
          <strong>Estimated cost:</strong> ~$0.33 for 1080P 6s · ~$0.32 for 768P 10s · powered by MiniMax Hailuo-2.3
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
            ⚠️ {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !images.length}
          className="w-full py-4 rounded-2xl bg-brand-500 hover:bg-brand-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-lg transition-all shadow-lg hover:shadow-brand-500/30"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-3">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Uploading & generating…
            </span>
          ) : (
            "🎬 Generate Video"
          )}
        </button>
      </form>
    </div>
  );
}

export default function HomePage() {
  return (
    <AuthGuard>
      <HomePageInner />
    </AuthGuard>
  );
}
