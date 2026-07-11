"use client";

import { useEffect, useState, useCallback } from "react";
import { getAuth } from "firebase/auth";
import { useAuth } from "@/lib/auth-context";

async function authedFetch(path: string, init?: RequestInit) {
  const token = await getAuth().currentUser?.getIdToken();
  return fetch(path, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

export default function WalletBadge() {
  const { user } = useAuth();
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadBalance = useCallback(async () => {
    if (!user) return;
    try {
      const res = await authedFetch("/api/wallet");
      if (res.ok) {
        const data = await res.json();
        setBalanceCents(data.balanceCents ?? 0);
        setIsAdmin(!!data.isAdmin);
      }
    } catch {
      /* ignore */
    }
  }, [user]);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  const addFunds = async () => {
    const input = window.prompt("How much would you like to add? (USD)", "10");
    if (input === null) return;
    const dollars = parseFloat(input);
    if (!Number.isFinite(dollars) || dollars < 7) {
      alert("Minimum top-up is $7.");
      return;
    }
    setBusy(true);
    try {
      const res = await authedFetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: Math.round(dollars * 100) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start checkout");
      window.location.href = data.url;
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold text-slate-700 tabular-nums">
        {isAdmin
          ? "∞"
          : balanceCents === null
          ? "…"
          : `$${(balanceCents / 100).toFixed(2)}`}
      </span>
      {!isAdmin && (
        <button
          onClick={addFunds}
          disabled={busy}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:bg-slate-300 text-white transition-colors"
        >
          {busy ? "…" : "+ Add funds"}
        </button>
      )}
    </div>
  );
}
