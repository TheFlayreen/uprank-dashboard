import type { ChurnExposure } from "@/server/metrics/ads";
import { ChurnRateBar } from "./ChurnRateBar";

export interface ChurnPairRowProps {
  label: string;
  sub: string;
  onAds: ChurnExposure;
  offAds: ChurnExposure;
  max: number;
  showRange?: boolean;
}

export function ChurnPairRow({ label, sub, onAds, offAds, max, showRange }: ChurnPairRowProps) {
  return (
    <div>
      <p className="text-sm text-ink">
        {label} <span className="text-xs text-muted">· {sub}</span>
      </p>
      <ChurnRateBar exposure={onAds} max={max} color="bg-series-1" name="On ads" showRange={showRange} />
      <ChurnRateBar exposure={offAds} max={max} color="bg-series-2" name="Not on ads" showRange={showRange} />
    </div>
  );
}
