import { money } from "@/lib/format";
import type { EarlyWarningResult } from "@/server/metrics/earlyWarning";

export interface DecisionCalloutProps {
  flaggedNow: EarlyWarningResult["flaggedNow"];
}

/** States the decision the backtest changes, and how many clients it applies to today. */
export function DecisionCallout({ flaggedNow }: DecisionCalloutProps) {
  return (
    <div className="rounded-lg border-l-4 border-series-1 bg-surface-2 p-3">
      <p className="text-sm font-semibold text-ink">Decision this changes</p>
      <p className="mt-1 text-sm text-ink-2">
        Don’t wait for the cancellation request or the 6-month review. Call in the <b className="text-ink">first month</b> a client’s
        leads fall 40% below their own normal. That is when they are still persuadable, and almost all of them leave otherwise. Right now{" "}
        <b className="text-ink">{flaggedNow.clients} live clients</b> match ({money(flaggedNow.mrr)} MRR). They are already on the call
        list as “Leads falling” or “Zero leads”.
      </p>
    </div>
  );
}
