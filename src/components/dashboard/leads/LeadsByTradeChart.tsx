import { LegendItem } from "@/components/ui/LegendItem";
import { num } from "@/lib/format";
import type { LeadsResult } from "@/server/metrics/leads";
import { LEADS_GRID, scaleX } from "./leadsGrid";
import { LeadsTradeRow } from "./LeadsTradeRow";

export interface LeadsByTradeChartProps {
  data: LeadsResult;
}

/** Horizontal bars with 95% CI whiskers and the overall average as a reference line. */
export function LeadsByTradeChart({ data }: LeadsByTradeChartProps) {
  const max = Math.ceil(Math.max(...data.byTrade.map((t) => t.ciHigh ?? t.leadsPerClientMonth)) / 5) * 5;
  const x = scaleX(max);
  const avg = data.overall.leadsPerClientMonth;
  const ticks = Array.from({ length: max / 5 + 1 }, (_, i) => i * 5);

  return (
    <figure>
      <div className={`${LEADS_GRID} mb-1`} aria-hidden>
        <span className="hidden sm:block" />
        <div className="relative h-4 text-xs text-muted">
          {ticks.map((t) => (
            <span key={t} className="tabular absolute -translate-x-1/2" style={{ left: x(t) }}>
              {t}
            </span>
          ))}
        </div>
        <span />
      </div>

      <div className="space-y-3 sm:space-y-2">
        {data.byTrade.map((t) => (
          <LeadsTradeRow key={t.trade} row={t} max={max} average={avg} ticks={ticks} />
        ))}
      </div>

      <figcaption className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-2">
        <LegendItem swatch="h-3 w-0.5 bg-series-2">Average client: {num(avg)} leads/month</LegendItem>
        <LegendItem swatch="h-2 w-3 border-x-2 border-ink">95% confidence range: if it crosses the orange line, the gap may be noise</LegendItem>
        <LegendItem swatch="hatch h-2.5 w-4 rounded-sm">Fewer than 5 clients: not comparable</LegendItem>
        <LegendItem swatch="h-2.5 w-4 rounded-sm bg-series-off">Trade not recorded</LegendItem>
      </figcaption>
      <p className="mt-2 text-xs text-muted">
        Per client: average of complete months after go-live (go-live month is partial and excluded). Each client counts once.
      </p>
    </figure>
  );
}
