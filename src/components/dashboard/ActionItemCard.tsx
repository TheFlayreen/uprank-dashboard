import type { ActionItem } from "@/server/briefing";

export interface ActionItemCardProps {
  item: ActionItem;
}

/** A deadline-type item. The status dot is always paired with a visible "Critical"/"Warning" label. */
export function ActionItemCard({ item: a }: ActionItemCardProps) {
  const critical = a.tone === "critical";
  return (
    <a
      href={a.href}
      className="group block rounded-xl border border-line p-4 transition-colors duration-200 hover:bg-surface-2"
    >
      <p className={`flex items-center gap-1.5 text-xs font-semibold ${critical ? "text-critical-ink" : "text-ink-2"}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${critical ? "bg-critical" : "bg-warning"}`} aria-hidden />
        {critical ? "Critical" : "Warning"}
      </p>
      <p className="mt-2 text-sm font-semibold text-ink">
        {a.title} <span className="text-muted transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden>→</span>
      </p>
      <p className="mt-1 text-sm leading-relaxed text-ink-2">{a.detail}</p>
    </a>
  );
}
