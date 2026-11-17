export interface TrendDeltaProps {
  value: number;
  format: (absValue: number) => string;
  suffix?: string;
}

/** "▼ $5.5k since 1 Aug": the arrow and the word carry direction, so colour isn't the only signal. */
export function TrendDelta({ value, format, suffix = "" }: TrendDeltaProps) {
  const down = value < 0;
  const flat = value === 0;
  return (
    <span className={down ? "text-critical-ink" : "text-ink-2"}>
      {!flat && (
        <span aria-hidden className="mr-0.5">
          {down ? "▼" : "▲"}
        </span>
      )}
      <span className="sr-only">{flat ? "No change" : down ? "Down" : "Up"}</span>
      {flat ? "no change" : format(Math.abs(value))}
      {suffix}
    </span>
  );
}
