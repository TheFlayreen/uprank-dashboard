import { money } from "@/lib/format";
import type { HealthRow } from "@/server/metrics/health";
import { ClientMeta } from "./ClientMeta";
import { ContactLink } from "./ContactLink";
import { HealthBadge } from "./HealthBadge";
import { LeadSparkline } from "./LeadSparkline";
import { SignalList } from "./SignalList";

export interface CallListCardProps {
  row: HealthRow;
  rank: number;
}

/** Mobile layout of a call-list entry: who, why, what to do, and a tap-to-email button. */
export function CallListCard({ row: r, rank }: CallListCardProps) {
  return (
    <article className="rounded-xl border border-line p-4" aria-label={`${rank}. ${r.name}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-ink">
            <span className="tabular mr-1.5 text-muted">{rank}</span>
            {r.name}
          </p>
          <ClientMeta row={r} />
        </div>
        <div className="shrink-0 text-right">
          <HealthBadge score={r.score} tier={r.tier} />
          <p className="tabular mt-0.5 text-xs text-ink-2">{money(r.mrr)}/mo</p>
        </div>
      </header>
      <div className="mt-2 text-sm">
        <SignalList signals={r.signals} />
      </div>
      <p className="mt-2 text-sm text-ink">
        <span className="font-medium">Next step:</span> <span className="text-ink-2">{r.action}</span>
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <ContactLink email={r.email} variant="button" />
        <LeadSparkline points={r.leadTrend} />
      </div>
    </article>
  );
}
