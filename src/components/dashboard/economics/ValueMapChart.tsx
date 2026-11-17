import { money, moneyShort, num } from "@/lib/format";
import { isComparableGroup } from "@/lib/groups";
import type { TradeEconomics } from "@/server/metrics/economics";
import { placeLabels } from "./placeLabels";

const Y_MAX = 60;
const ISO_LTV = [5000, 10000, 20000];

export interface ValueMapChartProps {
  rows: TradeEconomics[];
  /** viewBox width. Render a narrow (~360) and a wide (~640) instance so text never shrinks below ~11px. */
  width: number;
}

/**
 * Revenue per month (x) against expected months retained (y). LTV is the product, so
 * curves of equal LTV make "pays less but stays longer" readable at a glance.
 */
export function ValueMapChart({ rows, width: W }: ValueMapChartProps) {
  const narrow = W < 500;
  const H = narrow ? 340 : 400;
  const M = { top: 16, right: narrow ? 52 : 84, bottom: 44, left: narrow ? 40 : 48 };
  const fs = { label: narrow ? 13 : 12, tick: 12, note: 11 };
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;

  const xs = rows.map((r) => r.revenuePerClientMonth);
  const x0 = Math.floor((Math.min(...xs) - 15) / 25) * 25;
  const x1 = Math.ceil((Math.max(...xs) + 15) / 25) * 25;
  const sx = (v: number) => M.left + ((v - x0) / (x1 - x0)) * iw;
  const sy = (v: number) => M.top + ih - (Math.min(v, Y_MAX) / Y_MAX) * ih;
  const radius = (n: number) => 4 + Math.sqrt(n) * 1.3;

  const isoPath = (ltv: number) => {
    const parts: string[] = [];
    for (let v = x0; v <= x1; v += 2) {
      const y = ltv / v;
      if (y <= Y_MAX) parts.push(`${parts.length ? "L" : "M"}${sx(v).toFixed(1)},${sy(y).toFixed(1)}`);
    }
    return parts.join("");
  };

  const points = rows.map((r) => ({
    row: r,
    id: r.trade,
    cx: sx(r.revenuePerClientMonth),
    cy: sy(r.expectedLifetimeMonths),
    r: radius(r.clients),
    text: r.label,
  }));
  const labels = new Map(
    placeLabels(points, { x0: M.left, y0: M.top, x1: M.left + iw, y1: M.top + ih }, fs.label).map((l) => [l.id, l]),
  );
  // On narrow screens show every other price tick so they don't collide.
  const step = narrow ? 50 : 25;
  const xTicks = Array.from({ length: Math.floor((x1 - x0) / step) + 1 }, (_, i) => x0 + i * step);

  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 text-sm font-medium text-ink">Price vs. how long they stay</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Scatter of revenue per month against expected months retained, by trade">
        {[0, 12, 24, 36, 48, 60].map((t) => (
          <g key={t}>
            <line x1={M.left} x2={M.left + iw} y1={sy(t)} y2={sy(t)} stroke="var(--grid)" />
            <text x={M.left - 8} y={sy(t)} dy="0.32em" textAnchor="end" fontSize={fs.tick} fill="var(--muted)" className="tabular">
              {t}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={sx(t)} y={M.top + ih + 16} textAnchor="middle" fontSize={fs.tick} fill="var(--muted)" className="tabular">
            {money(t)}
          </text>
        ))}
        <line x1={M.left} x2={M.left + iw} y1={M.top + ih} y2={M.top + ih} stroke="var(--axis)" />

        {ISO_LTV.map((ltv) => (
          <g key={ltv}>
            <path d={isoPath(ltv)} fill="none" stroke="var(--axis)" strokeWidth={1} />
            {ltv / x1 <= Y_MAX && (
              <text x={sx(x1) + 4} y={sy(ltv / x1)} dy="0.32em" fontSize={fs.note} fill="var(--muted)">
                {moneyShort(ltv)}
              </text>
            )}
          </g>
        ))}

        {points.map(({ row, cx, cy, r }) => {
          const muted = !isComparableGroup(row.trade, row.confidence);
          const label = labels.get(row.trade)!;
          return (
            <g key={row.trade}>
              <title>
                {`${row.label}: ${money(row.revenuePerClientMonth)}/month × ${num(row.expectedLifetimeMonths, 0)} months ≈ ${money(row.ltv)} LTV (${row.clients} clients)`}
              </title>
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={muted ? "var(--page)" : "var(--series-1)"}
                stroke={muted ? "var(--muted)" : "var(--page)"}
                strokeWidth={2}
              />
              <text x={label.x} y={label.y} dy="0.32em" textAnchor={label.anchor} fontSize={fs.label} fill={muted ? "var(--muted)" : "var(--ink)"}>
                {row.label}
              </text>
            </g>
          );
        })}

        <text x={M.left + iw / 2} y={H - 6} textAnchor="middle" fontSize={fs.tick} fill="var(--ink-2)">
          Revenue per client per month →
        </text>
        <text transform={`translate(12 ${M.top + ih / 2}) rotate(-90)`} textAnchor="middle" fontSize={fs.tick} fill="var(--ink-2)">
          Expected months retained →
        </text>
      </svg>
      <p className="text-xs text-muted">
        Dot size = number of clients. Hollow = fewer than 5 clients or trade not recorded. Grey curves = equal lifetime value. Lifetime
        capped at 60 months.
      </p>
    </figure>
  );
}
