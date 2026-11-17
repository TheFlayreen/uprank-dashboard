import { describe, expect, it } from "vitest";
import { placeLabels } from "./placeLabels";

const bounds = { x0: 0, y0: 0, x1: 400, y1: 300 };

describe("placeLabels", () => {
  it("puts a lone label to the right of its dot", () => {
    const [l] = placeLabels([{ id: "a", cx: 100, cy: 100, r: 6, text: "Plumber" }], bounds);
    expect(l).toMatchObject({ anchor: "start", x: 111, y: 100 });
  });

  it("moves a label off a neighbouring dot", () => {
    // b sits right where a's right-hand label would go.
    const placed = placeLabels(
      [
        { id: "a", cx: 100, cy: 100, r: 6, text: "Builder" },
        { id: "b", cx: 130, cy: 100, r: 6, text: "Painter" },
      ],
      bounds,
    );
    expect(placed.find((p) => p.id === "a")?.anchor).not.toBe("start");
  });

  it("keeps labels inside the plot near the right edge", () => {
    const [l] = placeLabels([{ id: "a", cx: 395, cy: 100, r: 4, text: "Electrician" }], bounds);
    expect(l.anchor).toBe("end");
  });
});
