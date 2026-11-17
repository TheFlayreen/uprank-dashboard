import { describe, expect, it } from "vitest";
import { buildDashboard } from "@/server/buildDashboard";
import { billing, churnedClient, client, d, months, REF } from "@/server/test/fixtures";

describe("briefing", () => {
  const failing = () =>
    client({
      billing: billing({
        subscriptionStatus: "past_due",
        failedOpenInvoices: [{ created: d("2026-10-20"), attemptCount: 2, amountDue: 29700, nextAttempt: d("2026-11-03") }],
      }),
    });

  it("leads with the call list and the earliest payment retry", () => {
    const res = buildDashboard({ referenceDate: REF, clients: [failing(), client(), client()], excluded: [] });
    expect(res.briefing.summary[0].text).toMatch(/^1 client to call this week .*1 failing payment before the 3 Nov retry\.$/);
    expect(res.briefing.actions[0]).toMatchObject({ tone: "critical", title: "1 payment failing" });
    expect(res.briefing.actions[0].detail).toContain("in 2 days");
  });

  it("every summary point links to a section and has no undefined/NaN text", () => {
    const clients = [
      failing(),
      client({ leads: months("2026-04", [10, 10, 10, 10, 10, 10, 3]) }),
      churnedClient("2025-11-01", "2026-09-10"),
      ...Array.from({ length: 6 }, () => client()),
    ];
    const res = buildDashboard({ referenceDate: REF, clients, excluded: [] });
    for (const p of res.briefing.summary) {
      expect(p.href).toMatch(/^#/);
      expect(p.text).not.toMatch(/undefined|NaN/);
    }
  });

  it("has no deadline actions when nothing is failing or stuck", () => {
    const res = buildDashboard({ referenceDate: REF, clients: [client(), client()], excluded: [] });
    expect(res.briefing.actions).toEqual([]);
  });
});
