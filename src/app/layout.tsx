import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "ListingLens — AI Property Walkthrough Videos",
  description: "Turn your property photos into cinematic AI video walkthroughs powered by MiniMax Hailuo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        <AuthProvider>
          <Navbar />
          <main className="max-w-6xl mx-auto px-4 py-10">{children}</main>
          <footer className="border-t border-slate-200 mt-20 py-8 text-center text-sm text-slate-400">
            Powered by MiniMax Hailuo AI · Built for property professionals
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
