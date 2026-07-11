"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { usePathname } from "next/navigation";
import WalletBadge from "./WalletBadge";

export default function Navbar() {
  const { user, signInWithGoogle, signOutUser } = useAuth();
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">🏠</span>
          <span className="font-bold text-slate-900 text-lg">ListingLens</span>
        </Link>

        <div className="flex items-center gap-5">
          {user && !isLogin && (
            <>
              <Link
                href="/"
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                New Video
              </Link>
              <Link
                href="/jobs"
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                My Videos
              </Link>
            </>
          )}

          {user && !isLogin && <WalletBadge />}

          {user ? (
            <div className="flex items-center gap-3">
              {user.photoURL ? (
                <Image
                  src={user.photoURL}
                  alt={user.displayName || "User"}
                  width={32}
                  height={32}
                  className="rounded-full ring-2 ring-slate-200"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center text-sm font-bold">
                  {user.displayName?.[0] || user.email?.[0] || "U"}
                </div>
              )}
              <span className="text-sm text-slate-600 hidden sm:block">
                {user.displayName?.split(" ")[0]}
              </span>
              <button
                onClick={signOutUser}
                className="text-xs text-slate-400 hover:text-red-500 transition-colors font-medium"
              >
                Sign out
              </button>
            </div>
          ) : !isLogin ? (
            <button
              onClick={signInWithGoogle}
              className="text-sm font-semibold px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white transition-colors"
            >
              Sign in
            </button>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
