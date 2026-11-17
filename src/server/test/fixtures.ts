import type { BillingFacts, ClientFact } from "@/server/facts";

export const REF = new Date("2026-11-01T00:00:00Z");
export const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

let seq = 0;

export function billing(overrides: Partial<BillingFacts> = {}): BillingFacts {
  return {
    customerId: `cus_${++seq}`,
    email: `client${seq}@example.com`,
    subscriptionId: `sub_${seq}`,
    subscriptionStatus: "active",
    startDate: d("2025-11-01"),
    canceledAt: null,
    cancelReason: null,
    cancelFeedback: null,
    planCents: 29700,
    adsCents: 0,
    mrrCents: 29700,
    tenureMonths: 12,
    netRevenueCents: 29700 * 12,
    paidInvoices: 12,
    delinquent: false,
    failedOpenInvoices: [],
    lastPaymentRetryAt: null,
    ...overrides,
  };
}

/** A healthy live plumber unless overridden. */
export function client(overrides: Partial<ClientFact> = {}): ClientFact {
  const id = `cl_${++seq}`;
  return {
    id,
    name: `Client ${id}`,
    trade: "plumber",
    tradeKnown: true,
    region: "Sydney",
    status: "live",
    churned: false,
    billing: billing(),
    signupAt: d("2025-11-01"),
    assetsReceivedAt: d("2025-11-03"),
    siteApprovedAt: d("2025-11-10"),
    liveAt: d("2025-11-15"),
    daysToLive: 14,
    lastLoginAt: d("2026-10-25"),
    ads: { enabled: false, since: null, monthlyBudget: null },
    leads: months("2025-11", [3, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]),
    tickets: [],
    dataIssues: [],
    ...overrides,
  };
}

/** Build consecutive lead months starting at `from`. */
export function months(from: string, values: number[]) {
  const [y, m] = from.split("-").map(Number);
  return values.map((leads, i) => {
    const idx = y * 12 + (m - 1) + i;
    return { month: `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`, leads };
  });
}

export function churnedClient(start: string, canceled: string, overrides: Partial<ClientFact> = {}): ClientFact {
  return client({
    status: "cancelled",
    churned: true,
    billing: billing({
      subscriptionStatus: "canceled",
      startDate: d(start),
      canceledAt: d(canceled),
      cancelReason: "cancellation_requested",
      mrrCents: 0,
    }),
    ...overrides,
  });
}
