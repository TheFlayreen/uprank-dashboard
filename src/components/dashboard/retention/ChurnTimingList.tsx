import { feedbackLabel, pct } from "@/lib/format";
import type { TimingBucket } from "@/server/metrics/retention";

export interface ChurnTimingListProps {
  timing: TimingBucket[];
}

/** Cancellations split by tenure window, with risk per client-month and top reasons. */
export function ChurnTimingList({ timing }: ChurnTimingListProps) {
  const maxRate = Math.max(...timing.map((t) => t.monthlyChurnRate));
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-ink">When clients leave</p>
      <ul className="space-y-3">
        {timing.map((b) => {
          const reasons = Object.entries(b.feedback)
            .sort((a, z) => z[1] - a[1])
            .slice(0, 3);
          return (
            <li key={b.key} className="rounded-lg bg-surface-2 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-sm font-medium text-ink">
                  {b.label} <span className="font-normal text-muted">· {b.hint}</span>
                </p>
                <p className="tabular text-sm text-ink">
                  <b>{b.churned}</b> <span className="text-ink-2">({pct(b.share)})</span>
                </p>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-grid">
                  <div className="h-1.5 rounded-full bg-series-1" style={{ width: `${(b.monthlyChurnRate / maxRate) * 100}%` }} />
                </div>
                <span className="tabular w-28 text-right text-xs text-ink-2">{pct(b.monthlyChurnRate, 1)} risk/month</span>
              </div>
              <p className="mt-1.5 text-xs text-ink-2">
                {reasons.map(([k, v]) => `${feedbackLabel(k)} ${v}`).join(" · ")}
                {b.paymentFailed > 0 && ` · Payment failed ${b.paymentFailed}`}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-muted">
        Risk/month = cancellations ÷ client-months lived in that window, so windows few clients have reached yet aren’t under-counted.
      </p>
    </div>
  );
}
