import { readdirSync, readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const files = readdirSync(new URL("../js/", import.meta.url)).filter(f => f.endsWith(".js"));

describe("webOS-compatible syntax (Chromium ~79-120)", () => {
  it.each(files)("%s avoids import attributes, optional chaining and nullish coalescing", (f) => {
    const src = readFileSync(new URL(`../js/${f}`, import.meta.url), "utf8");
    expect(src).not.toMatch(/with\s*\{\s*type:/);
    expect(src).not.toMatch(/\?\./);
    expect(src).not.toMatch(/\?\?/);
  });
});
