import type { ReactNode } from "react";

export interface LegendItemProps {
  /** Classes that draw the swatch: size, shape and colour (e.g. "h-2.5 w-2.5 rounded-sm bg-series-1"). */
  swatch: string;
  children: ReactNode;
}

export function LegendItem({ swatch, children }: LegendItemProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block shrink-0 ${swatch}`} aria-hidden />
      <span>{children}</span>
    </span>
  );
}
