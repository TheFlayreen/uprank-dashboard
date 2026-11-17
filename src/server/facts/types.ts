/**
 * One row per product client, with billing joined in.
 * Every metric on the dashboard is computed from ClientFact[] — this is the single
 * place where the two systems are reconciled.
 */
export interface ClientFact {
  id: string;
  name: string;
  /** Normalised trade (lowercase/trimmed); "unknown" when the product has no trade. */
  trade: string;
  tradeKnown: boolean;
  region: string | null;

  /** Product lifecycle status: onboarding | live | cancelled. */
  status: "onboarding" | "live" | "cancelled";
  /** True if the client has left (billing canceled, or product cancelled). */
  churned: boolean;

  billing: BillingFacts | null;

  signupAt: Date;
  assetsReceivedAt: Date | null;
  siteApprovedAt: Date | null;
  liveAt: Date | null;
  daysToLive: number | null;
  /** null when missing or not trustworthy (e.g. before signup). */
  lastLoginAt: Date | null;

  /** Ads add-on per billing when linked, otherwise per product. */
  ads: { enabled: boolean; since: Date | null; monthlyBudget: number | null };

  /** Monthly leads, oldest first, as returned by product (gaps preserved, not zero-filled). */
  leads: { month: string; leads: number }[];
  tickets: { createdAt: Date; category: string; status: string }[];

  dataIssues: string[];
}

export interface BillingFacts {
  customerId: string;
  /** Billing contact email (lower-cased). */
  email: string;
  subscriptionId: string | null;
  subscriptionStatus: string | null; // active | past_due | canceled
  startDate: Date | null;
  canceledAt: Date | null;
  cancelReason: string | null; // cancellation_requested | payment_failed
  cancelFeedback: string | null;
  /** Base plan list price, cents/month. */
  planCents: number;
  /** Ads add-on list price, cents/month (0 if none). */
  adsCents: number;
  /** Current MRR in cents (0 once canceled). */
  mrrCents: number;
  /** Months from subscription start to cancel (or to reference date if still active). */
  tenureMonths: number;
  /** Sum of paid invoices minus post-payment refunds, cents. */
  netRevenueCents: number;
  paidInvoices: number;
  delinquent: boolean;
  /** Open/unpaid invoices that already had at least one failed attempt. */
  failedOpenInvoices: { created: Date; attemptCount: number; amountDue: number; nextAttempt: Date | null }[];
  /** Most recent invoice that needed >1 attempt (paid or not). */
  lastPaymentRetryAt: Date | null;
}

export interface ExcludedRecord {
  source: "billing" | "product";
  id: string;
  name: string;
  reason: string;
}

export interface FactsResult {
  referenceDate: Date;
  clients: ClientFact[];
  excluded: ExcludedRecord[];
}
