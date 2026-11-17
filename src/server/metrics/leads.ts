import type { ClientFact } from "@/server/facts";
import { groupByTrade, tradeLabel, usableLeadMonths } from "./common";
import { type Confidence, mean, meanCI, median, sampleConfidence } from "./stats";

export interface TradeLeads {
  trade: string;
  label: string;
  /** Clients with at least one comparable lead month. */
  clients: number;
  clientMonths: number;
  /** Mean of each client's average leads/month (each client weighs the same). */
  leadsPerClientMonth: number;
  median: number;
  ciLow: number | null;
  ciHigh: number | null;
  confidence: Confidence;
  /** Whether the trade's 95% CI sits clearly above/below the overall mean. */
  vsOverall: "above" | "below" | "similar" | "unknown";
}

export interface LeadsResult {
  overall: { clients: number; clientMonths: number; leadsPerClientMonth: number; median: number };
  byTrade: TradeLeads[];
  insight: string;
}

/**
 * Leads per client per month by trade.
 * Unit of analysis is the client (not the client-month) so one long-tenured client
 * can't dominate a small trade, and the CI reflects how many clients we really have.
 */
export function computeLeadsByTrade(clients: ClientFact[], ref: Date): LeadsResult {
  const perClient = (cs: ClientFact[]) =>
    cs
      .map((c) => usableLeadMonths(c, ref))
      .filter((ms) => ms.length > 0)
      .map((ms) => ({ avg: mean(ms.map((m) => m.leads)), months: ms.length }));

  const all = perClient(clients);
  const overallMean = mean(all.map((x) => x.avg));

  const byTrade: TradeLeads[] = groupByTrade(clients).map(([trade, cs]) => {
    const rows = perClient(cs);
    const avgs = rows.map((r) => r.avg);
    const ci = avgs.length >= 2 ? meanCI(avgs) : null;
    const confidence = sampleConfidence(rows.length);
    const vsOverall: TradeLeads["vsOverall"] =
      !ci || confidence === "insufficient"
        ? "unknown"
        : ci.low > overallMean
          ? "above"
          : ci.high < overallMean
            ? "below"
            : "similar";
    return {
      trade,
      label: tradeLabel(trade),
      clients: rows.length,
      clientMonths: rows.reduce((s, r) => s + r.months, 0),
      leadsPerClientMonth: mean(avgs),
      median: median(avgs),
      ciLow: ci ? Math.max(0, ci.low) : null,
      ciHigh: ci ? ci.high : null,
      confidence,
      vsOverall,
    };
  });
  byTrade.sort((a, b) => (a.trade === "unknown" ? 1 : b.trade === "unknown" ? -1 : b.leadsPerClientMonth - a.leadsPerClientMonth));

  return {
    overall: {
      clients: all.length,
      clientMonths: all.reduce((s, r) => s + r.months, 0),
      leadsPerClientMonth: overallMean,
      median: median(all.map((x) => x.avg)),
    },
    byTrade,
    insight: leadsInsight(byTrade, overallMean),
  };
}

function leadsInsight(rows: TradeLeads[], overall: number) {
  const trusted = rows.filter((r) => r.confidence !== "insufficient" && r.trade !== "unknown");
  const above = trusted.filter((r) => r.vsOverall === "above").map((r) => r.label);
  const below = trusted.filter((r) => r.vsOverall === "below").map((r) => r.label);
  const thin = rows.filter((r) => r.confidence !== "ok").map((r) => `${r.label} (n=${r.clients})`);
  const parts: string[] = [`Average client gets ${overall.toFixed(1)} leads/month.`];
  if (above.length) parts.push(`Clearly above average: ${above.join(", ")}.`);
  if (below.length) parts.push(`Clearly below: ${below.join(", ")}.`);
  if (!above.length && !below.length) parts.push("No trade is clearly different from the average once sample size is accounted for.");
  if (thin.length) parts.push(`Too few clients to judge: ${thin.join(", ")}.`);
  return parts.join(" ");
}
