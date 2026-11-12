import { describe, it, expect } from "vitest";
import { applyOrder, moveId, readOrder, saveOrder, ORDER_KEY } from "../js/order.js";

const apps = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
const ids = (list) => list.map((x) => x.id);

function fakeStorage(initial) {
  const data = initial ? { [ORDER_KEY]: initial } : {};
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
}

describe("applyOrder", () => {
  it("puts saved ids first, in saved order, then the unknown apps in original order", () => {
    expect(ids(applyOrder(apps, ["c", "a"]))).toEqual(["c", "a", "b", "d"]);
  });
  it("ignores saved ids that no longer exist and duplicates", () => {
    expect(ids(applyOrder(apps, ["zzz", "b", "b"]))).toEqual(["b", "a", "c", "d"]);
  });
  it("keeps the original order for empty or invalid saved data", () => {
    expect(ids(applyOrder(apps, []))).toEqual(["a", "b", "c", "d"]);
    expect(ids(applyOrder(apps, null))).toEqual(["a", "b", "c", "d"]);
  });
});

describe("moveId", () => {
  it("moves an id one step right or left and returns its new index", () => {
    expect(moveId(["a", "b", "c"], 0, 1)).toEqual({ ids: ["b", "a", "c"], index: 1 });
    expect(moveId(["a", "b", "c"], 2, -1)).toEqual({ ids: ["a", "c", "b"], index: 1 });
  });
  it("does nothing at the edges and never mutates its input", () => {
    const input = ["a", "b"];
    expect(moveId(input, 0, -1)).toEqual({ ids: ["a", "b"], index: 0 });
    expect(moveId(input, 1, 1)).toEqual({ ids: ["a", "b"], index: 1 });
    moveId(input, 0, 1);
    expect(input).toEqual(["a", "b"]);
  });
});

describe("order storage", () => {
  it("round-trips the order", () => {
    const s = fakeStorage();
    expect(saveOrder(s, ["b", "a"])).toBe(true);
    expect(readOrder(s)).toEqual(["b", "a"]);
  });
  it("reads an empty list for missing, corrupt or non-array data", () => {
    expect(readOrder(fakeStorage())).toEqual([]);
    expect(readOrder(fakeStorage("pas du json"))).toEqual([]);
    expect(readOrder(fakeStorage('{"a":1}'))).toEqual([]);
    expect(readOrder(undefined)).toEqual([]);
  });
  it("keeps only string ids", () => {
    expect(readOrder(fakeStorage('["a", 3, null, "b"]'))).toEqual(["a", "b"]);
  });
  it("never throws when storage fails", () => {
    const broken = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
    expect(readOrder(broken)).toEqual([]);
    expect(saveOrder(broken, ["a"])).toBe(false);
  });
});
