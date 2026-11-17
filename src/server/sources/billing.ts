import { getJson } from "./http";

// Shapes as returned by the Stripe-style billing API (amounts in cents, dates in unix seconds).

export interface BillingCustomer {
  id: string;
  name: string;
  email: string;
  created: number;
  currency: string;
  delinquent: boolean;
}

export interface BillingPrice {
  id: string;
  nickname: string | null;
  product: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string; interval_count: number } | null;
}

export interface BillingSubscription {
  id: string;
  customer: string;
  status: string;
  created: number;
  start_date: number;
  canceled_at: number | null;
  ended_at: number | null;
  cancellation_details: { reason: string | null; feedback: string | null; comment: string | null } | null;
  items: { data: { id: string; created: number; price: BillingPrice; quantity: number }[] };
}

export interface BillingInvoice {
  id: string;
  customer: string;
  subscription: string | null;
  status: string;
  billing_reason: string | null;
  currency: string;
  amount_due: number;
  amount_paid: number;
  post_payment_credit_notes_amount: number | null;
  attempt_count: number;
  created: number;
  period_start: number;
  period_end: number;
  next_payment_attempt: number | null;
  status_transitions: { paid_at: number | null } | null;
}

interface StripeList<T> {
  object: "list";
  has_more: boolean;
  data: T[];
}

export interface BillingData {
  customers: BillingCustomer[];
  subscriptions: BillingSubscription[];
  invoices: BillingInvoice[];
  referenceDate: Date | null;
}

export function createBillingClient(baseUrl: string, apiKey: string) {
  const headers = { Authorization: `Bearer ${apiKey}` };
  let referenceDate: Date | null = null;

  /** Cursor pagination: newest first, follow `starting_after` while `has_more`. */
  async function listAll<T extends { id: string }>(path: string, params: Record<string, string> = {}) {
    const out: T[] = [];
    let after: string | undefined;
    for (;;) {
      const qs = new URLSearchParams({ limit: "100", ...params, ...(after ? { starting_after: after } : {}) });
      const res = await getJson<StripeList<T>>(`${baseUrl}${path}?${qs}`, headers);
      referenceDate ??= res.referenceDate;
      out.push(...res.body.data);
      if (!res.body.has_more || res.body.data.length === 0) return out;
      after = res.body.data[res.body.data.length - 1].id;
    }
  }

  return {
    async fetchAll(): Promise<BillingData> {
      const [customers, subscriptions, invoices] = await Promise.all([
        listAll<BillingCustomer>("/customers"),
        // Like Stripe, canceled subscriptions are hidden unless explicitly requested.
        listAll<BillingSubscription>("/subscriptions", { status: "all" }),
        listAll<BillingInvoice>("/invoices"),
      ]);
      return { customers, subscriptions, invoices, referenceDate };
    },
  };
}
