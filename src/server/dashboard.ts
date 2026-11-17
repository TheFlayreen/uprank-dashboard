import { prisma } from "@/server/db";
import { loadClientFacts } from "@/server/facts";
import { buildDashboard } from "@/server/buildDashboard";

export type Dashboard = ReturnType<typeof buildDashboard> & {
  lastSync: { finishedAt: string | null; source: string } | null;
};

/** I/O wrapper: load the latest synced facts and build the dashboard payload. */
export async function getDashboard(): Promise<Dashboard> {
  const [facts, lastSync] = await Promise.all([
    loadClientFacts(),
    prisma.syncRun.findFirst({ where: { status: "success" }, orderBy: { id: "desc" } }),
  ]);
  return {
    ...buildDashboard(facts),
    lastSync: lastSync ? { finishedAt: lastSync.finishedAt?.toISOString() ?? null, source: lastSync.source } : null,
  };
}
