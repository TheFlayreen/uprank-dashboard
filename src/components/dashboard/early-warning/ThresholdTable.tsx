import { monthLabel, pct } from "@/lib/format";
import type { EarlyWarningResult } from "@/server/metrics/earlyWarning";

export interface ThresholdTableProps {
  thresholds: EarlyWarningResult["thresholds"];
  snapshots: EarlyWarningResult["snapshots"];
  paymentFailedChurners: number;
}

/** Backtest results per drop threshold — shows why 40% was chosen. */
export function ThresholdTable({ thresholds, snapshots, paymentFailedChurners }: ThresholdTableProps) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-ink">
        Choosing the threshold (backtest, {snapshots.count} monthly snapshots {monthLabel(snapshots.from, true)}–{monthLabel(snapshots.to, true)})
      </p>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Precision and recall of the lead-drop rule at different thresholds</caption>
        <thead>
          <tr className="border-b border-axis text-left text-xs text-muted">
            <th scope="col" className="py-1.5 pr-2 font-medium">Drop vs normal</th>
            <th scope="col" className="py-1.5 pr-2 text-right font-medium">Flags</th>
            <th scope="col" className="py-1.5 pr-2 text-right font-medium">Then left</th>
            <th scope="col" className="py-1.5 text-right font-medium">All leavers caught</th>
          </tr>
        </thead>
        <tbody className="tabular">
          {thresholds.map((t) => (
            <tr key={t.minDrop} className={`border-b border-grid last:border-b-0 ${t.chosen ? "font-semibold text-ink" : "text-ink-2"}`}>
              <td className="py-1.5 pr-2">
                ≥{Math.round(t.minDrop * 100)}%{t.chosen && <span className="ml-1 text-xs font-normal text-accent">← used</span>}
              </td>
              <td className="py-1.5 pr-2 text-right">{t.flagged.observations}</td>
              <td className="py-1.5 pr-2 text-right">{pct(t.flagged.rate)}</td>
              <td className="py-1.5 text-right">{pct(t.recall)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-xs text-muted">
        Lower thresholds catch slightly more leavers but raise more false alarms; above 40% the alert comes too late. Payment-failure
        cancellations ({paymentFailedChurners}) aren’t lead-driven; the payment signal covers those.
      </p>
    </div>
  );
}
