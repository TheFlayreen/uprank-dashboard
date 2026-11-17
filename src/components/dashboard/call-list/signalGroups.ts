import type { HealthRow, SignalKey } from "@/server/metrics/health";

/** Filters on the call list group signals by the kind of conversation they need. */
export const SIGNAL_GROUPS = [
  { key: "all", label: "All", signals: null },
  { key: "payments", label: "Payments", signals: ["payment_failed", "payment_retried"] },
  { key: "leads", label: "Leads", signals: ["zero_leads", "falling_leads"] },
  { key: "onboarding", label: "Onboarding", signals: ["stuck_onboarding"] },
  { key: "engagement", label: "Engagement", signals: ["no_login", "ticket_spike"] },
] as const satisfies readonly { key: string; label: string; signals: readonly SignalKey[] | null }[];

export type SignalGroupKey = (typeof SIGNAL_GROUPS)[number]["key"];

export function matchesGroup(row: HealthRow, group: SignalGroupKey) {
  const g = SIGNAL_GROUPS.find((x) => x.key === group);
  if (!g?.signals) return true;
  const keys: readonly SignalKey[] = g.signals;
  return row.signals.some((s) => keys.includes(s.key));
}
