"use client";

import type { ThemeChoice } from "@/lib/theme";
import { useTheme } from "./useTheme";

// Lucide-style 24px stroke icons, inlined so there's no icon dependency.
const OPTIONS: { value: ThemeChoice; label: string; path: string }[] = [
  {
    value: "system",
    label: "Use system theme",
    path: "M4 5h16v11H4zM8 20h8M12 16v4",
  },
  {
    value: "light",
    label: "Light theme",
    path: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  },
  {
    value: "dark",
    label: "Dark theme",
    path: "M20.4 14.5A8.5 8.5 0 0 1 9.5 3.6 8.5 8.5 0 1 0 20.4 14.5z",
  },
];

/** Three-way segmented control: System / Light / Dark. */
export function ThemeToggle() {
  const [choice, setChoice] = useTheme();
  return (
    <div role="group" aria-label="Colour theme" className="inline-flex h-10 items-center gap-0.5 rounded-lg border border-line p-0.5">
      {OPTIONS.map((o) => {
        const active = choice === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            aria-label={o.label}
            title={o.label}
            onClick={() => setChoice(o.value)}
            className={`grid h-full w-9 cursor-pointer place-items-center rounded-md transition-colors duration-200 ${
              active ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"
            }`}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={o.path} />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
