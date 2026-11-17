"use client";

import { DASHBOARD_SECTION_IDS, DASHBOARD_SECTIONS } from "./dashboardSections";
import { useActiveSection } from "./useActiveSection";

/** Desktop (lg+) table of contents for the one-page dashboard; highlights the section in view. */
export function SectionSidebar() {
  const active = useActiveSection(DASHBOARD_SECTION_IDS);
  return (
    <nav aria-label="Dashboard sections" className="sticky top-8">
      <p className="px-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted">On this page</p>
      <ul className="mt-3 space-y-0.5 border-l border-line">
        {DASHBOARD_SECTIONS.map((s) => {
          const current = s.id === active;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={current ? "location" : undefined}
                className={`-ml-px flex min-h-9 items-center border-l-2 px-3 text-sm transition-colors duration-200 ${
                  current ? "border-ink font-medium text-ink" : "border-transparent text-ink-2 hover:border-axis hover:text-ink"
                }`}
              >
                {s.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
