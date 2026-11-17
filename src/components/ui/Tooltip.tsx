import type { ReactNode } from "react";

export interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  className?: string;
}

/** CSS-only hover/focus tooltip (no JS), so it works inside Server Components. */
export function Tooltip({ children, content, className = "" }: TooltipProps) {
  return (
    <span className={`group relative ${className}`} tabIndex={0}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-max max-w-64 -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-xs leading-snug text-page shadow-sm group-hover:block group-focus:block"
      >
        {content}
      </span>
    </span>
  );
}
