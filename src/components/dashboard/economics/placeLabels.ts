export interface LabelPoint {
  id: string;
  cx: number;
  cy: number;
  r: number;
  text: string;
}

export interface PlacedLabel {
  id: string;
  x: number;
  y: number;
  anchor: "start" | "end" | "middle";
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const GAP = 5;

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * Greedy collision-avoiding label placement for a scatter plot: for each point, try
 * right → left → above → below and keep the first spot that doesn't cover another dot,
 * another label, or leave the plot. Falls back to "right".
 */
export function placeLabels(points: LabelPoint[], bounds: Box, fontSize = 12): PlacedLabel[] {
  const CHAR_W = fontSize * 0.57; // ≈ average system-ui glyph width
  const LINE_H = fontSize + 2;
  const dots: Box[] = points.map((p) => ({ x0: p.cx - p.r, y0: p.cy - p.r, x1: p.cx + p.r, y1: p.cy + p.r }));
  const taken: Box[] = [];
  const placed: PlacedLabel[] = [];

  // Place the most crowded points first: those with the most neighbours nearby.
  const crowd = (p: LabelPoint) => points.filter((q) => q !== p && Math.hypot(q.cx - p.cx, q.cy - p.cy) < 90).length;
  const order = [...points].sort((a, b) => crowd(b) - crowd(a));

  for (const p of order) {
    const w = p.text.length * CHAR_W;
    const candidates: { label: PlacedLabel; box: Box }[] = [
      { label: { id: p.id, x: p.cx + p.r + GAP, y: p.cy, anchor: "start" }, box: { x0: p.cx + p.r + GAP, y0: p.cy - LINE_H / 2, x1: p.cx + p.r + GAP + w, y1: p.cy + LINE_H / 2 } },
      { label: { id: p.id, x: p.cx - p.r - GAP, y: p.cy, anchor: "end" }, box: { x0: p.cx - p.r - GAP - w, y0: p.cy - LINE_H / 2, x1: p.cx - p.r - GAP, y1: p.cy + LINE_H / 2 } },
      { label: { id: p.id, x: p.cx, y: p.cy - p.r - GAP - LINE_H / 2, anchor: "middle" }, box: { x0: p.cx - w / 2, y0: p.cy - p.r - GAP - LINE_H, x1: p.cx + w / 2, y1: p.cy - p.r - GAP } },
      { label: { id: p.id, x: p.cx, y: p.cy + p.r + GAP + LINE_H / 2, anchor: "middle" }, box: { x0: p.cx - w / 2, y0: p.cy + p.r + GAP, x1: p.cx + w / 2, y1: p.cy + p.r + GAP + LINE_H } },
    ];
    const inBounds = (b: Box) => b.x0 >= bounds.x0 && b.x1 <= bounds.x1 && b.y0 >= bounds.y0 && b.y1 <= bounds.y1;
    const free = candidates.find(({ box }) => inBounds(box) && !dots.some((d) => overlaps(box, d)) && !taken.some((t) => overlaps(box, t)));
    const choice = free ?? candidates[0];
    taken.push(choice.box);
    placed.push(choice.label);
  }
  return placed;
}
