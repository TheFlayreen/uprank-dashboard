import type { ClientFact } from "@/server/facts";
import { addMonths, DAY_MS, daysBetween, lastFullMonth } from "@/server/facts/time";
import { dollars, isActive, tradeLabel } from "./common";
import { LEAD_RULES, leadWarningAt } from "./leadTrend";
import { quantile } from "./stats";

/**
 * Health score = 100 − Σ penalties of the signals that fire (floored at 0).
 * Penalties are additive so the score stays explainable: every point lost maps to
 * a reason shown in the UI. Weights reflect how directly a signal leads to churn:
 * a failing card cancels the subscription automatically in days; a quiet login
 * history is only a soft hint.
 */
export const HEALTH_RULES = {
  paymentFailed: { points: 40 }, // open invoice with failed attempts / past_due / delinquent
  paymentRetriedRecently: { points: 5, days: 90 }, // paid, but only after retries
  zeroLeads: { pointsTwoMonths: 30, pointsOneMonth: 12 }, // last full month(s) at 0
  fallingLeads: { points: 35, ...LEAD_RULES }, // last full month vs 3 before; ~95% left within 90 days in the backtest
  ticketSpike: { points: 10, windowDays: 30, absolute: 3, baselineDays: 150 },
  stuckOnboarding: { pointsSevere: 30, pointsMild: 12 }, // > p90 / > p75 of historic time-to-live
  noLogin: { points: 15, pointsSevere: 20, days: 30, severeDays: 60 },
  tiers: { critical: 50, atRisk: 70, watch: 90 },
} as const;

export type SignalKey =
  | "payment_failed"
  | "payment_retried"
  | "zero_leads"
  | "falling_leads"
  | "ticket_spike"
  | "stuck_onboarding"
  | "no_login";

export interface HealthSignal {
  key: SignalKey;
  label: string;
  detail: string;
  points: number;
}

export type HealthTier = "critical" | "at_risk" | "watch" | "healthy";

export interface HealthRow {
  id: string;
  name: string;
  trade: string;
  tradeLabel: string;
  region: string | null;
  status: ClientFact["status"];
  mrr: number;
  /** Billing contact, so the call list can link straight to it. */
  email: string | null;
  tenureMonths: number | null;
  score: number;
  tier: HealthTier;
  signals: HealthSignal[];
  action: string;
  /** Last 6 full months of leads (null = missing), oldest first — for a sparkline. */
  leadTrend: { month: string; leads: number | null }[];
  daysSinceLogin: number | null;
}

export interface HealthContext {
  ref: Date;
  /** Historic signup→live percentiles, used to judge "stuck in onboarding". */
  onboardingP75: number;
  onboardingP90: number;
}

