"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** Re-pulls both APIs into Postgres, then re-renders the page with fresh numbers. */
export function RefreshButton() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const busy = syncing || isPending;

  async function refresh() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={refresh}
        disabled={busy}
        className="min-h-10 cursor-pointer rounded-lg border border-line bg-page px-4 text-sm font-medium text-ink transition-colors duration-200 hover:bg-surface-2 disabled:cursor-wait disabled:opacity-60"
      >
        {busy ? "Syncing…" : "Refresh data"}
      </button>
      {error && (
        <p role="alert" className="max-w-xs text-right text-xs text-critical-ink">
          Sync failed: {error}
        </p>
      )}
    </div>
  );
}
