import { money } from "@/lib/format";
import type { HealthRow } from "@/server/metrics/health";
import { ClientMeta } from "./ClientMeta";
import { ContactLink } from "./ContactLink";
import { HealthBadge } from "./HealthBadge";
import { LeadSparkline } from "./LeadSparkline";
import { SignalList } from "./SignalList";

export interface CallListRowProps {
  row: HealthRow;
  rank: number;
}

/** Desktop table row. The mobile equivalent is CallListCard. */
export function CallListRow({ row: r, rank }: CallListRowProps) {
  return (
    <tr className="border-b border-grid align-top last:border-b-0">
      <td className="tabular py-3 pr-2 text-muted">{rank}</td>
      <td className="max-w-56 py-3 pr-3">
        <p className="font-medium text-ink">{r.name}</p>
        <ClientMeta row={r} />
        <ContactLink email={r.email} />
      </td>
      <td className="py-3 pr-3">
        <HealthBadge score={r.score} tier={r.tier} />
      </td>
      <td className="py-3 pr-3">
        <SignalList signals={r.signals} />
      </td>
      <td className="py-3 pr-3">
        <LeadSparkline points={r.leadTrend} />
      </td>
      <td className="tabular py-3 pr-3 text-right text-ink">{money(r.mrr)}</td>
      <td className="py-3 text-ink-2">{r.action}</td>
    </tr>
  );
}
