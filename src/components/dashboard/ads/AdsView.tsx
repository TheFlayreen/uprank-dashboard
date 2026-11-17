import { StatTile } from "@/components/ui/StatTile";
import { money, pct } from "@/lib/format";
import type { AdsResult } from "@/server/metrics/ads";
import { AdsChurnComparison } from "./AdsChurnComparison";
import { PriceSensitivityNote } from "./PriceSensitivityNote";

export interface AdsViewProps {
  data: AdsResult;
}

export function AdsView({ data }: AdsViewProps) {
  const { attach } = data;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <div className="space-y-4">
        <dl className="grid grid-cols-2 gap-2">
          <StatTile label="Active clients with ads" value={pct(attach.rate)} sub={`${attach.activeWithAds} of ${attach.active}`} />
          <StatTile label="Add-on revenue" value={`${money(attach.addonMrr)}/mo`} sub={`${pct(attach.addonShareOfMrr)} of MRR`} />
          <StatTile label="Typically added" value={`~${Math.round((attach.medianMonthsToAttach ?? 0) * 30)} days`} sub="after signup (median)" />
          <StatTile label="Ever bought ads" value={attach.everWithAds} sub="clients" />
        </dl>
        <PriceSensitivityNote data={data.priceSensitivity} />
      </div>
      <AdsChurnComparison hazard={data.hazard} byTenure={data.byTenure} naive={data.naive} />
    </div>
  );
}
