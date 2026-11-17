import { num } from "@/lib/format";
import type { HealthRow } from "@/server/metrics/health";

export interface ClientMetaProps {
  row: HealthRow;
}

/** "Plumber · Melbourne · 15 mo" */
export function ClientMeta({ row: r }: ClientMetaProps) {
  const tenure = r.status === "onboarding" ? "onboarding" : r.tenureMonths !== null ? `${num(r.tenureMonths, 0)} mo` : null;
  return <p className="text-xs text-muted">{[r.tradeLabel, r.region, tenure].filter(Boolean).join(" · ")}</p>;
}
