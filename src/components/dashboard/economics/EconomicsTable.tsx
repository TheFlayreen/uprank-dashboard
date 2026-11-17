import { isComparableGroup } from "@/lib/groups";
import type { TradeEconomics } from "@/server/metrics/economics";
import { EconomicsTableRow } from "./EconomicsTableRow";

export interface EconomicsTableProps {
  rows: TradeEconomics[];
}

export function EconomicsTable({ rows }: EconomicsTableProps) {
  // Scale bars to comparable groups only, so a noisy small group can't squash the rest.
  const maxLtv = Math.max(...rows.filter((r) => isComparableGroup(r.trade, r.confidence)).map((r) => r.ltvHigh));
  return (
    <div className="-mx-4 min-w-0 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[540px] border-collapse text-sm">
        <caption className="sr-only">Revenue and lifetime value by trade</caption>
        <thead>
          <tr className="border-b border-axis text-left text-xs text-muted">
            <th scope="col" className="py-2 pl-4 pr-3 font-medium sm:pl-0">Trade</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">Revenue / mo</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">Churn / mo</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">Stays (months)</th>
            <th scope="col" className="w-[34%] py-2 pr-4 font-medium sm:pr-0">Lifetime value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <EconomicsTableRow key={r.trade} row={r} maxLtv={maxLtv} />
          ))}
        </tbody>
      </table>
      <p className="mt-2 px-4 text-xs text-muted sm:px-0">
        LTV = revenue per billed month (net of refunds, incl. ads add-on) × expected months retained (1 ÷ monthly churn, counting active
        clients’ time). Grey band = 95% range. Greyed rows are too small or have no trade recorded, so don’t rank on them.
      </p>
    </div>
  );
}
