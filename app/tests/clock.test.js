import { describe, it, expect } from "vitest";
import { formatTime } from "../js/clock.js";

describe("formatTime", () => {
  it("pads hours and minutes", () => {
    expect(formatTime(new Date(2026, 0, 1, 9, 5))).toBe("09:05");
    expect(formatTime(new Date(2026, 0, 1, 23, 59))).toBe("23:59");
  });
});
