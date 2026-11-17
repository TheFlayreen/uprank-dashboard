import type { FactsResult } from "@/server/facts";
import { computeAds } from "@/server/metrics/ads";
import { computeEarlyWarning } from "@/server/metrics/earlyWarning";
import { computeEconomics } from "@/server/metrics/economics";
import { computeHealth } from "@/server/metrics/health";
import { computeLeadsByTrade } from "@/server/metrics/leads";
import { computeRetention } from "@/server/metrics/retention";
import { computeRevenueTrend } from "@/server/metrics/revenueTrend";
import { buildBriefing } from "@/server/briefing";

/** Pure: facts in, display-ready dashboard out. No I/O, so it is unit-testable. */
export function buildDashboard(facts: FactsResult) {
  const { clients, referenceDate: ref } = facts;

  const health = computeHealth(clients, ref);
  const retention = computeRetention(clients, ref);
  const leads = computeLeadsByTrade(clients, ref);
  const economics = computeEconomics(clients, ref);
  const ads = computeAds(clients, ref);
  const earlyWarning = computeEarlyWarning(clients, ref);

  const active = clients.filter((c) => !c.churned);
  const issueCounts: Record<string, number> = {};
  for (const c of clients) {
    for (const i of c.dataIssues) {
      const key = i.replace(/cus_\w+/, "<id>");
      issueCounts[key] = (issueCounts[key] ?? 0) + 1;
    }
  }

  const revenue = computeRevenueTrend(clients, ref);
  const briefing = buildBriefing({ clients, ref, health, retention, economics, earlyWarning, revenue });

  return {
    referenceDate: ref.toISOString(),
    briefing,
    overview: {
      mrr: revenue.points[revenue.points.length - 1].mrr,
      mrrChange: revenue.mrrChange,
      mrrChangePct: revenue.mrrChangePct,
      activeClients: active.length,
      clientChange: revenue.clientChange,
      comparedTo: revenue.comparedTo,
      onboarding: active.filter((c) => c.status === "onboarding").length,
      recentMonthlyChurn: retention.recentMonthlyChurn,
      baselineMonthlyChurn: retention.spike.baselineRate,
      churnSpike: retention.spike.isSpike,
      survival12m: retention.milestones.find((m) => m.month === 12)?.survival ?? null,
      ltv: economics.overall.ltv,
      callThisWeek: health.callList.filter((r) => r.tier !== "healthy").length,
    },
    revenue,
    health,
    retention,
    leads,
    economics,
    ads,
    earlyWarning,
    dataQuality: {
      excluded: facts.excluded,
      issueCounts,
      clientsWithIssues: clients
        .filter((c) => c.dataIssues.length)
        .map((c) => ({ id: c.id, name: c.name, issues: c.dataIssues })),
      notes: [
        "First live month is excluded from lead comparisons (partial month: ~4 leads vs ~10 in later months).",
        "Missing lead months are treated as missing, not zero.",
        "Months after the reference date's previous month are incomplete and excluded.",
        "Revenue = paid invoices minus post-payment refunds; void/uncollectible invoices earn nothing.",
        "Billing is the source of truth for the ads add-on and cancellation dates; product for trade, onboarding and leads.",
      ],
    },
  };
}
