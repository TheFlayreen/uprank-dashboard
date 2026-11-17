import { StatTile } from "@/components/ui/StatTile";
import { pct } from "@/lib/format";
import type { EarlyWarningResult } from "@/server/metrics/earlyWarning";
import { DecisionCallout } from "./DecisionCallout";
import { LeadTrajectoryChart } from "./LeadTrajectoryChart";
import { ThresholdTable } from "./ThresholdTable";

export interface EarlyWarningViewProps {
  data: EarlyWarningResult;
}

export function EarlyWarningView({ data }: EarlyWarningViewProps) {
  const rd = data.recall.resultsDriven;
  const weeks = data.recall.medianLeadDays !== null ? Math.round(data.recall.medianLeadDays / 7) : null;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <div className="min-w-0">
        {/* Two drawings instead of one scaled SVG, so labels stay legible on phones. */}
        <div className="sm:hidden">
          <LeadTrajectoryChart points={data.trajectory} minDrop={data.minDrop} width={360} />
        </div>
        <div className="hidden sm:block">
          <LeadTrajectoryChart points={data.trajectory} minDrop={data.minDrop} width={520} />
        </div>
      </div>
      <div className="space-y-4">
        <dl className="grid grid-cols-2 gap-2">
          <StatTile
            label={`Flagged clients who left within ${Math.round(data.horizonDays / 30)} months`}
            value={pct(data.flagged.rate)}
            sub={`${data.flagged.churned} of ${data.flagged.observations} flags · everyone else: ${pct(data.notFlagged.rate)}`}
          />
          <StatTile
            label="Long-tenured leavers caught in advance"
            value={`${rd.caught} of ${rd.churners}`}
            sub={weeks !== null ? `median ${weeks} weeks before cancelling` : undefined}
          />
        </dl>
        <DecisionCallout flaggedNow={data.flaggedNow} />
        <ThresholdTable
          thresholds={data.thresholds}
          snapshots={data.snapshots}
          paymentFailedChurners={data.recall.byReason.payment_failed?.churners ?? 0}
        />
      </div>
    </div>
  );
}
