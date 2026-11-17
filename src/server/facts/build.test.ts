import { describe, expect, it } from "vitest";
import type { Client, Customer, Invoice, Subscription, SubscriptionItem } from "@/generated/prisma/client";
import { d, REF } from "@/server/test/fixtures";
import { buildClientFacts, type RawData } from "./build";

const customer = (id: string, o: Partial<Customer> = {}): Customer => ({
  id, name: id, email: `${id}@example.com`, created: d("2025-06-01"), delinquent: false, ...o,
});
const item = (subId: string, priceId: string, amount: number, created = d("2025-06-01")): SubscriptionItem => ({
  id: `si_${subId}_${priceId}`, subscriptionId: subId, priceId, priceNickname: null,
  productId: priceId.includes("ads") ? "prod_ads_management" : "prod_growth_plan",
  unitAmount: amount, quantity: 1, interval: "month", intervalCount: 1, created,
});
const sub = (id: string, customerId: string, items: SubscriptionItem[], o: Partial<Subscription> = {}) => ({
  id, customerId, status: "active", created: d("2025-06-01"), startDate: d("2025-06-01"), canceledAt: null, endedAt: null,
  cancelReason: null, cancelFeedback: null, cancelComment: null, items, ...o,
});
const invoice = (id: string, customerId: string, o: Partial<Invoice> = {}): Invoice => ({
  id, customerId, subscriptionId: null, status: "paid", billingReason: "subscription_cycle", amountDue: 29700, amountPaid: 29700,
  creditNotesAmount: 0, attemptCount: 1, created: d("2025-07-01"), periodStart: d("2025-07-01"), periodEnd: d("2025-08-01"),
  paidAt: d("2025-07-01"), nextPaymentAttempt: null, ...o,
});
const productClient = (id: string, o: Partial<Client> = {}): Client => ({
  id, businessName: id, trade: "plumber", region: "Sydney", stripeCustomerId: null, status: "live",
  signupAt: d("2025-06-01"), assetsReceivedAt: d("2025-06-03"), siteApprovedAt: d("2025-06-08"), liveAt: d("2025-06-12"),
  lastLoginAt: d("2026-10-20"), adsEnabled: false, adsMonthlyBudget: null, adsEnabledAt: null, ...o,
});

function raw(o: Partial<RawData>): RawData {
  return { referenceDate: REF, customers: [], subscriptions: [], invoices: [], clients: [], leadMonths: [], tickets: [], ...o };
}

describe("buildClientFacts", () => {
  it("joins billing to product and computes MRR incl. the ads add-on", () => {
    const res = buildClientFacts(raw({
      customers: [customer("cus_a")],
      subscriptions: [sub("sub_a", "cus_a", [item("sub_a", "price_growth_plumber", 29700), item("sub_a", "price_ads_management", 14900, d("2025-08-01"))])],
      clients: [productClient("cl_a", { stripeCustomerId: "cus_a", adsEnabled: true })],
    }));
    const c = res.clients[0];
    expect(c.billing?.mrrCents).toBe(44600);
    expect(c.ads).toMatchObject({ enabled: true, since: d("2025-08-01") });
    expect(c.dataIssues).toEqual([]);
  });

  it("normalises trade and buckets null as 'unknown'", () => {
    const res = buildClientFacts(raw({
      clients: [productClient("cl_a", { trade: " Plumber " }), productClient("cl_b", { trade: null })],
    }));
    expect(res.clients.map((c) => c.trade)).toEqual(["plumber", "unknown"]);
    expect(res.clients[1].dataIssues).toContain("Trade not set");
  });

  it("keeps a client whose billing link is broken, without billing", () => {
    const res = buildClientFacts(raw({ clients: [productClient("cl_a", { stripeCustomerId: "cus_missing" })] }));
    expect(res.clients[0].billing).toBeNull();
    expect(res.clients[0].dataIssues[0]).toMatch(/not found/);
  });

  it("excludes billing-only customers with a reason (test account, abandoned signup)", () => {
    const res = buildClientFacts(raw({
      customers: [customer("cus_test", { name: "Internal Test Account", email: "test@example.com" }), customer("cus_dup")],
      invoices: [invoice("in_1", "cus_dup", { status: "void", amountPaid: 0 })],
    }));
    expect(res.excluded.map((e) => e.reason)).toEqual([
      "Internal test account",
      "No product client; only void invoices (abandoned/duplicate signup)",
    ]);
  });

  it("net revenue subtracts post-payment refunds and ignores unpaid invoices", () => {
    const res = buildClientFacts(raw({
      customers: [customer("cus_a")],
      subscriptions: [sub("sub_a", "cus_a", [item("sub_a", "price_growth_plumber", 29700)])],
      invoices: [
        invoice("in_1", "cus_a"),
        invoice("in_2", "cus_a", { creditNotesAmount: 29700 }),
        invoice("in_3", "cus_a", { status: "uncollectible", amountPaid: 0, attemptCount: 4 }),
      ],
      clients: [productClient("cl_a", { stripeCustomerId: "cus_a" })],
    }));
    expect(res.clients[0].billing?.netRevenueCents).toBe(29700);
    expect(res.clients[0].billing?.paidInvoices).toBe(2);
  });

  it("ignores a last login that predates signup", () => {
    const res = buildClientFacts(raw({ clients: [productClient("cl_a", { lastLoginAt: d("2025-05-01") })] }));
    expect(res.clients[0].lastLoginAt).toBeNull();
    expect(res.clients[0].dataIssues).toContain("Last login before signup (ignored)");
  });

  it("canceled billing marks the client as churned with zero MRR", () => {
    const res = buildClientFacts(raw({
      customers: [customer("cus_a")],
      subscriptions: [sub("sub_a", "cus_a", [item("sub_a", "price_growth_plumber", 29700)], { status: "canceled", canceledAt: d("2026-03-01") })],
      clients: [productClient("cl_a", { stripeCustomerId: "cus_a", status: "cancelled" })],
    }));
    expect(res.clients[0].churned).toBe(true);
    expect(res.clients[0].billing?.mrrCents).toBe(0);
  });
});
