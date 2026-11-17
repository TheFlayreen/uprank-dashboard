import { describe, expect, it } from "vitest";
import { billing, churnedClient, client, d, REF } from "@/server/test/fixtures";
import { computeRevenueTrend } from "./revenueTrend";

describe("revenue trend", () => {
  it("counts a subscription from its start until it is cancelled", () => {
    const stay = client({ billing: billing({ startDate: d("2026-01-15"), planCents: 30000 }) });
    const left = churnedClient("2026-01-15", "2026-09-10");
    left.billing!.planCents = 20000;
    const t = computeRevenueTrend([stay, left], REF, 12, 3);
    const at = (m: string) => t.points.find((p) => p.month === m)!;
    expect(at("2026-01").mrr).toBe(0); // both start mid-January
    expect(at("2026-02")).toMatchObject({ mrr: 500, activeClients: 2 });
    expect(at("2026-11")).toMatchObject({ mrr: 300, activeClients: 1 });
    expect(t).toMatchObject({ mrrChange: -200, clientChange: -1, comparedTo: "2026-08" });
  });

  it("adds the ads add-on only from the day it was bought", () => {
    const c = client({
      billing: billing({ startDate: d("2026-01-01"), planCents: 30000, adsCents: 15000 }),
      ads: { enabled: true, since: d("2026-06-10"), monthlyBudget: 500 },
    });
    const t = computeRevenueTrend([c], REF);
    expect(t.points.find((p) => p.month === "2026-06")!.mrr).toBe(300);
    expect(t.points.find((p) => p.month === "2026-07")!.mrr).toBe(450);
  });
});
