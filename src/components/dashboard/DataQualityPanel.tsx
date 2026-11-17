import type { Dashboard } from "@/server/dashboard";

export interface DataQualityPanelProps {
  data: Dashboard["dataQuality"];
}

/** Collapsed by default: what was excluded or flagged, and the calculation rules. */
export function DataQualityPanel({ data }: DataQualityPanelProps) {
  const issues = Object.entries(data.issueCounts);
  return (
    <details className="group border-t border-line pt-6">
      <summary className="flex min-h-10 cursor-pointer list-none flex-wrap items-center gap-x-2 rounded-md text-sm font-semibold text-ink">
        <span className="inline-block text-muted transition-transform duration-200 group-open:rotate-90" aria-hidden>
          ▸
        </span>
        Data quality &amp; how numbers are calculated
        <span className="font-normal text-muted">
          {data.excluded.length} records excluded · {issues.reduce((s, [, n]) => s + n, 0)} issues flagged
        </span>
      </summary>
      <div className="mt-4 grid gap-6 text-sm md:grid-cols-3">
        <div>
          <h3 className="mb-2 font-medium text-ink">Excluded from the dashboard</h3>
          <ul className="space-y-1.5 text-ink-2">
            {data.excluded.map((e) => (
              <li key={e.id}>
                <span className="text-ink">{e.name}</span> <span className="text-xs text-muted">({e.id})</span> — {e.reason}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 font-medium text-ink">Kept, but flagged</h3>
          <ul className="space-y-1.5 text-ink-2">
            {data.clientsWithIssues.map((c) => (
              <li key={c.id}>
                <span className="text-ink">{c.name}</span> — {c.issues.join("; ")}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 font-medium text-ink">Rules</h3>
          <ul className="list-disc space-y-1.5 pl-4 text-ink-2">
            {data.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Full definitions: METRICS.md in the repository.</p>
        </div>
      </div>
    </details>
  );
}
