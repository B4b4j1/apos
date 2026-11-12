import { describe, it, expect } from "vitest";
import { SETTINGS_KEY, GROUPS, defaults, sanitize, loadSettings, saveSettings } from "../js/settings.js";

function fakeStorage(initial) {
  const data = initial === undefined ? {} : { [SETTINGS_KEY]: initial };
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
}

describe("settings schema", () => {
  it("has a default for every item, and every choice default is a valid choice", () => {
    const d = defaults();
    GROUPS.forEach((g) => g.items.forEach((item) => {
      expect(item.key in d).toBe(true);
      if (item.type === "choice") expect(item.choices.map((c) => c.value)).toContain(d[item.key]);
      if (item.type === "toggle") expect(typeof d[item.key]).toBe("boolean");
    }));
  });
  it("uses unique keys", () => {
    const keys = [];
    GROUPS.forEach((g) => g.items.forEach((i) => keys.push(i.key)));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("sanitize", () => {
  it("keeps valid values and replaces invalid ones by the default", () => {
    const d = defaults();
    const s = sanitize({ clockLayout: "row", tileSize: "gigantic", reduceMotion: "yes", clockSeconds: true });
    expect(s.clockLayout).toBe("row");
    expect(s.tileSize).toBe(d.tileSize);
    expect(s.reduceMotion).toBe(d.reduceMotion);
    expect(s.clockSeconds).toBe(true);
  });
  it("returns the defaults for non-object input and ignores unknown keys", () => {
    expect(sanitize(null)).toEqual(defaults());
    expect(sanitize("x")).toEqual(defaults());
    expect("evil" in sanitize({ evil: 1 })).toBe(false);
  });
});

describe("load and save", () => {
  it("round-trips", () => {
    const s = fakeStorage();
    const value = sanitize({ tileShape: "square" });
    expect(saveSettings(s, value)).toBe(true);
    expect(loadSettings(s).tileShape).toBe("square");
  });
  it("falls back to defaults on missing, corrupt data or broken storage", () => {
    expect(loadSettings(fakeStorage())).toEqual(defaults());
    expect(loadSettings(fakeStorage("pas du json"))).toEqual(defaults());
    expect(loadSettings(undefined)).toEqual(defaults());
    const broken = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
    expect(loadSettings(broken)).toEqual(defaults());
    expect(saveSettings(broken, defaults())).toBe(false);
  });
});
