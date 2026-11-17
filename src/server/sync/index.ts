import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/server/db";
import { createBillingClient, type BillingData } from "@/server/sources/billing";
import { createProductClient, type ProductData } from "@/server/sources/product";

const SNAPSHOT_DIR = path.join(process.cwd(), "data", "snapshot");

export interface SyncResult {
  runId: number;
  source: "api" | "snapshot";
  referenceDate: Date;
  counts: Record<string, number>;
  durationMs: number;
}

const unix = (s: number) => new Date(s * 1000);
const unixOrNull = (s: number | null | undefined) => (s ? unix(s) : null);
const isoOrNull = (s: string | null | undefined) => (s ? new Date(s) : null);

/**
 * Full refresh: pull both APIs, then replace all source tables in one transaction.
 * The dataset is small (~3.5k rows), so a full reload is simpler and safer than
 * incremental upserts, and the dashboard never sees a half-synced state.
 */
export async function runSync(opts: { source?: "api" | "snapshot"; saveSnapshot?: boolean } = {}): Promise<SyncResult> {
  const source = opts.source ?? "api";
  const started = Date.now();
  const run = await prisma.syncRun.create({ data: { status: "running", source } });

  try {
    const { billing, product } = source === "api" ? await fetchFromApi() : await readSnapshot();
    if (source === "api" && opts.saveSnapshot) await writeSnapshot(billing, product);

    const referenceDate = billing.referenceDate ?? product.referenceDate;
    if (!referenceDate) throw new Error("API did not return X-Mock-Reference-Date");

    const counts = await persist(billing, product);
    await prisma.syncRun.update({
      where: { id: run.id },
      data: { status: "success", finishedAt: new Date(), referenceDate, counts },
    });
    return { runId: run.id, source, referenceDate, counts, durationMs: Date.now() - started };
  } catch (err) {
    await prisma.syncRun.update({
      where: { id: run.id },
      data: { status: "failed", finishedAt: new Date(), error: String(err) },
    });
    throw err;
  }
}

async function fetchFromApi() {
  const key = process.env.UPRANK_API_KEY;
  const billingUrl = process.env.BILLING_API_URL;
  const productUrl = process.env.PRODUCT_API_URL;
  if (!key || !billingUrl || !productUrl) {
    throw new Error("UPRANK_API_KEY, BILLING_API_URL and PRODUCT_API_URL must be set");
  }
  const [billing, product] = await Promise.all([
    createBillingClient(billingUrl, key).fetchAll(),
    createProductClient(productUrl, key).fetchAll(),
  ]);
  return { billing, product };
}

async function writeSnapshot(billing: BillingData, product: ProductData) {
  await mkdir(SNAPSHOT_DIR, { recursive: true });
  await writeFile(path.join(SNAPSHOT_DIR, "billing.json"), JSON.stringify(billing));
  await writeFile(path.join(SNAPSHOT_DIR, "product.json"), JSON.stringify(product));
}

async function readSnapshot() {
  const read = async <T>(f: string) => JSON.parse(await readFile(path.join(SNAPSHOT_DIR, f), "utf8")) as T;
  const billing = await read<BillingData>("billing.json");
  const product = await read<ProductData>("product.json");
  // JSON turns Dates into strings.
  billing.referenceDate = billing.referenceDate ? new Date(billing.referenceDate) : null;
  product.referenceDate = product.referenceDate ? new Date(product.referenceDate) : null;
  return { billing, product };
}

