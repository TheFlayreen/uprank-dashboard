/** Navigation targets, in page order. Ids must match the `id` of each Section in Dashboard.tsx. */
export const DASHBOARD_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "call-list", label: "Call list" },
  { id: "early-warning", label: "Early warning" },
  { id: "retention", label: "Retention" },
  { id: "leads", label: "Results by trade" },
  { id: "economics", label: "Best trades" },
  { id: "ads", label: "Ads add-on" },
] as const;

export const DASHBOARD_SECTION_IDS: readonly string[] = DASHBOARD_SECTIONS.map((s) => s.id);
