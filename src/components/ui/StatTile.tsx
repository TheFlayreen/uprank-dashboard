import type { ReactNode } from "react";

export interface StatTileProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** "lg" for the top KPI grid (the grid draws the hairlines), "md" for tiles inside a section. */
  size?: "md" | "lg";
  /** Only for values that represent a bad state; always paired with explanatory `sub` text. */
  tone?: "critical";
  className?: string;
}

/** Label / value / context triple. Must be rendered inside a <dl>. */
export function StatTile({ label, value, sub, size = "md", tone, className = "" }: StatTileProps) {
  const lg = size === "lg";
  return (
    <div className={`min-w-0 ${lg ? "bg-page p-4 sm:p-5" : "rounded-lg border border-line p-3"} ${className}`}>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd
        className={`tabular font-semibold tracking-tight ${lg ? "mt-2 text-3xl" : "mt-1 text-xl"} ${tone === "critical" ? "text-critical-ink" : "text-ink"}`}
      >
        {value}
      </dd>
      {sub && <dd className="mt-1.5 text-xs leading-snug text-ink-2">{sub}</dd>}
    </div>
  );
}
