import { describe, expect, it } from "vitest";
import { billing, client, d, months, REF } from "@/server/test/fixtures";
import { computeEarlyWarning } from "./earlyWarning";
import { leadWarningAt } from "./leadTrend";

describe("lead rule (shared by health score and backtest)", () => {
  it("fires when the last full month is ≥40% below the 3 months before", () => {
    const c = client({ leads: months("2026-03", [10, 10, 10, 10, 12, 12, 12, 5]) }); // Oct 5 vs 12
    expect(leadWarningAt(c, REF)).toMatchObject({ kind: "falling", recent: 5, before: 12 });
  });

  it("only uses months that had finished by the as-of date", () => {
    // Leads collapse in Oct; as of 1 Sep nothing is visible yet.
    const c = client({ leads: months("2026-03", [10, 10, 10, 10, 10, 10, 10, 1]) });
    expect(leadWarningAt(c, d("2026-09-01"))).toBeNull();
    expect(leadWarningAt(c, REF)?.kind).toBe("falling");
  });

  it("ignores small baselines and clients not live yet", () => {
    expect(leadWarningAt(client({ leads: months("2026-05", [2, 2, 2, 1, 0.5]) }), REF)).toBeNull();
    expect(leadWarningAt(client({ liveAt: d("2026-10-05") }), REF)).toBeNull();
  });
});

describe("early-warning backtest", () => {
  // Leads slump in Jun, cancels 20 Jul → flagged at the 1 Jul snapshot.
  const leaver = () =>
    client({
      churned: true,
      status: "cancelled",
      liveAt: d("2025-11-10"),
      leads: months("2025-11", [3, 10, 10, 10, 10, 10, 10, 2, 1]), // Nov … Jun = 2, Jul = 1 (partial)
      billing: billing({ subscriptionStatus: "canceled", startDate: d("2025-11-01"), canceledAt: d("2026-07-20"), mrrCents: 0 }),
    });
  const stayer = () => client({ liveAt: d("2025-11-10"), leads: months("2025-11", [3, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]) });

  it("measures precision vs. the base rate without peeking at the future", () => {
    const res = computeEarlyWarning([leaver(), stayer(), stayer(), stayer()], REF);
    expect(res.flagged.observations).toBeGreaterThan(0);
    expect(res.flagged.rate).toBe(1);
    // 1 May and 1 Jun are within 90 days of the cancellation but the slump wasn't visible yet.
    expect(res.notFlagged.churned).toBe(2);
    expect(res.recall).toMatchObject({ churners: 1, caught: 1 });
    expect(res.recall.medianLeadDays).toBeCloseTo(19, 0); // 1 Jul → 20 Jul
  });

  it("stayers are never counted as churn", () => {
    const res = computeEarlyWarning([stayer(), stayer()], REF);
    expect(res.flagged.churned + res.notFlagged.churned).toBe(0);
  });
});
