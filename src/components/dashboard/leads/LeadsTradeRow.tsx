import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { Tooltip } from "@/components/ui/Tooltip";
import { num } from "@/lib/format";
import { isComparableGroup } from "@/lib/groups";
import type { TradeLeads } from "@/server/metrics/leads";
import { LEADS_GRID, scaleX } from "./leadsGrid";

export interface LeadsTradeRowProps {
  row: TradeLeads;
  max: number;
  average: number;
  ticks: number[];
}

function barClass(t: TradeLeads) {
  if (t.confidence === "insufficient") return "hatch";
  if (t.trade === "unknown") return "bg-series-off";
  return t.vsOverall === "below" ? "bg-series-1-soft" : "bg-series-1";
}

export function LeadsTradeRow({ row: t, max, average, ticks }: LeadsTradeRowProps) {
  const x = scaleX(max);
  const muted = !isComparableGroup(t.trade, t.confidence);

  return (
    <div className={`${LEADS_GRID} gap-y-1`}>
      <div className="col-span-2 flex min-w-0 items-baseline gap-2 sm:col-span-1 sm:flex-col sm:gap-0">
        <span className={`truncate text-sm ${muted ? "text-muted" : "text-ink"}`}>{t.label}</span>
        <ConfidenceBadge level={t.confidence} n={t.clients} />
      </div>

      <Tooltip
        className="relative block h-5 outline-none"
        content={
          <>
            <b>{t.label}</b>: {num(t.leadsPerClientMonth)} leads/client/month
            <br />
            95% range {num(t.ciLow)}–{num(t.ciHigh)} · median {num(t.median)}
            <br />
            {t.clients} clients, {t.clientMonths} client-months
          </>
        }
      >
        {ticks.map((tk) => (
          <span key={tk} className="absolute inset-y-0 border-l border-grid" style={{ left: x(tk) }} aria-hidden />
        ))}
        <span className={`absolute inset-y-1 left-0 rounded-r ${barClass(t)}`} style={{ width: x(t.leadsPerClientMonth) }} />
        {t.ciLow !== null && t.ciHigh !== null && (
          <span
            className="absolute top-1/2 h-3 -translate-y-1/2 border-x-2 border-ink"
            style={{ left: x(t.ciLow), width: `calc(${x(t.ciHigh)} - ${x(t.ciLow)})` }}
            aria-hidden
          >
            <span className="absolute inset-x-0 top-1/2 border-t-2 border-ink" />
          </span>
        )}
        <span className="absolute -inset-y-1 border-l-2 border-series-2" style={{ left: x(average) }} aria-hidden />
      </Tooltip>

      <span className={`tabular text-right text-sm font-medium ${muted ? "text-muted" : "text-ink"}`}>{num(t.leadsPerClientMonth)}</span>
    </div>
  );
}
