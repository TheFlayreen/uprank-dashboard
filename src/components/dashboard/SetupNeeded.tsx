import { RefreshButton } from "./RefreshButton";

export interface SetupNeededProps {
  message: string;
}

/** Empty state when Postgres is down or nothing has been synced yet. */
export function SetupNeeded({ message }: SetupNeededProps) {
  return (
    <div className="mx-auto max-w-xl rounded-xl border border-line p-6">
      <h1 className="text-lg font-semibold text-ink">No data yet</h1>
      <p className="mt-2 text-sm text-ink-2">{message}</p>
      <p className="mt-4 text-sm text-ink-2">
        Start Postgres and pull the data:{" "}
        <code className="rounded bg-surface-2 px-1">npm run db:up && npm run db:migrate && npm run sync</code>
      </p>
      <div className="mt-4">
        <RefreshButton />
      </div>
    </div>
  );
}
