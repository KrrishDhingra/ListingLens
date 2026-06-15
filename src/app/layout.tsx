import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "PropertyReel — AI Video Walkthroughs",
  description: "Turn your property photos into cinematic AI video walkthroughs powered by MiniMax Hailuo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🏠</span>
              <span className="font-bold text-slate-900 text-lg">PropertyReel</span>
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/" className="text-sm font-medium text-slate-600 hover:text-brand-600 transition-colors">
                New Video
              </Link>
              <Link
                href="/jobs"
                className="text-sm font-medium text-slate-600 hover:text-brand-600 transition-colors"
              >
                My Videos
              </Link>
            </div>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-4 py-10">{children}</main>
        <footer className="border-t border-slate-200 mt-20 py-8 text-center text-sm text-slate-400">
          Powered by MiniMax Hailuo AI · Built for property professionals
        </footer>
      </body>
    </html>
  );
}
