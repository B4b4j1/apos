import { describe, it, expect } from "vitest";
import { tileMetrics } from "../js/metrics.js";

describe("tileMetrics", () => {
  it("returns Lumen-like 236x142 tiles by default and 6 visible tiles", () => {
    const m = tileMetrics({ tileSize: "normal", tileShape: "rounded" });
    expect(m.w).toBe(236);
    expect(m.h).toBe(142);
    expect(m.step).toBe(264);
    expect(m.visible).toBe(6);
    expect(m.radius).toBe(34);
  });
  it("scales with the tile size setting", () => {
    expect(tileMetrics({ tileSize: "small", tileShape: "rounded" }).visible).toBeGreaterThan(6);
    expect(tileMetrics({ tileSize: "large", tileShape: "rounded" }).visible).toBeLessThan(6);
  });
  it("derives the corner radius from the shape", () => {
    expect(tileMetrics({ tileSize: "normal", tileShape: "square" }).radius).toBeLessThan(20);
    expect(tileMetrics({ tileSize: "normal", tileShape: "round" }).radius).toBeGreaterThan(40);
  });
});
