import { LegendItem } from "@/components/ui/LegendItem";
import { pct } from "@/lib/format";
import type { EarlyWarningResult } from "@/server/metrics/earlyWarning";

const Y_MAX = 1.2;

export interface LeadTrajectoryChartProps {
  points: EarlyWarningResult["trajectory"];
  /** Drop threshold of the alert rule, e.g. 0.4. */
  minDrop: number;
  /** viewBox width. Render a narrow (~360) and a wide (~520) instance so text stays legible. */
  width: number;
}

/** Leads as % of each client's own normal, in the 6 months before cancelling vs. before today for stayers. */
export function LeadTrajectoryChart({ points, minDrop, width: W }: LeadTrajectoryChartProps) {
  const narrow = W < 450;
  const H = narrow ? 260 : 280;
  const M = { top: 16, right: narrow ? 84 : 96, bottom: 40, left: 44 };
  const fs = { tick: 12, label: narrow ? 13 : 12 };
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const sx = (i: number) => M.left + (i / (points.length - 1)) * iw;
  const sy = (v: number) => M.top + ih - (v / Y_MAX) * ih;
  const path = (key: "left" | "stayed") =>
    points.map((p, i) => (p[key] === null ? "" : `${i ? "L" : "M"}${sx(i).toFixed(1)},${sy(p[key]!).toFixed(1)}`)).join("");
  const last = points[points.length - 1];
  const alertLevel = 1 - minDrop;

  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 text-sm font-medium text-ink">Leads in the months before a client cancels</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Line chart: leads as a percentage of each client's normal level, by months before cancelling, for clients who left vs clients who stayed"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={M.left} x2={M.left + iw} y1={sy(t)} y2={sy(t)} stroke={t === 0 ? "var(--axis)" : "var(--grid)"} />
            <text x={M.left - 8} y={sy(t)} dy="0.32em" textAnchor="end" fontSize={fs.tick} fill="var(--muted)" className="tabular">
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}
        <line x1={M.left} x2={M.left + iw} y1={sy(alertLevel)} y2={sy(alertLevel)} stroke="var(--series-2)" strokeWidth={1.5} />
        <text x={M.left + 4} y={sy(alertLevel) - 6} fontSize={fs.tick} fill="var(--ink-2)">
          alert: {Math.round(minDrop * 100)}% below normal
        </text>

        {points.map((p, i) => (
          <text key={p.offset} x={sx(i)} y={M.top + ih + 18} textAnchor="middle" fontSize={fs.tick} fill="var(--muted)">
            {p.offset === -1 ? (narrow ? "−1" : "last month") : `${p.offset}`}
          </text>
        ))}
        <text x={M.left + iw / 2} y={H - 4} textAnchor="middle" fontSize={fs.tick} fill="var(--ink-2)">
          {narrow ? "Months before cancelling" : "Months before cancelling (stayers: before today)"}
        </text>

        <path d={path("stayed")} fill="none" stroke="var(--muted)" strokeWidth={2} strokeLinejoin="round" />
        <path d={path("left")} fill="none" stroke="var(--series-1)" strokeWidth={2.5} strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={p.offset}>
            {p.stayed !== null && (
              <circle cx={sx(i)} cy={sy(p.stayed)} r={4} fill="var(--muted)" stroke="var(--page)" strokeWidth={2}>
                <title>{`Stayed, ${p.offset} mo: ${pct(p.stayed)} of normal (n=${p.stayedN})`}</title>
              </circle>
            )}
            {p.left !== null && (
              <circle cx={sx(i)} cy={sy(p.left)} r={4.5} fill="var(--series-1)" stroke="var(--page)" strokeWidth={2}>
                <title>{`Cancelled, ${p.offset} mo before: ${pct(p.left)} of normal (n=${p.leftN})`}</title>
              </circle>
            )}
          </g>
        ))}
        {last.left !== null && (
          <text x={sx(points.length - 1) + 10} y={sy(last.left)} dy="0.32em" fontSize={fs.label} fill="var(--ink)">
            <tspan fontWeight={600}>{pct(last.left)}</tspan> left
          </text>
        )}
        {last.stayed !== null && (
          <text x={sx(points.length - 1) + 10} y={sy(last.stayed)} dy="0.32em" fontSize={fs.label} fill="var(--ink-2)">
            {pct(last.stayed)} stayed
          </text>
        )}
      </svg>
      <p className="mt-1 flex flex-wrap gap-x-4 text-xs text-ink-2">
        <LegendItem swatch="h-0.5 w-4 bg-series-1">Clients who cancelled (n={last.leftN})</LegendItem>
        <LegendItem swatch="h-0.5 w-4 bg-muted">Clients still with us (n={last.stayedN})</LegendItem>
      </p>
      <p className="mt-1 text-xs text-muted">100% = the client’s own average in months −6 to −4. The month they cancel is partial and left out.</p>
    </figure>
  );
}
