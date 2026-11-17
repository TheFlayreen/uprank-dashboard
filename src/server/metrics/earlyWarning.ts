import type { ClientFact } from "@/server/facts";
import { addMonths, DAY_MS, lastFullMonth, monthKey } from "@/server/facts/time";
import { usableLeadMonths } from "./common";
import { LEAD_RULES, leadWarningAt } from "./leadTrend";
import { mean, median, pct } from "./stats";

/**
 * Bonus: does a lead slump predict cancellation, and how early?
 *
 * Point-in-time backtest. At the 1st of each past month we look at every client who was
 * live and subscribed that day, apply the lead rule using ONLY lead months that had
 * already finished, and check whether they cancelled in the following HORIZON days.
 * No future data leaks into a snapshot.
 */
export const HORIZON_DAYS = 90;
export const THRESHOLDS = [0.3, 0.4, 0.5, 0.6];
const TRAJECTORY_MONTHS = 6;

interface Rates {
  observations: number;
  churned: number;
  rate: number;
}

export interface ThresholdRow {
  minDrop: number;
  flagged: Rates;
  notFlagged: Rates;
  lift: number;
  recall: number;
  chosen: boolean;
}

export interface EarlyWarningResult {
  horizonDays: number;
  /** The drop threshold the live rule uses (for charts). */
  minDrop: number;
  snapshots: { from: string; to: string; count: number };
  flagged: Rates;
  notFlagged: Rates;
  /** How many times likelier a flagged client is to cancel within the horizon. */
  lift: number;
  /** Of clients who cancelled (and had lead history), how many were flagged beforehand. */
  recall: {
    churners: number;
    caught: number;
    rate: number;
    medianLeadDays: number | null;
    /** Voluntary cancellations after 6+ months — the "results" churn a lead rule is meant to catch. */
    resultsDriven: { churners: number; caught: number; rate: number };
    byReason: Record<string, { churners: number; caught: number }>;
  };
  thresholds: ThresholdRow[];
  /** Leads as % of each client's own normal level, by months before cancelling (vs. stayers before today). */
  trajectory: { offset: number; left: number | null; leftN: number; stayed: number | null; stayedN: number }[];
  /** Live clients the rule flags today, and the MRR they carry. */
  flaggedNow: { clients: number; mrr: number };
  insight: string;
}

const isEligibleAt = (c: ClientFact, t: Date) => {
  const b = c.billing;
  if (!b?.startDate || b.startDate >= t) return false;
  if (b.canceledAt && b.canceledAt < t) return false;
  return !!c.liveAt && c.liveAt < t;
};

const cancelsWithin = (c: ClientFact, t: Date, days: number) => {
  const at = c.billing?.canceledAt;
  return !!at && at >= t && at.getTime() < t.getTime() + days * DAY_MS;
};

