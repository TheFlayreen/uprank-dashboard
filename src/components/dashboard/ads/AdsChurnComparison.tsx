import { LegendItem } from "@/components/ui/LegendItem";
import { pct } from "@/lib/format";
import type { AdsResult } from "@/server/metrics/ads";
import { ChurnPairRow } from "./ChurnPairRow";

export interface AdsChurnComparisonProps {
  hazard: AdsResult["hazard"];
  byTenure: AdsResult["byTenure"];
  naive: AdsResult["naive"];
}

/** Churn per client-month while on ads vs not, overall and within tenure bands. */
export function AdsChurnComparison({ hazard, byTenure, naive }: AdsChurnComparisonProps) {
  const max = Math.max(
    hazard.withoutAds.high,
    hazard.withAds.high,
    ...byTenure.flatMap((b) => [b.withAds.monthlyChurn, b.withoutAds.monthlyChurn]),
  );
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-ink">Churn per month: on ads vs not on ads</p>
      <p className="flex gap-4 text-xs text-ink-2">
        <LegendItem swatch="h-2.5 w-2.5 rounded-sm bg-series-1">On ads</LegendItem>
        <LegendItem swatch="h-2.5 w-2.5 rounded-sm bg-series-2">Not on ads</LegendItem>
      </p>
      <div className="mt-3 space-y-4">
        <ChurnPairRow
          label="All tenures"
          sub={`${Math.round(hazard.withAds.exposureMonths)} vs ${Math.round(hazard.withoutAds.exposureMonths)} client-months`}
          onAds={hazard.withAds}
          offAds={hazard.withoutAds}
          max={max}
          showRange
        />
        {byTenure.map((b) => (
          <ChurnPairRow
            key={b.label}
            label={b.label}
            sub={`${b.withAds.churns} vs ${b.withoutAds.churns} cancellations`}
            onAds={b.withAds}
            offAds={b.withoutAds}
            max={max}
          />
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        Ads is always added after signup, so “ads clients” have already survived their riskiest weeks. Each client’s months are split at the
        day ads started; a cancellation counts toward the state they were in. The naive comparison ({pct(naive.withAds.rate)} of ads clients
        ever churned vs {pct(naive.withoutAds.rate)}) overstates the effect.
      </p>
    </div>
  );
}
