// All amounts are AUD. Formatting is hand-rolled (not Intl) so server and browser render identical text.
const thousands = (n: number) => String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export const money = (x: number | null | undefined) =>
  x == null || !Number.isFinite(x) ? "—" : `${x < 0 ? "−" : ""}$${thousands(x)}`;

export function moneyShort(x: number) {
  if (!Number.isFinite(x)) return "—";
  if (Math.abs(x) >= 1000) return `$${(x / 1000).toFixed(x >= 10000 ? 0 : 1)}k`;
  return money(x);
}

export const pct = (x: number | null | undefined, dp = 0) =>
  x == null || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(dp)}%`;

export const num = (x: number | null | undefined, dp = 1) =>
  x == null || !Number.isFinite(x) ? "—" : x.toFixed(dp);

// Deterministic (not Intl) month names: Node's ICU and browsers abbreviate differently
// ("June" vs "Jun"), which breaks hydration of client components.
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthLabel(key: string, withYear = false) {
  const [y, m] = key.split("-").map(Number);
  return withYear ? `${MONTHS[m - 1]} ${y}` : MONTHS[m - 1];
}

export function dateLabel(iso: string | Date) {
  const dt = new Date(iso);
  return `${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
}

export function dateTimeLabel(iso: string | Date) {
  const dt = new Date(iso);
  const hh = String(dt.getUTCHours()).padStart(2, "0");
  const mm = String(dt.getUTCMinutes()).padStart(2, "0");
  return `${dateLabel(dt)}, ${hh}:${mm} UTC`;
}

export const FEEDBACK_LABELS: Record<string, string> = {
  too_expensive: "Too expensive",
  low_quality: "Low quality",
  unused: "Not using it",
  too_complex: "Too complex",
  switched_service: "Switched provider",
  customer_service: "Customer service",
  missing_features: "Missing features",
  other: "Other",
  no_feedback: "No reason given",
  payment_failed: "Payment failed",
};
export const feedbackLabel = (k: string) => FEEDBACK_LABELS[k] ?? k;
