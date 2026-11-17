import { describe, expect, it } from "vitest";
import { billing, churnedClient, client, d, months, REF } from "@/server/test/fixtures";
import { computeAds } from "./ads";
import { computeEconomics, LIFETIME_CAP_MONTHS } from "./economics";
import { computeLeadsByTrade } from "./leads";
import { computeRetention, kaplanMeier } from "./retention";
import { sampleConfidence } from "./stats";

describe("retention", () => {
  it("Kaplan–Meier accounts for censored (still active) clients", () => {
    // 4 clients: one churns at 2 months, three are still active at 10 months.
    const km = kaplanMeier(
      [
        { months: 2, churned: true },
        { months: 10, churned: false },
        { months: 10, churned: false },
        { months: 10, churned: false },
      ],
      10,
    );
    expect(km[1].survival).toBe(1);
    expect(km[2].survival).toBeCloseTo(0.75);
    expect(km[10].survival).toBeCloseTo(0.75);
  });

  it("puts cancellations into 1–3 / 4–6 / 6+ month buckets", () => {
    const res = computeRetention(
      [
        churnedClient("2026-01-01", "2026-03-01"), // 2 months
        churnedClient("2026-01-01", "2026-06-01"), // 5 months
        churnedClient("2025-01-01", "2026-06-01"), // 17 months
        churnedClient("2025-02-01", "2026-06-01"),
        client(),
      ],
      REF,
    );
    expect(res.timing.map((t) => t.churned)).toEqual([1, 1, 2]);
    expect(res.totals).toMatchObject({ clients: 5, active: 1, churned: 4 });
  });

  it("separates involuntary (payment failed) churn", () => {
    const failed = churnedClient("2026-01-01", "2026-09-01");
    failed.billing!.cancelReason = "payment_failed";
    const res = computeRetention([failed, churnedClient("2026-01-01", "2026-09-01")], REF);
    expect(res.totals.paymentFailed).toBe(1);
    expect(res.totals.voluntary).toBe(1);
  });
});

describe("leads by trade", () => {
  it("excludes the go-live month and keeps each client's weight equal", () => {
    const a = client({ liveAt: d("2026-01-15"), leads: months("2026-01", [1, 10, 10]) }); // avg 10
    const b = client({ liveAt: d("2026-01-15"), leads: months("2026-01", [1, 20, 20, 20, 20, 20, 20, 20]) }); // avg 20
    const res = computeLeadsByTrade([a, b], REF);
    expect(res.byTrade[0].leadsPerClientMonth).toBe(15);
    expect(res.byTrade[0].clientMonths).toBe(9);
  });

  it("marks tiny groups as not trustworthy and keeps unknown trade last", () => {
    const res = computeLeadsByTrade(
      [client({ trade: "landscaper" }), client({ trade: "unknown", tradeKnown: false }), ...Array.from({ length: 6 }, () => client())],
      REF,
    );
    expect(res.byTrade.find((t) => t.trade === "landscaper")?.confidence).toBe("insufficient");
    expect(res.byTrade.at(-1)?.trade).toBe("unknown");
  });

  it("confidence thresholds", () => {
    expect(sampleConfidence(4)).toBe("insufficient");
    expect(sampleConfidence(10)).toBe("low");
    expect(sampleConfidence(20)).toBe("ok");
  });
});

describe("revenue & lifetime value", () => {
  it("LTV = revenue per billed month × (exposure / churns)", () => {
    // 2 clients, 20 client-months total, 1 churn → expected life 20 months.
    const stay = client({ billing: billing({ startDate: d("2025-11-01"), netRevenueCents: 30000 * 12, paidInvoices: 12 }) });
    const left = churnedClient("2026-01-01", "2026-09-01");
    left.billing!.netRevenueCents = 30000 * 8;
    left.billing!.paidInvoices = 8;
    const res = computeEconomics([stay, left], REF);
    const t = res.byTrade[0];
    expect(t.revenuePerClientMonth).toBe(300);
    expect(t.churns).toBe(1);
    expect(t.expectedLifetimeMonths).toBeCloseTo(t.exposureMonths, 5);
    expect(t.ltv).toBeCloseTo(300 * t.exposureMonths, 5);
  });

  it("caps lifetime when nobody has churned", () => {
    const res = computeEconomics([client(), client()], REF);
    expect(res.byTrade[0].expectedLifetimeMonths).toBe(LIFETIME_CAP_MONTHS);
    expect(res.byTrade[0].lifetimeCapped).toBe(true);
  });

  it("refunds reduce revenue (net revenue comes from facts)", () => {
    const c = client({ billing: billing({ netRevenueCents: 29700 * 11, paidInvoices: 12 }) });
    expect(computeEconomics([c], REF).byTrade[0].revenuePerClientMonth).toBeCloseTo(272.25);
  });
});

describe("ads add-on", () => {
  it("splits each client's time into before/after ads and attributes churn to the state at exit", () => {
    // Joined 2026-01-01, added ads 2026-04-01, left 2026-07-01 → churn counts as "on ads".
    const onAds = churnedClient("2026-01-01", "2026-07-01", { ads: { enabled: true, since: d("2026-04-01"), monthlyBudget: 500 } });
    // Never had ads, left after 6 months.
    const noAds = churnedClient("2026-01-01", "2026-07-01");
    const res = computeAds([onAds, noAds], REF);
    expect(res.hazard.withAds.churns).toBe(1);
    expect(res.hazard.withoutAds.churns).toBe(1);
    // ads client contributed ~3 months to each side; the other ~6 months to "without".
    expect(res.hazard.withAds.exposureMonths).toBeCloseTo(3, 0);
    expect(res.hazard.withoutAds.exposureMonths).toBeCloseTo(9, 0);
  });

  it("naive comparison is kept separately for contrast", () => {
    const res = computeAds([client({ ads: { enabled: true, since: d("2026-01-01"), monthlyBudget: 1000 } }), client()], REF);
    expect(res.naive.withAds.clients).toBe(1);
    expect(res.attach.rate).toBe(0.5);
  });
});
