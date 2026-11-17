// CLI: npm run sync                 → pull live data from both APIs into Postgres
//      npm run sync -- --snapshot   → load data/snapshot/*.json instead (offline fallback)
import "dotenv/config";
import { runSync } from "@/server/sync";
import { prisma } from "@/server/db";

const fromSnapshot = process.argv.includes("--snapshot");

runSync({ source: fromSnapshot ? "snapshot" : "api", saveSnapshot: !fromSnapshot })
  .then((r) => {
    console.log(`✓ sync #${r.runId} from ${r.source} in ${(r.durationMs / 1000).toFixed(1)}s`);
    console.log(`  reference date: ${r.referenceDate.toISOString().slice(0, 10)}`);
    console.table(r.counts);
  })
  .catch((err) => {
    console.error("✗ sync failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
