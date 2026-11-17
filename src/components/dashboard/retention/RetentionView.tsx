import type { RetentionResult } from "@/server/metrics/retention";
import { ChurnTimingList } from "./ChurnTimingList";
import { ChurnTrendChart } from "./ChurnTrendChart";
import { SurvivalMilestones } from "./SurvivalMilestones";

export interface RetentionViewProps {
  data: RetentionResult;
}

export function RetentionView({ data }: RetentionViewProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <ChurnTrendChart trend={data.trend} spike={data.spike} />
      <div className="space-y-5">
        <ChurnTimingList timing={data.timing} />
        <SurvivalMilestones milestones={data.milestones} />
      </div>
    </div>
  );
}
