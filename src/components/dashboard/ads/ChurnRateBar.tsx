import { pct } from "@/lib/format";
import type { ChurnExposure } from "@/server/metrics/ads";

export interface ChurnRateBarProps {
  exposure: ChurnExposure;
  max: number;
  /** Tailwind background class of the series colour. */
  color: string;
  name: string;
  /** Draw the 95% interval behind the bar. */
  showRange?: boolean;
}

export function ChurnRateBar({ exposure: e, max, color, name, showRange }: ChurnRateBarProps) {
  const w = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <div
      className="mt-1 flex items-center gap-2"
      title={`${name}: ${e.churns} cancellations over ${Math.round(e.exposureMonths)} client-months; 95% range ${pct(e.low, 1)}–${pct(e.high, 1)}`}
    >
      <div className="relative h-3 flex-1">
        {showRange && (
          <div className="absolute inset-y-1 rounded-full bg-axis" style={{ left: w(e.low), width: `calc(${w(e.high)} - ${w(e.low)})` }} />
        )}
        <div className={`absolute left-0 top-0.5 h-2 rounded-r ${color}`} style={{ width: w(e.monthlyChurn) }} />
      </div>
      <span className="tabular w-12 text-right text-xs text-ink">{pct(e.monthlyChurn, 1)}</span>
    </div>
  );
}
