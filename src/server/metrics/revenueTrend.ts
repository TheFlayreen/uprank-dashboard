import type { ClientFact } from "@/server/facts";
import { addMonths, monthKey } from "@/server/facts/time";
import { dollars } from "./common";

export interface RevenuePoint {
  /** Snapshot taken on the 1st of this month. */
  month: string;
  mrr: number;
  activeClients: number;
}

export interface RevenueTrend {
  points: RevenuePoint[];
  /** Change in MRR / active clients vs `compareMonths` ago. */
  mrrChange: number;
  mrrChangePct: number;
  clientChange: number;
  compareMonths: number;
  comparedTo: string;
}

/**
 * MRR and active clients on the 1st of each month, reconstructed from subscription dates.
 * Uses current list prices (billing has no price history); the ads add-on counts only
 * from the day it was added.
 */
export function computeRevenueTrend(clients: ClientFact[], ref: Date, months = 12, compareMonths = 3): RevenueTrend {
  const billed = clients.filter((c) => c.billing?.startDate);
  const refMonth = monthKey(ref);

  const points = Array.from({ length: months + 1 }, (_, i) => {
    const month = addMonths(refMonth, i - months);
    const at = new Date(`${month}-01T00:00:00Z`);
    let cents = 0;
    let active = 0;
    for (const c of billed) {
      const b = c.billing!;
      if (b.startDate! > at) continue;
      if (b.canceledAt && b.canceledAt <= at) continue;
      active++;
      cents += b.planCents + (c.ads.enabled && c.ads.since && c.ads.since <= at ? b.adsCents : 0);
    }
    return { month, mrr: dollars(cents), activeClients: active };
  });

  const now = points[points.length - 1];
  const then = points[points.length - 1 - compareMonths];
  return {
    points,
    mrrChange: now.mrr - then.mrr,
    mrrChangePct: then.mrr ? (now.mrr - then.mrr) / then.mrr : NaN,
    clientChange: now.activeClients - then.activeClients,
    compareMonths,
    comparedTo: then.month,
  };
}
