import { describe, it, expect } from "vitest";
import { loadCatalog } from "../js/catalog.js";
import defaults from "../config/default-catalog.json" with { type: "json" };

describe("loadCatalog", () => {
  it("falls back to defaults on malformed JSON, never throws", () => {
    const c = loadCatalog("{ pas du json");
    expect(c.apps.length).toBe(defaults.apps.length);
    expect(c.warnings.length).toBeGreaterThan(0);
  });
  it("falls back to defaults when the input is empty or missing", () => {
    expect(loadCatalog("").apps.length).toBe(defaults.apps.length);
    expect(loadCatalog(undefined).apps.length).toBe(defaults.apps.length);
  });
  it("drops entries with remote URLs and warns", () => {
    const text = JSON.stringify({ apps: [{ id: "x", title: "X", kind: "app", target: "https://evil.test/app" }], media: [] });
    const c = loadCatalog(text);
    expect(c.apps.find(a => a.id === "x")).toBeUndefined();
    expect(c.warnings.join(" ")).toMatch(/distant|remote/i);
  });
  it("keeps valid local entries", () => {
    const text = JSON.stringify({ apps: [{ id: "lecture", title: "Lecture", kind: "app", target: "com.example.reader" }], media: [] });
    expect(loadCatalog(text).apps.map(a => a.id)).toEqual(["lecture"]);
  });
});

describe("loadCatalog edge cases", () => {
  it("never throws on JSON that is not an object", () => {
    expect(() => loadCatalog("null")).not.toThrow();
    expect(loadCatalog("42").apps.length).toBe(defaults.apps.length);
  });
});