export function buildHealthContext(clients: ClientFact[], ref: Date): HealthContext {
  const ttl = clients.map((c) => c.daysToLive).filter((d): d is number => d !== null);
  return {
    ref,
    onboardingP75: Math.round(quantile(ttl, 0.75)) || 21,
    onboardingP90: Math.round(quantile(ttl, 0.9)) || 30,
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
const fmtMonth = (m: string) => MONTHS[Number(m.slice(5, 7)) - 1];

export function scoreClient(c: ClientFact, ctx: HealthContext): HealthRow {
  const { ref } = ctx;
  const R = HEALTH_RULES;
  const signals: HealthSignal[] = [];

  // --- Payment ---------------------------------------------------------------
  const b = c.billing;
  const failed = b?.failedOpenInvoices ?? [];
  if (failed.length || b?.subscriptionStatus === "past_due" || b?.delinquent) {
    const inv = failed[0];
    const due = failed.reduce((s, i) => s + i.amountDue, 0);
    const next = inv?.nextAttempt ? `, next retry ${fmtDate(inv.nextAttempt)}` : "";
    signals.push({
      key: "payment_failed",
      label: "Payment failing",
      detail: inv
        ? `$${dollars(due).toFixed(0)} unpaid after ${inv.attemptCount} attempts${next}`
        : `Subscription is ${b?.subscriptionStatus ?? "delinquent"}`,
      points: R.paymentFailed.points,
    });
  } else if (b?.lastPaymentRetryAt && daysBetween(b.lastPaymentRetryAt, ref) <= R.paymentRetriedRecently.days) {
    signals.push({
      key: "payment_retried",
      label: "Payment needed retries",
      detail: `Invoice from ${fmtDate(b.lastPaymentRetryAt)} only paid after retries`,
      points: R.paymentRetriedRecently.points,
    });
  }

  // --- Leads -----------------------------------------------------------------
  const lfm = lastFullMonth(ref);
  const lead = c.status === "live" ? leadWarningAt(c, ref, R.fallingLeads.minDrop) : null;
  if (lead?.kind === "zero") {
    signals.push({
      key: "zero_leads",
      label: "Zero leads",
      detail: lead.bothMonths ? `0 leads in ${fmtMonth(addMonths(lfm, -1))} and ${fmtMonth(lfm)}` : `0 leads in ${fmtMonth(lfm)}`,
      points: lead.bothMonths ? R.zeroLeads.pointsTwoMonths : R.zeroLeads.pointsOneMonth,
    });
  } else if (lead?.kind === "falling") {
    signals.push({
      key: "falling_leads",
      label: "Leads falling",
      detail: `${lead.recent} leads in ${fmtMonth(lfm)} vs ${lead.before.toFixed(1)}/mo in the 3 months before (−${Math.round(lead.drop * 100)}%)`,
      points: R.fallingLeads.points,
    });
  }

  // --- Support tickets ---------------------------------------------------------
  const windowStart = ref.getTime() - R.ticketSpike.windowDays * DAY_MS;
  const baseStart = windowStart - R.ticketSpike.baselineDays * DAY_MS;
  const recentTickets = c.tickets.filter((t) => t.createdAt.getTime() >= windowStart && t.createdAt <= ref);
  const baseTickets = c.tickets.filter((t) => t.createdAt.getTime() >= baseStart && t.createdAt.getTime() < windowStart);
  const baselinePer30 = baseTickets.length / (R.ticketSpike.baselineDays / R.ticketSpike.windowDays);
  if (recentTickets.length >= R.ticketSpike.absolute || (recentTickets.length >= 2 && recentTickets.length >= 3 * Math.max(baselinePer30, 0.34))) {
    const cats = countBy(recentTickets.map((t) => t.category));
    const open = recentTickets.filter((t) => t.status === "open").length;
    signals.push({
      key: "ticket_spike",
      label: "Support spike",
      detail: `${recentTickets.length} tickets in 30 days (${Object.entries(cats).map(([k, v]) => `${v} ${k}`).join(", ")})${open ? `, ${open} open` : ""}; usual ≈${baselinePer30.toFixed(1)}`,
      points: R.ticketSpike.points,
    });
  }

  // --- Onboarding ----------------------------------------------------------------
  if (c.status === "onboarding") {
    const days = Math.floor(daysBetween(c.signupAt, ref));
    const step = !c.assetsReceivedAt ? "no assets received" : !c.siteApprovedAt ? "site not approved" : "approved, not live";
    if (days > ctx.onboardingP90) {
      signals.push({
        key: "stuck_onboarding",
        label: "Stuck in onboarding",
        detail: `${days} days since signup, ${step} (90% of clients are live by day ${ctx.onboardingP90})`,
        points: R.stuckOnboarding.pointsSevere,
      });
    } else if (days > ctx.onboardingP75) {
      signals.push({
        key: "stuck_onboarding",
        label: "Slow onboarding",
        detail: `${days} days since signup, ${step} (75% are live by day ${ctx.onboardingP75})`,
        points: R.stuckOnboarding.pointsMild,
      });
    }
  }

  // --- Login -------------------------------------------------------------------------
  const daysSinceLogin = c.lastLoginAt ? Math.floor(daysBetween(c.lastLoginAt, ref)) : null;
  const daysSinceSignup = daysBetween(c.signupAt, ref);
  if (daysSinceLogin === null && daysSinceSignup > R.noLogin.days) {
    signals.push({ key: "no_login", label: "No login", detail: "No valid login on record", points: R.noLogin.points });
  } else if (daysSinceLogin !== null && daysSinceLogin > R.noLogin.days) {
    signals.push({
      key: "no_login",
      label: "Not logging in",
      detail: `Last login ${daysSinceLogin} days ago`,
      points: daysSinceLogin > R.noLogin.severeDays ? R.noLogin.pointsSevere : R.noLogin.points,
    });
  }

  signals.sort((a, b) => b.points - a.points);
  const score = Math.max(0, 100 - signals.reduce((s, x) => s + x.points, 0));

  const leadTrend = Array.from({ length: 6 }, (_, i) => {
    const month = addMonths(lfm, i - 5);
    return { month, leads: c.leads.find((l) => l.month === month)?.leads ?? null };
  });

  return {
    id: c.id,
    name: c.name,
    trade: c.trade,
    tradeLabel: tradeLabel(c.trade),
    region: c.region,
    status: c.status,
    mrr: dollars(c.billing?.mrrCents ?? 0),
    email: c.billing?.email ?? null,
    tenureMonths: c.billing?.startDate ? daysBetween(c.billing.startDate, ref) / 30.4375 : null,
    score,
    tier: tierFor(score),
    signals,
    action: suggestAction(signals),
    leadTrend,
    daysSinceLogin,
  };
}

export function tierFor(score: number): HealthTier {
  const t = HEALTH_RULES.tiers;
  if (score < t.critical) return "critical";
  if (score < t.atRisk) return "at_risk";
  if (score < t.watch) return "watch";
  return "healthy";
}

const ACTIONS: Record<SignalKey, string> = {
  payment_failed: "Get card updated before the next retry",
  zero_leads: "Check site, forms and call tracking — leads stopped",
  stuck_onboarding: "Chase the blocking onboarding step and set a go-live date",
  falling_leads: "Review campaign and site performance with them",
  ticket_spike: "Close open tickets, then check in on satisfaction",
  no_login: "Send a results summary and book a review call",
  payment_retried: "Confirm billing details are current",
};
const suggestAction = (signals: HealthSignal[]) => (signals[0] ? ACTIONS[signals[0].key] : "");

function countBy(xs: string[]) {
  return xs.reduce<Record<string, number>>((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {});
}

export interface HealthResult {
  /** Active clients with at least one signal, worst first (ties: higher MRR first). */
  callList: HealthRow[];
  tierCounts: Record<HealthTier, number>;
  mrrAtRisk: number;
  signalCounts: Record<SignalKey, number>;
  context: HealthContext;
  scoredClients: number;
}

export function computeHealth(clients: ClientFact[], ref: Date): HealthResult {
  const ctx = buildHealthContext(clients, ref);
  const rows = clients.filter(isActive).map((c) => scoreClient(c, ctx));
  const flagged = rows
    .filter((r) => r.signals.length > 0)
    .sort((a, b) => a.score - b.score || b.mrr - a.mrr);

  const tierCounts = { critical: 0, at_risk: 0, watch: 0, healthy: 0 } as Record<HealthTier, number>;
  const signalCounts = {} as Record<SignalKey, number>;
  for (const r of rows) {
    tierCounts[r.tier]++;
    for (const s of r.signals) signalCounts[s.key] = (signalCounts[s.key] ?? 0) + 1;
  }
  const mrrAtRisk = rows.filter((r) => r.tier === "critical" || r.tier === "at_risk").reduce((s, r) => s + r.mrr, 0);

  return { callList: flagged, tierCounts, mrrAtRisk, signalCounts, context: ctx, scoredClients: rows.length };
}
