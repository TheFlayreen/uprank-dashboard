import { pct } from "@/lib/format";
import type { RetentionResult } from "@/server/metrics/retention";

export interface SurvivalMilestonesProps {
  milestones: RetentionResult["milestones"];
}

/** Kaplan–Meier survival at 3 / 6 / 12 months. */
export function SurvivalMilestones({ milestones }: SurvivalMilestonesProps) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-ink">Still with us after…</p>
      <dl className="grid grid-cols-3 gap-2">
        {milestones.map((m) => (
          <div key={m.month} className="rounded-lg border border-line p-2.5 text-center">
            <dt className="text-xs text-ink-2">{m.month} months</dt>
            <dd className="tabular text-xl font-semibold text-ink">{pct(m.survival)}</dd>
            <dd className="text-xs text-muted">{m.atRisk} reached it</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
