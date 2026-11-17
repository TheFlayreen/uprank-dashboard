import type { EconomicsResult } from "@/server/metrics/economics";
import { EconomicsTable } from "./EconomicsTable";
import { ValueMapChart } from "./ValueMapChart";

export interface EconomicsViewProps {
  data: EconomicsResult;
}

export function EconomicsView({ data }: EconomicsViewProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Two drawings instead of one scaled SVG, so labels stay legible on phones. */}
      <div className="sm:hidden">
        <ValueMapChart rows={data.byTrade} width={360} />
      </div>
      <div className="hidden sm:block">
        <ValueMapChart rows={data.byTrade} width={640} />
      </div>
      <EconomicsTable rows={data.byTrade} />
    </div>
  );
}
