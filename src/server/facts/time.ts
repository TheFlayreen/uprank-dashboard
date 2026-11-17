export const DAY_MS = 86_400_000;
/** Average Gregorian month — used for tenure, where a fractional month is fine. */
export const MONTH_DAYS = 30.4375;

export const daysBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / DAY_MS;
export const monthsBetween = (a: Date, b: Date) => daysBetween(a, b) / MONTH_DAYS;

/** "2026-10" for a Date, in UTC (all source data is UTC). */
export const monthKey = (d: Date) => d.toISOString().slice(0, 7);

/** Shift a "YYYY-MM" key by n months. */
export function addMonths(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

/** Last calendar month that is fully complete before the reference date. */
export const lastFullMonth = (ref: Date) => addMonths(monthKey(ref), -1);
