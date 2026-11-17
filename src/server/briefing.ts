import { feedbackLabel, money, pct } from "@/lib/format";
import type { ClientFact } from "@/server/facts";
import { DAY_MS } from "@/server/facts/time";
import type { EarlyWarningResult } from "@/server/metrics/earlyWarning";
import type { EconomicsResult } from "@/server/metrics/economics";
import type { HealthResult } from "@/server/metrics/health";
import type { RetentionResult } from "@/server/metrics/retention";
import type { RevenueTrend } from "@/server/metrics/revenueTrend";

export interface BriefingPoint {
  text: string;
  href: string;
}

export interface ActionItem {
  tone: "critical" | "warning";
  title: string;
  detail: string;
  href: string;
}

export interface Briefing {
  /** The story in 3–4 sentences, most urgent first. */
  summary: BriefingPoint[];
  /** Deadline-type items that need doing today. */
  actions: ActionItem[];
}

interface Inputs {
  clients: ClientFact[];
  ref: Date;
  health: HealthResult;
  retention: RetentionResult;
  economics: EconomicsResult;
  earlyWarning: EarlyWarningResult;
  revenue: RevenueTrend;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthName = (key: string) => MONTHS[Number(key.slice(5, 7)) - 1];
/** "Plumber" → "plumbers", "HVAC" → "HVAC clients" (for use mid-sentence). */
const plural = (label: string) => (label === label.toUpperCase() ? `${label} clients` : `${label.toLowerCase()}s`);
/** "1 client", "3 clients". */
const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
const capitalise = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
const shortDate = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`;

/** Turns the metrics into the "read this first" box. Pure; every sentence is backed by a metric. */
export function buildBriefing({ clients, ref, health, retention, economics, earlyWarning, revenue }: Inputs): Briefing {
  const summary: BriefingPoint[] = [];
  const actions: ActionItem[] = [];

  // --- Act now ---
  const urgent = health.callList.filter((r) => r.tier !== "healthy");
  const failing = clients.filter((c) => !c.churned && c.billing?.failedOpenInvoices.length);
  const nextRetry = failing
    .flatMap((c) => c.billing!.failedOpenInvoices.map((i) => i.nextAttempt))
    .filter((x): x is Date => !!x)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  summary.push({
    text:
      `${count(urgent.length, "client")} to call this week (${money(health.mrrAtRisk)} MRR at risk)` +
      (failing.length && nextRetry ? `, starting with ${count(failing.length, "failing payment")} before the ${shortDate(nextRetry)} retry.` : "."),
    href: "#call-list",
  });

  // --- Churn story ---
  const s = retention.spike;
  const late = retention.timing.find((t) => t.key === "m7p");
  if (s.isSpike && late) {
    const reasons = Object.entries(late.feedback)
      .filter(([k]) => k !== "no_feedback")
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([k]) => feedbackLabel(k).toLowerCase());
    summary.push({
      text: `Cancellations jumped to ${pct(s.recentRate, 1)} of clients a month since ${monthName(s.from)} (was ${pct(s.baselineRate, 1)}). ${pct(late.share)} of leavers had been with us 6+ months, citing ${reasons.join(" and ")}.`,
      href: "#retention",
    });
  }

  // --- Early warning ---
  const ew = earlyWarning;
  summary.push({
    text: `Leads fall first: when a client's leads drop ${pct(ew.minDrop)}+ in a month, ${pct(ew.flagged.rate)} cancel within 3 months. ${count(ew.flaggedNow.clients, "live client")} ${ew.flaggedNow.clients === 1 ? "shows" : "show"} that drop now.`,
    href: "#early-warning",
  });

  // --- Money and where to invest ---
  const trusted = economics.byTrade.filter((t) => t.trade !== "unknown" && t.confidence !== "insufficient");
  const best = trusted[0];
  const priciest = [...trusted].sort((a, b) => b.revenuePerClientMonth - a.revenuePerClientMonth)[0];
  const direction = revenue.mrrChange < 0 ? "down" : "up";
  let invest = "";
  if (best && priciest && best.trade !== priciest.trade) {
    invest = ` ${capitalise(plural(best.label))} are the most valuable clients (LTV ${money(best.ltv)}); ${plural(priciest.label)} pay the most but leave ${(priciest.monthlyChurn / best.monthlyChurn).toFixed(1)}× faster.`;
  }
  summary.push({
    text: `MRR is ${money(revenue.points[revenue.points.length - 1].mrr)}, ${direction} ${money(Math.abs(revenue.mrrChange))} since 1 ${monthName(revenue.comparedTo)}.${invest}`,
    href: "#economics",
  });

  // --- Deadline actions ---
  if (failing.length) {
    const mrr = failing.reduce((sum, c) => sum + (c.billing?.mrrCents ?? 0), 0) / 100;
    const days = nextRetry ? Math.round((nextRetry.getTime() - ref.getTime()) / DAY_MS) : null;
    actions.push({
      tone: "critical",
      title: `${count(failing.length, "payment")} failing`,
      detail: `${days !== null ? `Next automatic retry in ${days} days. ` : ""}${money(mrr)} MRR cancels automatically if it fails again.`,
      href: "#call-list",
    });
  }
  const stuck = health.callList.filter((r) => r.signals.some((x) => x.key === "stuck_onboarding" && x.points >= 30));
  if (stuck.length) {
    actions.push({
      tone: "warning",
      title: `${count(stuck.length, "client")} stuck in onboarding`,
      detail: `Paying since signup but still not live after day ${health.context.onboardingP90}, by which 90% of clients are live.`,
      href: "#call-list",
    });
  }

  return { summary, actions };
}
