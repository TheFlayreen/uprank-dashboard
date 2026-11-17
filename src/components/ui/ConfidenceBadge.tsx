import type { Confidence } from "@/server/metrics/stats";

const LABELS: Record<Confidence, { label: string; className: string } | null> = {
  ok: null,
  low: { label: "Low sample", className: "border-warning text-ink-2" },
  insufficient: { label: "Too few to judge", className: "border-axis text-muted" },
};

export interface ConfidenceBadgeProps {
  level: Confidence;
  n: number;
}

/** Sample size, plus a warning chip when the group is too small to trust. */
export function ConfidenceBadge({ level, n }: ConfidenceBadgeProps) {
  const chip = LABELS[level];
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted">
      n={n}
      {chip && <span className={`rounded border px-1 py-px text-xs ${chip.className}`}>{chip.label}</span>}
    </span>
  );
}
