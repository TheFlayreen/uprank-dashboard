"use client";

import { DASHBOARD_SECTION_IDS, DASHBOARD_SECTIONS } from "./dashboardSections";
import { useActiveSection } from "./useActiveSection";

/** Below lg: sticky, horizontally scrolling jump links. On desktop SectionSidebar takes over. */
export function SectionTabs() {
  const active = useActiveSection(DASHBOARD_SECTION_IDS);
  return (
    <nav
      aria-label="Dashboard sections"
      className="sticky top-0 z-30 -mx-4 border-b border-line bg-page/85 px-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:hidden"
    >
      <ul className="-mx-3 flex overflow-x-auto py-1.5 [scrollbar-width:none]">
        {DASHBOARD_SECTIONS.map((s) => {
          const current = s.id === active;
          return (
            <li key={s.id} className="shrink-0">
              <a
                href={`#${s.id}`}
                aria-current={current ? "location" : undefined}
                className={`flex min-h-10 items-center rounded-lg px-3 text-sm font-medium transition-colors duration-200 ${
                  current ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
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
