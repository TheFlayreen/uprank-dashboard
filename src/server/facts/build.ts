import type {
  Client,
  Customer,
  Invoice,
  LeadMonth,
  Subscription,
  SubscriptionItem,
  SupportTicket,
} from "@/generated/prisma/client";
import type { BillingFacts, ClientFact, ExcludedRecord, FactsResult } from "./types";
import { daysBetween, monthsBetween } from "./time";

export interface RawData {
  referenceDate: Date;
  customers: Customer[];
  subscriptions: (Subscription & { items: SubscriptionItem[] })[];
  invoices: Invoice[];
  clients: Client[];
  leadMonths: LeadMonth[];
  tickets: SupportTicket[];
}

const isAdsItem = (i: SubscriptionItem) => i.productId === "prod_ads_management" || i.priceId.includes("ads");
const isTestCustomer = (c: Customer, sub?: { items: SubscriptionItem[] }) =>
  /internal test/i.test(c.name) ||
  /^test@/i.test(c.email) ||
  !!sub?.items.some((i) => i.priceId.includes("internal_test"));

/**
 * Join product clients with billing. Pure function — all reconciliation rules live here
 * (and are documented in METRICS.md / DATA_NOTES.md).
 */
export function buildClientFacts(raw: RawData): FactsResult {
  const ref = raw.referenceDate;
  const excluded: ExcludedRecord[] = [];

  const customersById = new Map(raw.customers.map((c) => [c.id, c]));
  const subsByCustomer = groupBy(raw.subscriptions, (s) => s.customerId);
  const invoicesByCustomer = groupBy(raw.invoices, (i) => i.customerId);
  const leadsByClient = groupBy(raw.leadMonths, (l) => l.clientId);
  const ticketsByClient = groupBy(raw.tickets, (t) => t.clientId);

  // Billing customers with no product client can't be placed on a per-client dashboard.
  const linkedCustomerIds = new Set(raw.clients.map((c) => c.stripeCustomerId).filter(Boolean));
  for (const c of raw.customers) {
    if (linkedCustomerIds.has(c.id)) continue;
    const subs = subsByCustomer.get(c.id) ?? [];
    const invs = invoicesByCustomer.get(c.id) ?? [];
    const reason = isTestCustomer(c, subs[0])
      ? "Internal test account"
      : invs.every((i) => i.status === "void")
        ? "No product client; only void invoices (abandoned/duplicate signup)"
        : "No matching product client";
    excluded.push({ source: "billing", id: c.id, name: c.name, reason });
  }

  const clients: ClientFact[] = raw.clients.map((c) => {
    const dataIssues: string[] = [];
    const tradeNorm = c.trade?.trim().toLowerCase() || null;
    if (!tradeNorm) dataIssues.push("Trade not set");

    const customer = c.stripeCustomerId ? customersById.get(c.stripeCustomerId) : undefined;
    if (!c.stripeCustomerId) dataIssues.push("No billing link");
    else if (!customer) dataIssues.push(`Billing customer ${c.stripeCustomerId} not found`);

    const billing = customer
      ? buildBilling(customer, subsByCustomer.get(customer.id) ?? [], invoicesByCustomer.get(customer.id) ?? [], ref)
      : null;

    if (billing && billing.subscriptionStatus === null) dataIssues.push("Billing customer has no subscription");

    let lastLoginAt = c.lastLoginAt;
    if (lastLoginAt && lastLoginAt < c.signupAt) {
      dataIssues.push("Last login before signup (ignored)");
      lastLoginAt = null;
    }

    // Billing is the source of truth for the add-on (it's what the client pays for).
    const adsItem = billing ? findAdsItem(raw.subscriptions, billing.subscriptionId) : undefined;
    const ads = billing
      ? { enabled: !!adsItem, since: adsItem?.created ?? null, monthlyBudget: c.adsMonthlyBudget }
      : { enabled: c.adsEnabled, since: c.adsEnabledAt, monthlyBudget: c.adsMonthlyBudget };
    if (billing && ads.enabled !== c.adsEnabled) dataIssues.push("Ads flag differs between product and billing");

    const status = (["onboarding", "live", "cancelled"].includes(c.status) ? c.status : "live") as ClientFact["status"];
    const billingCanceled = billing?.subscriptionStatus === "canceled";
    if (billing && billingCanceled !== (status === "cancelled")) {
      dataIssues.push(`Status mismatch: product ${status}, billing ${billing.subscriptionStatus}`);
    }

    const leads = (leadsByClient.get(c.id) ?? [])
      .map((l) => ({ month: l.month, leads: l.leads }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      id: c.id,
      name: c.businessName,
      trade: tradeNorm ?? "unknown",
      tradeKnown: !!tradeNorm,
      region: c.region,
      status,
      churned: billingCanceled || status === "cancelled",
      billing,
      signupAt: c.signupAt,
      assetsReceivedAt: c.assetsReceivedAt,
      siteApprovedAt: c.siteApprovedAt,
      liveAt: c.liveAt,
      daysToLive: c.liveAt ? daysBetween(c.signupAt, c.liveAt) : null,
      lastLoginAt,
      ads,
      leads,
      tickets: (ticketsByClient.get(c.id) ?? [])
        .map((t) => ({ createdAt: t.createdAt, category: t.category, status: t.status }))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
      dataIssues,
    };
  });

  return { referenceDate: ref, clients, excluded };
}

function buildBilling(
  customer: Customer,
  subs: (Subscription & { items: SubscriptionItem[] })[],
  invoices: Invoice[],
  ref: Date,
): BillingFacts {
  // One subscription per customer in this dataset; if there were more, prefer the live one, then the latest.
  const sub = [...subs].sort((a, b) => rank(a) - rank(b) || b.startDate.getTime() - a.startDate.getTime())[0];

  const planCents = sub?.items.filter((i) => !isAdsItem(i)).reduce((s, i) => s + i.unitAmount * i.quantity, 0) ?? 0;
  const adsCents = sub?.items.filter(isAdsItem).reduce((s, i) => s + i.unitAmount * i.quantity, 0) ?? 0;
  const canceled = sub?.status === "canceled";

  const paid = invoices.filter((i) => i.status === "paid");
  const netRevenueCents = paid.reduce((s, i) => s + i.amountPaid - i.creditNotesAmount, 0);

  const failedOpenInvoices = invoices
    .filter((i) => i.status === "open" && i.attemptCount >= 1)
    .map((i) => ({ created: i.created, attemptCount: i.attemptCount, amountDue: i.amountDue, nextAttempt: i.nextPaymentAttempt }));
  const retried = invoices.filter((i) => i.attemptCount > 1).sort((a, b) => b.created.getTime() - a.created.getTime());

  return {
    customerId: customer.id,
    email: customer.email.trim().toLowerCase(),
    subscriptionId: sub?.id ?? null,
    subscriptionStatus: sub?.status ?? null,
    startDate: sub?.startDate ?? null,
    canceledAt: sub?.canceledAt ?? null,
    cancelReason: sub?.cancelReason ?? null,
    cancelFeedback: sub?.cancelFeedback ?? null,
    planCents,
    adsCents,
    mrrCents: canceled || !sub ? 0 : planCents + adsCents,
    tenureMonths: sub ? monthsBetween(sub.startDate, sub.canceledAt ?? ref) : 0,
    netRevenueCents,
    paidInvoices: paid.length,
    delinquent: customer.delinquent,
    failedOpenInvoices,
    lastPaymentRetryAt: retried[0]?.created ?? null,
  };
}

const rank = (s: Subscription) => (s.status === "canceled" ? 1 : 0);

function findAdsItem(subs: RawData["subscriptions"], subscriptionId: string | null) {
  if (!subscriptionId) return undefined;
  return subs.find((s) => s.id === subscriptionId)?.items.find(isAdsItem);
}

function groupBy<T, K>(items: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}
