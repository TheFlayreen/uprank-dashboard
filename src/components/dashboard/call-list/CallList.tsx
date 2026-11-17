"use client";

import { useState } from "react";
import type { HealthRow } from "@/server/metrics/health";
import { CallListCard } from "./CallListCard";
import { CallListRow } from "./CallListRow";
import { SignalFilter } from "./SignalFilter";
import { matchesGroup, type SignalGroupKey } from "./signalGroups";

export interface CallListProps {
  rows: HealthRow[];
}

/** Client component for the filter and "show minor" toggle; rows arrive pre-ranked from the server. */
export function CallList({ rows }: CallListProps) {
  const [showMinor, setShowMinor] = useState(false);
  const [group, setGroup] = useState<SignalGroupKey>("all");

  const inScope = showMinor ? rows : rows.filter((r) => r.tier !== "healthy");
  const visible = inScope.filter((r) => matchesGroup(r, group));
  const minorCount = rows.filter((r) => r.tier === "healthy").length;

  return (
    <div className="space-y-3">
      <SignalFilter rows={inScope} value={group} onChange={setGroup} />

      {/* Mobile: cards */}
      <ol className="space-y-2 md:hidden">
        {visible.map((r, i) => (
          <li key={r.id}>
            <CallListCard row={r} rank={i + 1} />
          </li>
        ))}
      </ol>

      {/* Desktop: table */}
      <table className="hidden w-full border-collapse text-sm md:table">
        <caption className="sr-only">Clients to call this week, highest risk first</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th scope="col" className="w-8 py-2 pr-2 font-medium">#</th>
            <th scope="col" className="py-2 pr-3 font-medium">Client</th>
            <th scope="col" className="py-2 pr-3 font-medium">Health</th>
            <th scope="col" className="py-2 pr-3 font-medium">Why they’re on the list</th>
            <th scope="col" className="py-2 pr-3 font-medium">Leads, last 6 mo</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">MRR</th>
            <th scope="col" className="py-2 font-medium">Next step</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r, i) => (
            <CallListRow key={r.id} row={r} rank={i + 1} />
          ))}
        </tbody>
      </table>

      {minorCount > 0 && (
        <button
          type="button"
          onClick={() => setShowMinor((v) => !v)}
          className="text-sm font-medium text-accent underline-offset-4 hover:underline"
          aria-expanded={showMinor}
        >
          {showMinor ? "Hide" : "Show"} {minorCount} more with a single minor signal
        </button>
      )}
    </div>
  );
}