export function computeEarlyWarning(clients: ClientFact[], ref: Date): EarlyWarningResult {
  // Snapshots: 1st of each month, as long as the full horizon has been observed.
  const lastSnapshot = new Date(ref.getTime() - HORIZON_DAYS * DAY_MS);
  const firstLive = clients.map((c) => c.liveAt).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0];
  const snapshots: Date[] = [];
  if (firstLive) {
    // need ≥ 4 months of history before the first snapshot for the rule to be evaluable
    for (let k = addMonths(monthKey(firstLive), 5); ; k = addMonths(k, 1)) {
      const t = new Date(`${k}-01T00:00:00Z`);
      if (t > lastSnapshot) break;
      snapshots.push(t);
    }
  }

  const evaluate = (minDrop: number) => {
    const flagged = { observations: 0, churned: 0 };
    const notFlagged = { observations: 0, churned: 0 };
    const firstFlag = new Map<string, Date>();
    for (const t of snapshots) {
      for (const c of clients) {
        if (!isEligibleAt(c, t)) continue;
        const warn = leadWarningAt(c, t, minDrop) !== null;
        const outcome = cancelsWithin(c, t, HORIZON_DAYS);
        const bucket = warn ? flagged : notFlagged;
        bucket.observations++;
        if (outcome) bucket.churned++;
        if (warn && outcome && !firstFlag.has(c.id)) firstFlag.set(c.id, t);
      }
    }
    return { flagged, notFlagged, firstFlag };
  };

  // Recall population: clients who cancelled while at least one snapshot could have seen them.
  const churners = clients.filter((c) => c.billing?.canceledAt && snapshots.some((t) => isEligibleAt(c, t) && cancelsWithin(c, t, HORIZON_DAYS)));

  const withRates = (x: { observations: number; churned: number }): Rates => ({ ...x, rate: pct(x.churned, x.observations) });

  const thresholds: ThresholdRow[] = THRESHOLDS.map((minDrop) => {
    const r = evaluate(minDrop);
    const f = withRates(r.flagged);
    const n = withRates(r.notFlagged);
    return { minDrop, flagged: f, notFlagged: n, lift: f.rate / n.rate, recall: pct(r.firstFlag.size, churners.length), chosen: minDrop === LEAD_RULES.minDrop };
  });

  const main = evaluate(LEAD_RULES.minDrop);
  const flagged = withRates(main.flagged);
  const notFlagged = withRates(main.notFlagged);

  const leadDays = churners
    .filter((c) => main.firstFlag.has(c.id))
    .map((c) => (c.billing!.canceledAt!.getTime() - main.firstFlag.get(c.id)!.getTime()) / DAY_MS);

  const resultsDriven = churners.filter(
    (c) => c.billing?.cancelReason !== "payment_failed" && c.billing?.startDate && (c.billing.canceledAt!.getTime() - c.billing.startDate.getTime()) / DAY_MS > 6 * 30.4375,
  );
  const rdCaught = resultsDriven.filter((c) => main.firstFlag.has(c.id)).length;

  const byReason: Record<string, { churners: number; caught: number }> = {};
  for (const c of churners) {
    const key = c.billing?.cancelReason === "payment_failed" ? "payment_failed" : (c.billing?.cancelFeedback ?? "no_feedback");
    byReason[key] ??= { churners: 0, caught: 0 };
    byReason[key].churners++;
    if (main.firstFlag.has(c.id)) byReason[key].caught++;
  }

  // --- Trajectory: own-baseline-indexed leads in the months before cancelling ---
  const indexed = (c: ClientFact, anchorMonth: string) => {
    const leads = new Map(usableLeadMonths(c, ref).map((l) => [l.month, l.leads]));
    const series = Array.from({ length: TRAJECTORY_MONTHS }, (_, i) => leads.get(addMonths(anchorMonth, i - TRAJECTORY_MONTHS + 1)));
    const base = series.slice(0, 3).filter((x): x is number => x !== undefined);
    if (base.length < 2 || mean(base) <= 0) return null;
    const b = mean(base);
    return series.map((x) => (x === undefined ? null : x / b));
  };
  const leftSeries = clients
    .filter((c) => c.churned && c.billing?.canceledAt)
    .map((c) => indexed(c, addMonths(monthKey(c.billing!.canceledAt!), -1)))
    .filter((s): s is (number | null)[] => !!s);
  const stayedSeries = clients
    .filter((c) => !c.churned && c.status === "live")
    .map((c) => indexed(c, lastFullMonth(ref)))
    .filter((s): s is (number | null)[] => !!s);
  const colMean = (rows: (number | null)[][], i: number) => {
    const v = rows.map((r) => r[i]).filter((x): x is number => x !== null);
    return { avg: v.length ? mean(v) : null, n: v.length };
  };
  const trajectory = Array.from({ length: TRAJECTORY_MONTHS }, (_, i) => {
    const l = colMean(leftSeries, i);
    const s = colMean(stayedSeries, i);
    return { offset: i - TRAJECTORY_MONTHS, left: l.avg, leftN: l.n, stayed: s.avg, stayedN: s.n };
  });

  const now = clients.filter((c) => !c.churned && c.status === "live" && leadWarningAt(c, ref) !== null);

  const result: EarlyWarningResult = {
    horizonDays: HORIZON_DAYS,
    minDrop: LEAD_RULES.minDrop,
    snapshots: {
      from: snapshots.length ? monthKey(snapshots[0]) : "",
      to: snapshots.length ? monthKey(snapshots[snapshots.length - 1]) : "",
      count: snapshots.length,
    },
    flagged,
    notFlagged,
    lift: flagged.rate / notFlagged.rate,
    recall: {
      churners: churners.length,
      caught: main.firstFlag.size,
      rate: pct(main.firstFlag.size, churners.length),
      medianLeadDays: leadDays.length ? median(leadDays) : null,
      resultsDriven: { churners: resultsDriven.length, caught: rdCaught, rate: pct(rdCaught, resultsDriven.length) },
      byReason,
    },
    thresholds,
    trajectory,
    flaggedNow: { clients: now.length, mrr: now.reduce((s, c) => s + (c.billing?.mrrCents ?? 0), 0) / 100 },
    insight: "",
  };
  result.insight = earlyWarningInsight(result);
  return result;
}

function earlyWarningInsight(r: EarlyWarningResult) {
  const p = (x: number) => `${Math.round(x * 100)}%`;
  const weeks = r.recall.medianLeadDays !== null ? Math.round(r.recall.medianLeadDays / 7) : null;
  return (
    `When a client's leads fall ${p(LEAD_RULES.minDrop)}+ below their own normal in a month, ${p(r.flagged.rate)} of them cancelled within ${Math.round(r.horizonDays / 30)} months — ` +
    `vs ${p(r.notFlagged.rate)} of everyone else (${r.lift.toFixed(0)}× likelier). ` +
    `Tested on ${r.snapshots.count} past months, the rule flagged ${r.recall.resultsDriven.caught} of ${r.recall.resultsDriven.churners} long-tenured clients who left` +
    (weeks !== null ? `, a median ${weeks} weeks before they cancelled.` : ".")
  );
}
