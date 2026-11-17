import { connection } from "next/server";
import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { getDashboard } from "@/server/dashboard";

/** Request-time data: connection() opts out of prerendering, so the DB is never read at build time. */
async function loadDashboard() {
  await connection();
  return getDashboard();
}

export default function Page() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard data={loadDashboard()} />
      </Suspense>
    </main>
  );
}
