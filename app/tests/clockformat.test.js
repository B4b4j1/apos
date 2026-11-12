import { describe, it, expect } from "vitest";
import { formatClock } from "../js/clock.js";

const d = new Date(2026, 9, 24, 17, 5, 9); // samedi 24 octobre 2026, 17:05:09
const base = { clockLayout: "row", clockFormat: "24h", clockDate: true, clockSeconds: false };

describe("formatClock", () => {
  it("formats 24 h time with optional seconds", () => {
    expect(formatClock(d, base).time).toBe("17:05");
    expect(formatClock(d, { ...base, clockSeconds: true }).time).toBe("17:05:09");
  });
  it("formats 12 h time with AM/PM and no leading zero", () => {
    expect(formatClock(d, { ...base, clockFormat: "12h" }).time).toBe("5:05 PM");
    expect(formatClock(new Date(2026, 0, 1, 0, 7), { ...base, clockFormat: "12h" }).time).toBe("12:07 AM");
    expect(formatClock(new Date(2026, 0, 1, 12, 0), { ...base, clockFormat: "12h" }).time).toBe("12:00 PM");
  });
  it("uses a short French date in one row and a long one when stacked", () => {
    expect(formatClock(d, base).date).toBe("sam. 24 oct.");
    expect(formatClock(d, { ...base, clockLayout: "stacked" }).date).toBe("samedi 24 octobre");
  });
  it("returns an empty date when the date is hidden", () => {
    expect(formatClock(d, { ...base, clockDate: false }).date).toBe("");
  });
});
