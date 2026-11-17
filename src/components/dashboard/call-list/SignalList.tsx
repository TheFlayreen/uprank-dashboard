import { Tooltip } from "@/components/ui/Tooltip";
import type { HealthSignal } from "@/server/metrics/health";

export interface SignalListProps {
  signals: HealthSignal[];
}

/** Why a client is on the list. The score cost is in the tooltip: useful for audit, noise for the caller. */
export function SignalList({ signals }: SignalListProps) {
  return (
    <ul className="space-y-1">
      {signals.map((s) => (
        <li key={s.key} className="leading-snug">
          <Tooltip content={`Costs ${s.points} health points`} className="font-medium text-ink outline-none">
            {s.label}
          </Tooltip>
          <span className="text-ink-2"> — {s.detail}</span>
        </li>
      ))}
    </ul>
  );
}
