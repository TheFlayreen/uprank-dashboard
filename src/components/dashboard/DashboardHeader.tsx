import { dateLabel, dateTimeLabel } from "@/lib/format";
import { RefreshButton } from "./RefreshButton";
import { ThemeToggle } from "./ThemeToggle";

export interface DashboardHeaderProps {
  referenceDate: string;
  syncedAt: string | null;
}

export function DashboardHeader({ referenceDate, syncedAt }: DashboardHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Data as of {dateLabel(referenceDate)}</p>
        <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Client health</h1>
        {syncedAt && <p className="mt-1 text-sm text-muted">Synced {dateTimeLabel(syncedAt)}</p>}
      </div>
      <div className="flex items-start gap-2">
        <ThemeToggle />
        <RefreshButton />
      </div>
    </header>
  );
}