async function persist(billing: BillingData, product: ProductData) {
  const customerIds = new Set(billing.customers.map((c) => c.id));
  const subscriptionIds = new Set(billing.subscriptions.map((s) => s.id));
  const clientIds = new Set(product.clients.map((c) => c.id));

  // Rows that would violate in-source FKs are counted, not silently lost.
  const subscriptions = billing.subscriptions.filter((s) => customerIds.has(s.customer));
  const invoices = billing.invoices.filter((i) => customerIds.has(i.customer));
  const tickets = product.tickets.filter((t) => clientIds.has(t.client_id));
  const leadRows = Object.entries(product.leads)
    .filter(([clientId]) => clientIds.has(clientId))
    .flatMap(([clientId, months]) => months.map((m) => ({ clientId, month: m.month, leads: m.leads })));

  await prisma.$transaction(
    async (tx) => {
      // Children first.
      await tx.leadMonth.deleteMany();
      await tx.supportTicket.deleteMany();
      await tx.client.deleteMany();
      await tx.invoice.deleteMany();
      await tx.subscriptionItem.deleteMany();
      await tx.subscription.deleteMany();
      await tx.customer.deleteMany();

      await tx.customer.createMany({
        data: billing.customers.map((c) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          created: unix(c.created),
          delinquent: c.delinquent,
        })),
      });

      await tx.subscription.createMany({
        data: subscriptions.map((s) => ({
          id: s.id,
          customerId: s.customer,
          status: s.status,
          created: unix(s.created),
          startDate: unix(s.start_date),
          canceledAt: unixOrNull(s.canceled_at),
          endedAt: unixOrNull(s.ended_at),
          cancelReason: s.cancellation_details?.reason ?? null,
          cancelFeedback: s.cancellation_details?.feedback ?? null,
          cancelComment: s.cancellation_details?.comment ?? null,
        })),
      });

      await tx.subscriptionItem.createMany({
        data: subscriptions.flatMap((s) =>
          s.items.data.map((i) => ({
            id: i.id,
            subscriptionId: s.id,
            priceId: i.price.id,
            priceNickname: i.price.nickname,
            productId: i.price.product,
            unitAmount: i.price.unit_amount,
            quantity: i.quantity,
            interval: i.price.recurring?.interval ?? "month",
            intervalCount: i.price.recurring?.interval_count ?? 1,
            created: unix(i.created),
          })),
        ),
      });

      await tx.invoice.createMany({
        data: invoices.map((i) => ({
          id: i.id,
          customerId: i.customer,
          subscriptionId: i.subscription && subscriptionIds.has(i.subscription) ? i.subscription : null,
          status: i.status,
          billingReason: i.billing_reason,
          amountDue: i.amount_due,
          amountPaid: i.amount_paid,
          creditNotesAmount: i.post_payment_credit_notes_amount ?? 0,
          attemptCount: i.attempt_count,
          created: unix(i.created),
          periodStart: unix(i.period_start),
          periodEnd: unix(i.period_end),
          paidAt: unixOrNull(i.status_transitions?.paid_at),
          nextPaymentAttempt: unixOrNull(i.next_payment_attempt),
        })),
      });

      await tx.client.createMany({
        data: product.clients.map((c) => ({
          id: c.id,
          businessName: c.business_name,
          trade: c.trade,
          region: c.region,
          stripeCustomerId: c.stripe_customer_id,
          status: c.status,
          signupAt: new Date(c.signup_at),
          assetsReceivedAt: isoOrNull(c.onboarding?.assets_received_at),
          siteApprovedAt: isoOrNull(c.onboarding?.site_approved_at),
          liveAt: isoOrNull(c.onboarding?.live_at),
          lastLoginAt: isoOrNull(c.last_login_at),
          adsEnabled: c.ads?.enabled ?? false,
          adsMonthlyBudget: c.ads?.monthly_budget ?? null,
          adsEnabledAt: isoOrNull(c.ads?.enabled_at),
        })),
      });

      await tx.leadMonth.createMany({ data: leadRows });

      await tx.supportTicket.createMany({
        data: tickets.map((t) => ({
          id: t.id,
          clientId: t.client_id,
          createdAt: new Date(t.created_at),
          category: t.category,
          status: t.status,
        })),
      });
    },
    { timeout: 60_000 },
  );

  return {
    customers: billing.customers.length,
    subscriptions: subscriptions.length,
    invoices: invoices.length,
    clients: product.clients.length,
    leadMonths: leadRows.length,
    tickets: tickets.length,
    droppedOrphans:
      billing.subscriptions.length - subscriptions.length +
      (billing.invoices.length - invoices.length) +
      (product.tickets.length - tickets.length),
  };
}
