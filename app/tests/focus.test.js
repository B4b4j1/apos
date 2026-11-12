import { describe, it, expect } from "vitest";
import { createFocus } from "../js/focus.js";
import { handleBack } from "../js/back.js";

describe("createFocus", () => {
  it("moves right and stops at the last item", () => {
    const f = createFocus(3, 3);
    f.move("right"); f.move("right"); f.move("right");
    expect(f.index).toBe(2);
  });
  it("moves down by one row of columns", () => {
    const f = createFocus(6, 3);
    f.move("down");
    expect(f.index).toBe(3);
  });
  it("does not move left below zero", () => {
    const f = createFocus(3, 3);
    f.move("left");
    expect(f.index).toBe(0);
  });
  it("handles zero items without error", () => {
    const f = createFocus(0, 3);
    f.move("right");
    expect(f.index).toBe(0);
  });
});

describe("handleBack", () => {
  it("returns pop when a sub-screen is open", () => {
    expect(handleBack(["home", "media"])).toBe("pop");
  });
  it("returns exit at the root, never loops", () => {
    expect(handleBack(["home"])).toBe("exit");
    expect(handleBack([])).toBe("exit");
  });
});
