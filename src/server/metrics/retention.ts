import type { ClientFact } from "@/server/facts";
import { addMonths, lastFullMonth, monthKey } from "@/server/facts/time";
import { lifespan, type Lifespan } from "./common";
import { pct } from "./stats";

/** Kaplan–Meier survival estimate at each whole month 0..maxMonth. */
export function kaplanMeier(spans: Pick<Lifespan, "months" | "churned">[], maxMonth: number) {
  const events = spans.filter((s) => s.churned).map((s) => s.months).sort((a, b) => a - b);
  const uniqueTimes = [...new Set(events)];
  let s = 1;
  const steps: { t: number; s: number }[] = [];
  for (const t of uniqueTimes) {
    const atRisk = spans.filter((x) => x.months >= t).length;
    const d = events.filter((e) => e === t).length;
    if (atRisk > 0) s *= 1 - d / atRisk;
    steps.push({ t, s });
  }
  return Array.from({ length: maxMonth + 1 }, (_, m) => {
    const last = [...steps].reverse().find((st) => st.t <= m);
    return {
      month: m,
      survival: last ? last.s : 1,
      atRisk: spans.filter((x) => x.months >= m).length,
    };
  });
}

/** Tenure windows used to split churn timing (in months since subscription start). */
export const TIMING_BUCKETS = [
  { key: "m1_3", label: "Months 1–3", from: 0, to: 3, hint: "onboarding / expectations" },
  { key: "m4_6", label: "Months 4–6", from: 3, to: 6, hint: "early results" },
  { key: "m7p", label: "After 6 months", from: 6, to: Infinity, hint: "results / value" },
] as const;

export interface TimingBucket {
  key: string;
  label: string;
  hint: string;
  churned: number;
  share: number;
  voluntary: number;
  paymentFailed: number;
  feedback: Record<string, number>;
  /** Client-months lived inside this window by everyone (churned or not). */
  exposureMonths: number;
  /** Churns per client-month at risk in this window — comparable across windows. */
  monthlyChurnRate: number;
}

export interface RetentionResult {
  totals: {
    clients: number;
    active: number;
    churned: number;
    retentionRate: number;
    voluntary: number;
    paymentFailed: number;
  };
  survival: { month: number; survival: number; atRisk: number }[];
  milestones: { month: number; survival: number; atRisk: number }[];
  timing: TimingBucket[];
  trend: { month: string; activeAtStart: number; newClients: number; cancellations: number; churnRate: number }[];
  /** Average monthly logo churn over the last 3 full months. */
  recentMonthlyChurn: number;
  feedbackOverall: Record<string, number>;
  spike: {
    isSpike: boolean;
    recentRate: number;
    baselineRate: number;
    cancellations: number;
    from: string;
    to: string;
  };
  insight: string;
}

