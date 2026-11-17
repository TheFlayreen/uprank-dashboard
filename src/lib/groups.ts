import type { Confidence } from "@/server/metrics/stats";

/**
 * A group is "comparable" when it's a real trade with enough clients to draw conclusions.
 * "Unknown trade" isn't actionable (you can't target it), so it's always shown muted,
 * like groups that are too small to judge.
 */
export const isComparableGroup = (trade: string, confidence: Confidence) =>
  trade !== "unknown" && confidence !== "insufficient";
