import type { ClientFact } from "@/server/facts";
import { dollars, groupByTrade, lifespan, tradeLabel } from "./common";
import { type Confidence, poissonRateCI, sampleConfidence } from "./stats";

/** Lifetime is capped so a trade with very few churns doesn't show an "infinite" LTV. */
export const LIFETIME_CAP_MONTHS = 60;

export interface TradeEconomics {
  trade: string;
  label: string;
  clients: number;
  activeClients: number;
  /** Net revenue (paid − refunds) per billed client-month, incl. add-ons. AUD. */
  revenuePerClientMonth: number;
  /** Current list price of the base plan. AUD. */
  planPrice: number | null;
  currentMrr: number;
  churns: number;
  exposureMonths: number;
  /** Churns per client-month at risk (constant-hazard estimate). */
  monthlyChurn: number;
  /** Expected months retained = 1 / monthlyChurn, capped. */
  expectedLifetimeMonths: number;
  lifetimeLow: number;
  lifetimeHigh: number;
  lifetimeCapped: boolean;
  /** revenuePerClientMonth × expectedLifetimeMonths. AUD. */
  ltv: number;
  ltvLow: number;
  ltvHigh: number;
  confidence: Confidence;
}

export interface EconomicsResult {
  byTrade: TradeEconomics[];
  overall: Pick<TradeEconomics, "revenuePerClientMonth" | "monthlyChurn" | "expectedLifetimeMonths" | "ltv" | "currentMrr">;
  insight: string;
}

/**
 * Why not "average months retained of clients who left"? That only looks at churned
 * clients and ignores everyone still active, so it understates lifetime — badly for
 * young cohorts. Instead we use churns / client-months at risk (a hazard rate that
 * counts active clients' time too) and invert it: expected lifetime = 1 / hazard.
 */
export function computeEconomics(clients: ClientFact[], ref: Date): EconomicsResult {
  const billed = clients.filter((c) => c.billing);

  const summarize = (cs: ClientFact[]) => {
    const net = cs.reduce((s, c) => s + (c.billing?.netRevenueCents ?? 0), 0);
    const billedMonths = cs.reduce((s, c) => s + (c.billing?.paidInvoices ?? 0), 0);
    const spans = cs.map((c) => lifespan(c, ref)).filter((s) => s !== null);
    const churns = spans.filter((s) => s.churned).length;
    const exposure = spans.reduce((s, x) => s + x.months, 0);
    const rate = poissonRateCI(churns, exposure);
    const life = (r: number) => (r > 0 ? Math.min(LIFETIME_CAP_MONTHS, 1 / r) : LIFETIME_CAP_MONTHS);
    const arpa = billedMonths ? dollars(net) / billedMonths : NaN;
    const lifetime = life(rate.rate);
    return {
      revenuePerClientMonth: arpa,
      currentMrr: dollars(cs.reduce((s, c) => s + (c.billing?.mrrCents ?? 0), 0)),
      churns,
      exposureMonths: exposure,
      monthlyChurn: rate.rate,
      expectedLifetimeMonths: lifetime,
      // A higher churn rate means a shorter life, so the bounds swap.
      lifetimeLow: life(rate.high),
      lifetimeHigh: life(rate.low),
      lifetimeCapped: lifetime >= LIFETIME_CAP_MONTHS,
      ltv: arpa * lifetime,
      ltvLow: arpa * life(rate.high),
      ltvHigh: arpa * life(rate.low),
    };
  };

  const byTrade: TradeEconomics[] = groupByTrade(billed).map(([trade, cs]) => {
    const prices = cs.map((c) => c.billing!.planCents).filter((p) => p > 0);
    return {
      trade,
      label: tradeLabel(trade),
      clients: cs.length,
      activeClients: cs.filter((c) => !c.churned).length,
      planPrice: prices.length ? dollars(mode(prices)) : null,
      ...summarize(cs),
      confidence: sampleConfidence(cs.length),
    };
  });
  byTrade.sort((a, b) => (a.trade === "unknown" ? 1 : b.trade === "unknown" ? -1 : b.ltv - a.ltv));

  const o = summarize(billed);
  return {
    byTrade,
    overall: {
      revenuePerClientMonth: o.revenuePerClientMonth,
      monthlyChurn: o.monthlyChurn,
      expectedLifetimeMonths: o.expectedLifetimeMonths,
      ltv: o.ltv,
      currentMrr: o.currentMrr,
    },
    insight: economicsInsight(byTrade),
  };
}

function economicsInsight(rows: TradeEconomics[]) {
  const trusted = rows.filter((r) => r.confidence !== "insufficient" && r.trade !== "unknown");
  if (trusted.length < 2) return "Not enough data per trade to compare lifetime value.";
  const best = trusted[0];
  const byPrice = [...trusted].sort((a, b) => b.revenuePerClientMonth - a.revenuePerClientMonth)[0];
  if (best.trade === byPrice.trade) {
    return `${best.label} is the best business: highest revenue per month and an LTV of $${Math.round(best.ltv).toLocaleString()}.`;
  }
  const ratio = best.expectedLifetimeMonths / byPrice.expectedLifetimeMonths;
  return `${byPrice.label} pays the most per month ($${Math.round(byPrice.revenuePerClientMonth)}), but ${best.label} stays ${ratio.toFixed(1)}× longer, so it is worth more over its lifetime ($${Math.round(best.ltv).toLocaleString()} vs $${Math.round(byPrice.ltv).toLocaleString()}).`;
}

function mode(xs: number[]) {
  const counts = new Map<number, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
