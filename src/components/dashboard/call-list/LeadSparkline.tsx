import { monthLabel } from "@/lib/format";

export interface LeadSparklineProps {
  points: { month: string; leads: number | null }[];
}

/** 6-month lead trend. Missing months are gaps (not zeros); the last point is marked. */
export function LeadSparkline({ points }: LeadSparklineProps) {
  const w = 84;
  const h = 26;
  const pad = 3;
  const values = points.map((p) => p.leads).filter((v): v is number => v !== null);
  if (!values.length) return <span className="text-xs text-muted">no leads yet</span>;

  const max = Math.max(...values, 1);
  const x = (i: number) => pad + (i * (w - 2 * pad)) / (points.length - 1);
  const y = (v: number) => h - pad - (v / max) * (h - 2 * pad);

  // Break the line at missing months.
  const segments: string[] = [];
  let current = "";
  points.forEach((p, i) => {
    if (p.leads === null) {
      if (current) segments.push(current);
      current = "";
    } else {
      current += `${current ? "L" : "M"}${x(i).toFixed(1)},${y(p.leads).toFixed(1)}`;
    }
  });
  if (current) segments.push(current);

  const lastIdx = points.reduce((acc, p, i) => (p.leads !== null ? i : acc), -1);
  const last = points[lastIdx];
  const label = points.map((p) => `${monthLabel(p.month)}: ${p.leads ?? "no data"}`).join(", ");

  return (
    <span className="inline-flex items-center gap-2">
      <svg width={w} height={h} role="img" aria-label={`Leads by month — ${label}`}>
        <title>{label}</title>
        <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} stroke="var(--grid)" strokeWidth={1} />
        {segments.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {last?.leads != null && <circle cx={x(lastIdx)} cy={y(last.leads)} r={3} fill="var(--series-1)" stroke="var(--page)" strokeWidth={2} />}
      </svg>
      <span className="tabular w-5 text-right text-xs text-ink-2">{last?.leads ?? "—"}</span>
    </span>
  );
}
