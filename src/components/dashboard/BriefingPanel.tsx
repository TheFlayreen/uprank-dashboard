import type { Briefing } from "@/server/briefing";
import { ActionItemCard } from "./ActionItemCard";

export interface BriefingPanelProps {
  briefing: Briefing;
}

/** "Read this first": the story in four sentences, plus what has a deadline today. */
export function BriefingPanel({ briefing }: BriefingPanelProps) {
  return (
    <section aria-labelledby="briefing-title" className="grid gap-8 xl:grid-cols-[1.7fr_1fr] xl:gap-12">
      <div>
        <h2 id="briefing-title" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
          This week in one minute
        </h2>
        <ol className="mt-4 divide-y divide-line">
          {briefing.summary.map((p, i) => (
            <li key={p.href} className="flex gap-4 py-3 first:pt-0 last:pb-0">
              <span className="tabular w-5 shrink-0 pt-px text-sm font-medium text-muted">{String(i + 1).padStart(2, "0")}</span>
              <p className="text-[15px] leading-relaxed text-ink">
                {p.text}{" "}
                <a href={p.href} className="whitespace-nowrap font-medium text-accent underline-offset-4 hover:underline">
                  Details →
                </a>
              </p>
            </li>
          ))}
        </ol>
      </div>
      {briefing.actions.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Due now</h3>
          <ul className="mt-4 space-y-3">
            {briefing.actions.map((a) => (
              <li key={a.title}>
                <ActionItemCard item={a} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
