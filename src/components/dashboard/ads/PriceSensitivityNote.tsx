import { pct } from "@/lib/format";
import type { AdsResult } from "@/server/metrics/ads";

export interface PriceSensitivityNoteProps {
  data: AdsResult["priceSensitivity"];
}

/** Answers "do they leave because of the extra cost?" from cancellation feedback. */
export function PriceSensitivityNote({ data: ps }: PriceSensitivityNoteProps) {
  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <p className="text-sm font-medium text-ink">Do they leave because of the extra cost?</p>
      <p className="mt-1 text-sm text-ink-2">
        Of clients who chose to leave, <b className="text-ink">{pct(ps.withAds.share)}</b> of ads clients said “too expensive” (
        {ps.withAds.tooExpensive} of {ps.withAds.churned}), vs <b className="text-ink">{pct(ps.withoutAds.share)}</b> without ads (
        {ps.withoutAds.tooExpensive} of {ps.withoutAds.churned}).
      </p>
      <p className="mt-1 text-xs text-muted">Fewer ads clients leave, but when they do, price is the reason they give.</p>
    </div>
  );
}
