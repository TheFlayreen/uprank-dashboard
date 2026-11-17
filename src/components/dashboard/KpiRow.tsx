import { StatTile } from "@/components/ui/StatTile";
import { monthLabel, moneyShort, pct } from "@/lib/format";
import type { Dashboard } from "@/server/dashboard";
import { TrendDelta } from "./TrendDelta";

export interface KpiRowProps {
  overview: Dashboard["overview"];
}

/** Five health numbers of the business, each with the direction it's moving. Hairline grid: MRR spans two cells below xl so every row is full. */
export function KpiRow({ overview: o }: KpiRowProps) {
  const since = `since 1 ${monthLabel(o.comparedTo)}`;
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3 xl:grid-cols-5">
      <StatTile
        size="lg"
        className="col-span-2 xl:col-span-1"
        label="Monthly recurring revenue"
        value={moneyShort(o.mrr)}
        sub={<TrendDelta value={o.mrrChange} format={(v) => moneyShort(v)} suffix={` (${pct(Math.abs(o.mrrChangePct), 0)}) ${since}`} />}
      />
      <StatTile
        size="lg"
        label="Active clients"
        value={o.activeClients}
        sub={<TrendDelta value={o.clientChange} format={(v) => String(v)} suffix={` ${since} · ${o.onboarding} onboarding`} />}
      />
      <StatTile
        size="lg"
        label="Churn, last 3 months"
        value={`${pct(o.recentMonthlyChurn, 1)}/mo`}
        sub={`was ${pct(o.baselineMonthlyChurn, 1)}/mo before`}
        tone={o.churnSpike ? "critical" : undefined}
      />
      <StatTile size="lg" label="Still with us at 12 months" value={pct(o.survival12m)} sub="of clients who signed up" />
      <StatTile size="lg" label="Lifetime value per client" value={moneyShort(o.ltv)} sub="revenue × expected months" />
    </dl>
  );
}
