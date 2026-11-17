import type { HealthTier } from "@/server/metrics/health";

// Status colour always travels with its text label.
const TIERS: Record<HealthTier, { label: string; dot: string }> = {
  critical: { label: "Critical", dot: "bg-critical" },
  at_risk: { label: "At risk", dot: "bg-serious" },
  watch: { label: "Watch", dot: "bg-warning" },
  healthy: { label: "Minor", dot: "bg-good" },
};

export interface HealthBadgeProps {
  score: number;
  tier: HealthTier;
}

export function HealthBadge({ score, tier }: HealthBadgeProps) {
  const t = TIERS[tier];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${t.dot}`} aria-hidden />
      <span className="tabular font-semibold text-ink">{score}</span>
      <span className="text-xs text-ink-2">{t.label}</span>
    </span>
  );
}
