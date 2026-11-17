import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { money, num, pct } from "@/lib/format";
import { isComparableGroup } from "@/lib/groups";
import type { TradeEconomics } from "@/server/metrics/economics";
import { LtvRangeBar } from "./LtvRangeBar";

export interface EconomicsTableRowProps {
  row: TradeEconomics;
  maxLtv: number;
}

export function EconomicsTableRow({ row: r, maxLtv }: EconomicsTableRowProps) {
  const muted = !isComparableGroup(r.trade, r.confidence);
  return (
    <tr className={`border-b border-grid last:border-b-0 ${muted ? "text-muted" : "text-ink"}`}>
      <td className="py-2.5 pl-4 pr-3 sm:pl-0">
        <p className="font-medium">{r.label}</p>
        <ConfidenceBadge level={r.confidence} n={r.clients} />
      </td>
      <td className="tabular py-2.5 pr-3 text-right">{money(r.revenuePerClientMonth)}</td>
      <td className="tabular py-2.5 pr-3 text-right">{pct(r.monthlyChurn, 1)}</td>
      <td className="tabular py-2.5 pr-3 text-right">
        {r.lifetimeCapped ? "60+" : num(r.expectedLifetimeMonths, 0)}
        <span className="block text-xs text-muted">
          {num(r.lifetimeLow, 0)}–{r.lifetimeHigh >= 60 ? "60+" : num(r.lifetimeHigh, 0)}
        </span>
      </td>
      <td className="py-2.5 pr-4 sm:pr-0">
        <LtvRangeBar ltv={r.ltv} low={r.ltvLow} high={r.ltvHigh} max={maxLtv} muted={muted} />
      </td>
    </tr>
  );
}
