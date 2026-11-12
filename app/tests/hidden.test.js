import { describe, it, expect } from "vitest";
import { toggleHidden, filterHidden, readHidden, saveHidden, HIDDEN_KEY } from "../js/hidden.js";

function fakeStorage(initial) {
  const data = initial === undefined ? {} : { [HIDDEN_KEY]: initial };
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
}

describe("hidden apps", () => {
  it("toggles an id on and off without mutating the input", () => {
    const input = ["a"];
    expect(toggleHidden(input, "b")).toEqual(["a", "b"]);
    expect(toggleHidden(["a", "b"], "a")).toEqual(["b"]);
    expect(input).toEqual(["a"]);
  });
  it("filters hidden apps out", () => {
    expect(filterHidden([{ id: "a" }, { id: "b" }], ["b"]).map((x) => x.id)).toEqual(["a"]);
  });
  it("round-trips and tolerates corrupt data", () => {
    const s = fakeStorage();
    expect(saveHidden(s, ["x"])).toBe(true);
    expect(readHidden(s)).toEqual(["x"]);
    expect(readHidden(fakeStorage("pas du json"))).toEqual([]);
    expect(readHidden(fakeStorage('["a", 2]'))).toEqual(["a"]);
    expect(readHidden(undefined)).toEqual([]);
  });
});
