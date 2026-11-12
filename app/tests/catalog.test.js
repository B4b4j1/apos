import { describe, it, expect } from "vitest";
import { loadCatalog } from "../js/catalog.js";
import { DEFAULT_CATALOG } from "../config/default-catalog.js";

const N = DEFAULT_CATALOG.apps.length;

describe("loadCatalog", () => {
  it("falls back to defaults on malformed JSON, never throws", () => {
    const c = loadCatalog("{ pas du json");
    expect(c.apps.length).toBe(N);
    expect(c.warnings.length).toBeGreaterThan(0);
  });
  it("falls back to defaults when the input is empty or missing", () => {
    expect(loadCatalog("").apps.length).toBe(N);
    expect(loadCatalog(undefined).apps.length).toBe(N);
  });
  it("never throws on JSON that is not an object", () => {
    expect(() => loadCatalog("null")).not.toThrow();
    expect(loadCatalog("42").apps.length).toBe(N);
    expect(loadCatalog("[]").apps.length).toBe(N);
  });
  it("falls back to defaults when an object has no apps array", () => {
    expect(loadCatalog("{}").apps.length).toBe(N);
  });
  it("falls back to defaults when every entry is invalid", () => {
    const text = JSON.stringify({ apps: [{ id: 1 }, "x"], media: [] });
    const c = loadCatalog(text);
    expect(c.apps.length).toBe(N);
    expect(c.warnings.length).toBeGreaterThan(0);
  });
  it("drops entries with remote URLs and warns", () => {
    const text = JSON.stringify({ apps: [{ id: "x", title: "X", kind: "app", target: "https://evil.test/app" }], media: [] });
    const c = loadCatalog(text);
    expect(c.apps.find(a => a.id === "x")).toBeUndefined();
    expect(c.warnings.join(" ")).toMatch(/distant|remote/i);
  });
  it("drops remote targets hidden behind leading spaces or other schemes", () => {
    const text = JSON.stringify({ apps: [
      { id: "a", title: "A", kind: "app", target: "  https://evil.test" },
      { id: "b", title: "B", kind: "app", target: "javascript:alert(1)" },
      { id: "ok", title: "OK", kind: "app", target: "com.example.reader" },
    ], media: [] });
    expect(loadCatalog(text).apps.map(a => a.id)).toEqual(["ok"]);
  });
  it("keeps valid local entries", () => {
    const text = JSON.stringify({ apps: [{ id: "lecture", title: "Lecture", kind: "app", target: "com.example.reader" }], media: [] });
    expect(loadCatalog(text).apps.map(a => a.id)).toEqual(["lecture"]);
  });
});
