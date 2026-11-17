export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : NaN);

export function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function quantile(xs: number[], q: number): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1));
}

// Two-sided 95% Student-t critical values, df 1..30; normal approximation beyond.
const T95 = [
  12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12,
  2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042,
];
export const tCritical95 = (df: number) => (df < 1 ? NaN : df <= 30 ? T95[df - 1] : 1.96);

/** Mean with a 95% t-interval. With n < 2 the interval is undefined (NaN). */
export function meanCI(xs: number[]) {
  const m = mean(xs);
  const half = tCritical95(xs.length - 1) * (stdev(xs) / Math.sqrt(xs.length));
  return { mean: m, low: m - half, high: m + half, n: xs.length };
}

/**
 * 95% interval for a Poisson rate (events / exposure), using the Wilson-Hilferty
 * approximation for the count — good enough for small counts and never negative.
 */
export function poissonRateCI(events: number, exposure: number) {
  if (exposure <= 0) return { rate: NaN, low: NaN, high: NaN };
  const z = 1.96;
  const lowCount = events === 0 ? 0 : events * (1 - 1 / (9 * events) - z / (3 * Math.sqrt(events))) ** 3;
  const e1 = events + 1;
  const highCount = e1 * (1 - 1 / (9 * e1) + z / (3 * Math.sqrt(e1))) ** 3;
  return { rate: events / exposure, low: lowCount / exposure, high: highCount / exposure };
}

export type Confidence = "ok" | "low" | "insufficient";

/** Shared rule for "can we trust this group?" — used for every by-trade comparison. */
export function sampleConfidence(n: number): Confidence {
  if (n < 5) return "insufficient";
  if (n < 15) return "low";
  return "ok";
}

export const round = (x: number, dp = 1) => (Number.isFinite(x) ? Math.round(x * 10 ** dp) / 10 ** dp : null);
export const pct = (num: number, den: number) => (den ? num / den : NaN);
