import type { ClientFact } from "@/server/facts";
import { addMonths, lastFullMonth } from "@/server/facts/time";
import { usableLeadMonths } from "./common";
import { mean } from "./stats";

/**
 * Chosen by the point-in-time backtest (see earlyWarning.ts / the dashboard's bonus section):
 * comparing the LAST full month to the 3 months before it fires ~3 weeks earlier and catches
 * about twice as many cancellations as averaging the last two months, at ~95% precision.
 */
export const LEAD_RULES = {
  minDrop: 0.4,
  /** Ignore tiny baselines where one lead more or less is a big percentage. */
  minBaseline: 3,
  baselineMonths: 3,
} as const;

export type LeadWarning =
  | { kind: "zero"; bothMonths: boolean; lastMonth: string }
  | { kind: "falling"; recent: number; before: number; drop: number; lastMonth: string };

/**
 * The lead-trend rule used by BOTH the live health score and the historical backtest,
 * evaluated as of `asOf` using only months that had fully elapsed by then.
 *  - zero: 0 leads in the last full month;
 *  - falling: last full month ≥ minDrop below the average of the 3 months before it
 *    (at least 2 of them present, average ≥ minBaseline).
 */
export function leadWarningAt(c: ClientFact, asOf: Date, minDrop: number = LEAD_RULES.minDrop): LeadWarning | null {
  if (!c.liveAt || c.liveAt >= asOf) return null;
  const lfm = lastFullMonth(asOf);
  const usable = new Map(usableLeadMonths(c, asOf).map((l) => [l.month, l.leads]));
  const last = usable.get(lfm);
  if (last === undefined) return null;
  if (last === 0) return { kind: "zero", bothMonths: usable.get(addMonths(lfm, -1)) === 0, lastMonth: lfm };

  const baseline = Array.from({ length: LEAD_RULES.baselineMonths }, (_, i) => usable.get(addMonths(lfm, -(i + 1)))).filter(
    (x): x is number => x !== undefined,
  );
  if (baseline.length < 2) return null;
  const before = mean(baseline);
  const drop = before > 0 ? 1 - last / before : 0;
  if (before >= LEAD_RULES.minBaseline && drop >= minDrop) {
    return { kind: "falling", recent: last, before, drop, lastMonth: lfm };
  }
  return null;
}
