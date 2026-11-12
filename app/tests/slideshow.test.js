import { describe, it, expect } from "vitest";
import { createSlideshow } from "../js/slideshow.js";

const list = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("createSlideshow", () => {
  it("returns null for an empty list", () => {
    expect(createSlideshow([]).next()).toBeNull();
  });
  it("always returns the only entry of a single-item list", () => {
    const s = createSlideshow([{ id: "x" }]);
    expect(s.next().id).toBe("x");
    expect(s.next().id).toBe("x");
  });
  it("shows every entry once per cycle", () => {
    const s = createSlideshow(list, () => 0.3);
    const seen = [s.next().id, s.next().id, s.next().id];
    expect(seen.slice().sort()).toEqual(["a", "b", "c"]);
  });
  it("never repeats the same entry twice in a row across cycles", () => {
    const s = createSlideshow(list, () => 0);
    let previous = null;
    for (let i = 0; i < 20; i++) {
      const id = s.next().id;
      expect(id).not.toBe(previous);
      previous = id;
    }
  });
});
