import { prisma } from "@/server/db";
import { buildClientFacts } from "./build";
import type { FactsResult } from "./types";

export * from "./types";
export { buildClientFacts } from "./build";

/** Load everything from Postgres and build the joined per-client facts. */
export async function loadClientFacts(): Promise<FactsResult> {
  const lastSync = await prisma.syncRun.findFirst({
    where: { status: "success" },
    orderBy: { id: "desc" },
  });
  if (!lastSync?.referenceDate) {
    throw new Error("No successful sync yet — run `npm run sync` first.");
  }

  const [customers, subscriptions, invoices, clients, leadMonths, tickets] = await Promise.all([
    prisma.customer.findMany(),
    prisma.subscription.findMany({ include: { items: true } }),
    prisma.invoice.findMany(),
    prisma.client.findMany({ orderBy: { id: "asc" } }),
    prisma.leadMonth.findMany(),
    prisma.supportTicket.findMany(),
  ]);

  return buildClientFacts({
    referenceDate: lastSync.referenceDate,
    customers,
    subscriptions,
    invoices,
    clients,
    leadMonths,
    tickets,
  });
}
