import type { ClientFact } from "@/server/facts";
import { lastFullMonth, monthKey, monthsBetween } from "@/server/facts/time";

/** Subscription lifespan used for retention, churn hazards and LTV. */
export interface Lifespan {
  start: Date;
  end: Date;
  months: number;
  churned: boolean;
}

/**
 * Start = billing subscription start (falls back to product signup when billing is missing).
 * End = cancellation date if churned, otherwise the reference date (right-censored).
 */
export function lifespan(c: ClientFact, ref: Date): Lifespan | null {
  const start = c.billing?.startDate ?? c.signupAt;
  const canceledAt = c.billing?.canceledAt ?? null;
  // A churned client without a cancellation date can't be placed on the timeline.
  if (c.churned && !canceledAt) return null;
  const end = c.churned && canceledAt ? canceledAt : ref;
  return { start, end, months: Math.max(0, monthsBetween(start, end)), churned: c.churned };
}

/**
 * Lead months that are fair to compare:
 *  - drop the go-live month (partial: avg ≈4 vs ≈10 in later months),
 *  - drop anything not fully elapsed before the reference date,
 *  - gaps stay gaps (missing ≠ zero).
 */
export function usableLeadMonths(c: ClientFact, ref: Date) {
  const last = lastFullMonth(ref);
  const liveMonth = c.liveAt ? monthKey(c.liveAt) : null;
  return c.leads.filter((l) => l.month !== liveMonth && l.month <= last);
}

export const isActive = (c: ClientFact) => !c.churned;
export const dollars = (cents: number) => cents / 100;

export const TRADE_LABELS: Record<string, string> = {
  plumber: "Plumber",
  electrician: "Electrician",
  roofer: "Roofer",
  builder: "Builder",
  painter: "Painter",
  hvac: "HVAC",
  landscaper: "Landscaper",
  unknown: "Unknown trade",
};
export const tradeLabel = (t: string) => TRADE_LABELS[t] ?? t.charAt(0).toUpperCase() + t.slice(1);

export function groupByTrade(clients: ClientFact[]) {
  const m = new Map<string, ClientFact[]>();
  for (const c of clients) {
    const arr = m.get(c.trade);
    if (arr) arr.push(c);
    else m.set(c.trade, [c]);
  }
  // Known trades first by size, "unknown" always last.
  return [...m.entries()].sort(([a, x], [b, y]) =>
    a === "unknown" ? 1 : b === "unknown" ? -1 : y.length - x.length,
  );
}
