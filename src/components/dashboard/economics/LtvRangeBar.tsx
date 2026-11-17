import { money, moneyShort } from "@/lib/format";

export interface LtvRangeBarProps {
  ltv: number;
  low: number;
  high: number;
  max: number;
  /** Not comparable: draw with the hatch texture instead of the series colour. */
  muted: boolean;
}

/** Point estimate as a bar, with the 95% range as a grey band behind it. */
export function LtvRangeBar({ ltv, low, high, max, muted }: LtvRangeBarProps) {
  const w = (v: number) => (Math.min(v, max) / max) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-3 flex-1" title={`95% range ${money(low)}–${money(high)}`}>
        <div className="absolute inset-y-1 rounded-full bg-axis" style={{ left: `${w(low)}%`, width: `${w(high) - w(low)}%` }} />
        <div className={`absolute left-0 top-[3px] h-1.5 rounded-r ${muted ? "hatch" : "bg-series-1"}`} style={{ width: `${w(ltv)}%` }} />
      </div>
      <span className="tabular w-14 shrink-0 text-right font-medium">{moneyShort(ltv)}</span>
    </div>
  );
}
