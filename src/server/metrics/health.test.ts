import { describe, expect, it } from "vitest";
import { billing, client, d, months, REF } from "@/server/test/fixtures";
import { computeHealth, scoreClient, tierFor, type HealthContext } from "./health";

const ctx: HealthContext = { ref: REF, onboardingP75: 22, onboardingP90: 35 };
const keys = (c: ReturnType<typeof client>) => scoreClient(c, ctx).signals.map((s) => s.key);

describe("health score", () => {
  it("a healthy client has no signals and scores 100", () => {
    const row = scoreClient(client(), ctx);
    expect(row.signals).toEqual([]);
    expect(row.score).toBe(100);
    expect(row.tier).toBe("healthy");
  });

  it("flags a failing payment with amount and next retry", () => {
    const c = client({
      billing: billing({
        subscriptionStatus: "past_due",
        failedOpenInvoices: [{ created: d("2026-10-15"), attemptCount: 3, amountDue: 29700, nextAttempt: d("2026-11-03") }],
      }),
    });
    const row = scoreClient(c, ctx);
    expect(row.signals[0].key).toBe("payment_failed");
    expect(row.signals[0].detail).toContain("$297");
    expect(row.signals[0].detail).toContain("3 Nov");
    expect(row.score).toBe(60);
  });

  it("zero leads in the last two full months beats one month", () => {
    const two = client({ leads: months("2026-04", [10, 10, 10, 10, 10, 0, 0]) });
    const one = client({ leads: months("2026-04", [10, 10, 10, 10, 10, 10, 0]) });
    expect(scoreClient(two, ctx).score).toBeLessThan(scoreClient(one, ctx).score);
    expect(keys(two)).toEqual(["zero_leads"]);
  });

  it("ignores the incomplete reference month and the partial go-live month", () => {
    // Go-live in Sep 2026: Sep is partial (0 leads), Oct is the only full month.
    const c = client({ liveAt: d("2026-09-20"), leads: months("2026-09", [0, 8]) });
    expect(keys(c)).not.toContain("zero_leads");
  });

  it("detects falling leads (≥40% drop vs the 3 months before)", () => {
    const c = client({ leads: months("2026-03", [12, 12, 12, 12, 12, 5, 4, 3]) });
    expect(keys(c)).toContain("falling_leads");
  });

  it("does not call a small wobble a fall", () => {
    const c = client({ leads: months("2026-03", [10, 10, 10, 10, 9, 8, 8, 7]) });
    expect(keys(c)).not.toContain("falling_leads");
  });

  it("treats missing lead months as missing, not zero", () => {
    const c = client({ leads: months("2026-03", [10, 10, 10, 10, 10, 10]) }); // stops at Aug
    expect(keys(c)).toEqual([]);
  });

  it("flags onboarding slower than the historic p90", () => {
    const c = client({ status: "onboarding", signupAt: d("2026-09-01"), liveAt: null, siteApprovedAt: null, leads: [] });
    const row = scoreClient(c, ctx);
    expect(row.signals[0].key).toBe("stuck_onboarding");
    expect(row.signals[0].detail).toContain("site not approved");
  });

  it("flags a support ticket spike", () => {
    const tickets = ["2026-10-10", "2026-10-15", "2026-10-20"].map((x) => ({ createdAt: d(x), category: "leads", status: "open" }));
    expect(keys(client({ tickets }))).toContain("ticket_spike");
  });

  it("flags clients who stopped logging in", () => {
    expect(keys(client({ lastLoginAt: d("2026-08-01") }))).toEqual(["no_login"]);
  });

  it("tiers follow thresholds", () => {
    expect(tierFor(45)).toBe("critical");
    expect(tierFor(60)).toBe("at_risk");
    expect(tierFor(85)).toBe("watch");
    expect(tierFor(95)).toBe("healthy");
  });

  it("call list skips churned clients and sorts worst first, then by MRR", () => {
    const lowMrr = client({ lastLoginAt: d("2026-08-01"), billing: billing({ mrrCents: 29700 }) });
    const highMrr = client({ lastLoginAt: d("2026-08-01"), billing: billing({ mrrCents: 54600 }) });
    const worse = client({ leads: months("2026-04", [10, 10, 10, 10, 10, 0, 0]) });
    const gone = client({ churned: true, status: "cancelled", lastLoginAt: d("2026-01-01") });
    const res = computeHealth([lowMrr, highMrr, worse, gone], REF);
    expect(res.callList.map((r) => r.id)).toEqual([worse.id, highMrr.id, lowMrr.id]);
  });
});
