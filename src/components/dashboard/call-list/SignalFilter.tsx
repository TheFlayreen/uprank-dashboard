import type { HealthRow } from "@/server/metrics/health";
import { matchesGroup, SIGNAL_GROUPS, type SignalGroupKey } from "./signalGroups";

export interface SignalFilterProps {
  rows: HealthRow[];
  value: SignalGroupKey;
  onChange: (value: SignalGroupKey) => void;
}

/** Segmented filter by kind of problem; counts reflect the rows currently in scope. */
export function SignalFilter({ rows, value, onChange }: SignalFilterProps) {
  return (
    <div role="group" aria-label="Filter by problem" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {SIGNAL_GROUPS.map((g) => {
        const count = rows.filter((r) => matchesGroup(r, g.key)).length;
        const active = value === g.key;
        return (
          <button
            key={g.key}
            type="button"
            aria-pressed={active}
            disabled={count === 0}
            onClick={() => onChange(g.key)}
            className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors duration-200 disabled:opacity-40 ${
              active ? "border-ink bg-ink text-page" : "border-line bg-page text-ink-2 hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {g.label} <span className={`tabular ${active ? "text-page/70" : "text-muted"}`}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}
