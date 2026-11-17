import type { ClientFact } from "@/server/facts";
import { monthsBetween } from "@/server/facts/time";
import { dollars, lifespan } from "./common";
import { pct, poissonRateCI } from "./stats";

export interface ChurnExposure {
  churns: number;
  exposureMonths: number;
  monthlyChurn: number;
  low: number;
  high: number;
}

export const TENURE_BANDS = [
  { label: "Months 1–6", from: 0, to: 6 },
  { label: "Months 7–12", from: 6, to: 12 },
  { label: "After 12 months", from: 12, to: Infinity },
] as const;

export interface AdsResult {
  attach: {
    active: number;
    activeWithAds: number;
    rate: number;
    everWithAds: number;
    medianMonthsToAttach: number | null;
    addonMrr: number;
    addonShareOfMrr: number;
  };
  /** Naive view: "% of clients who churned" by current ads status (shown for contrast). */
  naive: { withAds: { clients: number; churned: number; rate: number }; withoutAds: { clients: number; churned: number; rate: number } };
  /** Fair view: churn per client-month, split by whether ads was on during that month. */
  hazard: { withAds: ChurnExposure; withoutAds: ChurnExposure; relativeRisk: number };
  /** Same, within tenure bands — controls for "ads clients are older clients". */
  byTenure: { label: string; withAds: ChurnExposure; withoutAds: ChurnExposure }[];
  priceSensitivity: {
    withAds: { churned: number; tooExpensive: number; share: number };
    withoutAds: { churned: number; tooExpensive: number; share: number };
  };
  verdict: string;
}

const exposure = (churns: number, months: number): ChurnExposure => {
  const ci = poissonRateCI(churns, months);
  return { churns, exposureMonths: months, monthlyChurn: ci.rate, low: ci.low, high: ci.high };
};

export function computeAds(clients: ClientFact[], ref: Date): AdsResult {
  // Billing-linked clients only: the add-on is a billing fact.
  const billed = clients.filter((c) => c.billing);
  const active = billed.filter((c) => !c.churned);

  // --- Time-varying exposure ---
  // Ads is always added after signup, so comparing "clients with ads" vs "without" is
  // biased: an ads client had to survive long enough to buy it. We split each client's
  // life into months without ads (start → ads date) and with ads (ads date → end), and
  // attribute a churn to whichever state the client was in when they left.
  let adsMonths = 0, adsChurns = 0, noAdsMonths = 0, noAdsChurns = 0;
  const bands = TENURE_BANDS.map(() => ({ adsM: 0, adsC: 0, noM: 0, noC: 0 }));

  for (const c of billed) {
    const span = lifespan(c, ref);
    if (!span) continue;
    const adsFrom = c.ads.enabled && c.ads.since ? Math.max(0, monthsBetween(span.start, c.ads.since)) : Infinity;
    const end = span.months;
    const noAds = Math.min(end, adsFrom);
    const withAds = Math.max(0, end - adsFrom);
    noAdsMonths += noAds;
    adsMonths += withAds;
    const churnedOnAds = span.churned && end >= adsFrom;
    if (span.churned && churnedOnAds) adsChurns++;
    else if (span.churned) noAdsChurns++;

    TENURE_BANDS.forEach((b, i) => {
      const overlap = (from: number, to: number) => Math.max(0, Math.min(to, b.to) - Math.max(from, b.from));
      bands[i].noM += overlap(0, noAds);
      bands[i].adsM += overlap(adsFrom, end);
      if (span.churned && end > b.from && end <= b.to) {
        if (churnedOnAds) bands[i].adsC++;
        else bands[i].noC++;
      }
    });
  }
  const withAdsExp = exposure(adsChurns, adsMonths);
  const withoutAdsExp = exposure(noAdsChurns, noAdsMonths);

  // --- Naive comparison (for contrast in the UI) ---
  const withAds = billed.filter((c) => c.ads.enabled);
  const withoutAds = billed.filter((c) => !c.ads.enabled);
  const churnRate = (cs: ClientFact[]) => ({ clients: cs.length, churned: cs.filter((c) => c.churned).length, rate: pct(cs.filter((c) => c.churned).length, cs.length) });

  // --- Price sensitivity among voluntary churners ---
  const vol = (cs: ClientFact[]) => cs.filter((c) => c.churned && c.billing?.cancelReason !== "payment_failed");
  const sens = (cs: ClientFact[]) => {
    const v = vol(cs);
    const te = v.filter((c) => c.billing?.cancelFeedback === "too_expensive").length;
    return { churned: v.length, tooExpensive: te, share: pct(te, v.length) };
  };

  const attachDelays = withAds
    .filter((c) => c.ads.since && c.billing?.startDate)
    .map((c) => monthsBetween(c.billing!.startDate!, c.ads.since!))
    .sort((a, b) => a - b);

  const totalMrr = active.reduce((s, c) => s + (c.billing?.mrrCents ?? 0), 0);
  const addonMrr = active.reduce((s, c) => s + (c.billing?.adsCents ?? 0), 0);
  const relativeRisk = withAdsExp.monthlyChurn / withoutAdsExp.monthlyChurn;

  const result: AdsResult = {
    attach: {
      active: active.length,
      activeWithAds: active.filter((c) => c.ads.enabled).length,
      rate: pct(active.filter((c) => c.ads.enabled).length, active.length),
      everWithAds: withAds.length,
      medianMonthsToAttach: attachDelays.length ? attachDelays[attachDelays.length >> 1] : null,
      addonMrr: dollars(addonMrr),
      addonShareOfMrr: pct(addonMrr, totalMrr),
    },
    naive: { withAds: churnRate(withAds), withoutAds: churnRate(withoutAds) },
    hazard: { withAds: withAdsExp, withoutAds: withoutAdsExp, relativeRisk },
    byTenure: TENURE_BANDS.map((b, i) => ({
      label: b.label,
      withAds: exposure(bands[i].adsC, bands[i].adsM),
      withoutAds: exposure(bands[i].noC, bands[i].noM),
    })),
    priceSensitivity: { withAds: sens(withAds), withoutAds: sens(withoutAds) },
    verdict: "",
  };
  result.verdict = adsVerdict(result);
  return result;
}

function adsVerdict(r: AdsResult) {
  const { withAds, withoutAds, relativeRisk } = r.hazard;
  const separated = withAds.high < withoutAds.low || withoutAds.high < withAds.low;
  const pctFmt = (x: number) => `${(x * 100).toFixed(1)}%`;
  const churnLine =
    relativeRisk < 1
      ? `Clients churn ${pctFmt(withAds.monthlyChurn)}/month while on ads vs ${pctFmt(withoutAds.monthlyChurn)} without (${Math.round((1 - relativeRisk) * 100)}% lower)`
      : `Clients churn ${pctFmt(withAds.monthlyChurn)}/month while on ads vs ${pctFmt(withoutAds.monthlyChurn)} without (${Math.round((relativeRisk - 1) * 100)}% higher)`;
  const confidence = separated ? "and the gap is larger than the noise." : "but the intervals overlap, so treat it as a lean, not proof.";
  const price = r.priceSensitivity;
  const priceLine =
    price.withAds.churned > 0
      ? ` ${Math.round(price.withAds.share * 100)}% of ads clients who left cited price, vs ${Math.round(price.withoutAds.share * 100)}% of non-ads clients.`
      : "";
  return `${churnLine}, ${confidence}${priceLine}`;
}