export function computeRetention(clients: ClientFact[], ref: Date): RetentionResult {
  const spans = clients.map((c) => ({ c, s: lifespan(c, ref) })).filter((x): x is { c: ClientFact; s: Lifespan } => !!x.s);
  const churned = spans.filter((x) => x.s.churned);

  // --- Survival ---
  const maxMonth = Math.floor(Math.max(...spans.map((x) => x.s.months)));
  const survival = kaplanMeier(spans.map((x) => x.s), maxMonth);
  const milestones = [3, 6, 12].filter((m) => m <= maxMonth).map((m) => survival[m]);

  // --- Timing buckets ---
  const timing: TimingBucket[] = TIMING_BUCKETS.map((b) => {
    const inBucket = churned.filter((x) => x.s.months > b.from && x.s.months <= b.to);
    const exposure = spans.reduce((sum, x) => sum + Math.max(0, Math.min(x.s.months, b.to) - b.from), 0);
    const feedback: Record<string, number> = {};
    for (const x of inBucket) {
      if (x.c.billing?.cancelReason === "payment_failed") continue;
      const f = x.c.billing?.cancelFeedback ?? "no_feedback";
      feedback[f] = (feedback[f] ?? 0) + 1;
    }
    const paymentFailed = inBucket.filter((x) => x.c.billing?.cancelReason === "payment_failed").length;
    return {
      key: b.key,
      label: b.label,
      hint: b.hint,
      churned: inBucket.length,
      share: pct(inBucket.length, churned.length),
      voluntary: inBucket.length - paymentFailed,
      paymentFailed,
      feedback,
      exposureMonths: exposure,
      monthlyChurnRate: pct(inBucket.length, exposure),
    };
  });

  // --- Monthly trend (last 12 full months) ---
  const lfm = lastFullMonth(ref);
  const trend = Array.from({ length: 12 }, (_, i) => {
    const month = addMonths(lfm, i - 11);
    const monthStart = new Date(`${month}-01T00:00:00Z`);
    const activeAtStart = spans.filter((x) => x.s.start < monthStart && (!x.s.churned || x.s.end >= monthStart)).length;
    const newClients = spans.filter((x) => monthKey(x.s.start) === month).length;
    const cancellations = churned.filter((x) => monthKey(x.s.end) === month).length;
    return { month, activeAtStart, newClients, cancellations, churnRate: pct(cancellations, activeAtStart) };
  });
  const last3 = trend.slice(-3);
  const recentMonthlyChurn = pct(
    last3.reduce((s, t) => s + t.cancellations, 0),
    last3.reduce((s, t) => s + t.activeAtStart, 0),
  );

  const feedbackOverall: Record<string, number> = {};
  for (const x of churned) {
    const key = x.c.billing?.cancelReason === "payment_failed" ? "payment_failed" : (x.c.billing?.cancelFeedback ?? "no_feedback");
    feedbackOverall[key] = (feedbackOverall[key] ?? 0) + 1;
  }

  const paymentFailed = churned.filter((x) => x.c.billing?.cancelReason === "payment_failed").length;
  const active = clients.filter((c) => !c.churned).length;

  return {
    totals: {
      clients: clients.length,
      active,
      churned: churned.length,
      retentionRate: pct(active, clients.length),
      voluntary: churned.length - paymentFailed,
      paymentFailed,
    },
    survival,
    milestones,
    timing,
    trend,
    recentMonthlyChurn,
    feedbackOverall,
    spike: detectSpike(trend),
    insight: retentionInsight(timing, milestones),
  };
}

/** Flags when the last 3 months churned far faster than the 9 months before. */
function detectSpike(trend: RetentionResult["trend"]): RetentionResult["spike"] {
  const recent = trend.slice(-3);
  const before = trend.slice(0, -3);
  const rate = (xs: typeof trend) =>
    pct(xs.reduce((s, t) => s + t.cancellations, 0), xs.reduce((s, t) => s + t.activeAtStart, 0));
  const recentRate = rate(recent);
  const baselineRate = rate(before);
  const cancellations = recent.reduce((s, t) => s + t.cancellations, 0);
  const isSpike = cancellations >= 5 && recentRate > 2 * Math.max(baselineRate, 0.005);
  return {
    isSpike,
    recentRate,
    baselineRate,
    cancellations,
    from: recent[0].month,
    to: recent[recent.length - 1].month,
  };
}

function retentionInsight(timing: TimingBucket[], milestones: { month: number; survival: number }[]) {
  const top = [...timing].sort((a, b) => b.churned - a.churned)[0];
  const riskiest = [...timing].sort((a, b) => b.monthlyChurnRate - a.monthlyChurnRate)[0];
  const m12 = milestones.find((m) => m.month === 12);
  const parts = [
    `Most cancellations happen ${top.label.toLowerCase()} (${Math.round(top.share * 100)}%)`,
    riskiest.key !== top.key
      ? `but the highest monthly risk is in ${riskiest.label.toLowerCase()} (${(riskiest.monthlyChurnRate * 100).toFixed(1)}%/mo)`
      : `and it is also the riskiest period per month (${(riskiest.monthlyChurnRate * 100).toFixed(1)}%/mo)`,
  ];
  return `${parts.join(", ")}.${m12 ? ` ${Math.round(m12.survival * 100)}% of clients are still with us after 12 months.` : ""}`;
}
