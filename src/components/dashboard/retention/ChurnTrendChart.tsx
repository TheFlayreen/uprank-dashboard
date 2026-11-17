import { LegendItem } from "@/components/ui/LegendItem";
import { Tooltip } from "@/components/ui/Tooltip";
import { monthLabel, pct } from "@/lib/format";
import type { RetentionResult } from "@/server/metrics/retention";

const CHART_H = 160;
const AXIS_H = 24;

export interface ChurnTrendChartProps {
  trend: RetentionResult["trend"];
  spike: RetentionResult["spike"];
}

/** Cancellations per month for the last 12 full months; spike months are highlighted. */
export function ChurnTrendChart({ trend, spike }: ChurnTrendChartProps) {
  const max = Math.max(...trend.map((t) => t.cancellations), 1);
  const peak = trend.reduce((a, b) => (b.cancellations > a.cancellations ? b : a));

  return (
    <figure>
      <figcaption className="mb-3 text-sm font-medium text-ink">Cancellations per month</figcaption>
      <div className="relative" style={{ height: CHART_H + AXIS_H }}>
        {[0.5, 1].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-grid" style={{ bottom: AXIS_H + f * CHART_H }} aria-hidden>
            <span className="tabular absolute -top-2.5 right-0 bg-page pl-1 text-xs text-muted">{Math.round(f * max)}</span>
          </div>
        ))}
        <div className="absolute inset-x-0 border-t border-axis" style={{ bottom: AXIS_H }} aria-hidden />
        <ol className="absolute inset-x-0 bottom-0 flex items-end gap-[2px] pr-6" style={{ height: CHART_H + AXIS_H }}>
          {trend.map((t) => {
            const inSpike = spike.isSpike && t.month >= spike.from;
            return (
              <li key={t.month} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                <Tooltip
                  className="flex flex-1 flex-col justify-end outline-none"
                  content={
                    <>
                      <b>{monthLabel(t.month, true)}</b>
                      <br />
                      {t.cancellations} cancelled of {t.activeAtStart} active ({pct(t.churnRate, 1)})
                      <br />
                      {t.newClients} new clients
                    </>
                  }
                >
                  {t === peak && t.cancellations > 0 && (
                    <span className="tabular mb-1 text-center text-xs font-medium text-ink">{t.cancellations}</span>
                  )}
                  <span
                    className={`mx-auto block w-full max-w-7 rounded-t ${inSpike ? "bg-series-1" : "bg-series-off"}`}
                    style={{ height: Math.max((t.cancellations / max) * CHART_H, t.cancellations ? 2 : 0) }}
                  />
                </Tooltip>
                <span className="mt-1 h-5 text-center text-xs text-muted">{monthLabel(t.month)}</span>
              </li>
            );
          })}
        </ol>
      </div>
      {spike.isSpike && (
        <p className="mt-2 text-xs text-ink-2">
          <LegendItem swatch="h-2 w-2 rounded-sm bg-series-1">
            Spike: {pct(spike.recentRate, 1)}/month since {monthLabel(spike.from)} vs {pct(spike.baselineRate, 1)} before
          </LegendItem>
        </p>
      )}
    </figure>
  );
}
