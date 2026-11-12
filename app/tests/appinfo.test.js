import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const info = JSON.parse(readFileSync(new URL("../appinfo.json", import.meta.url)));

describe("appinfo.json", () => {
  it("declares a web app with the expected id and entry point", () => {
    expect(info.id).toBe("com.apos.launcher");
    expect(info.type).toBe("web");
    expect(info.main).toBe("index.html");
  });
  it("declares no network permission beyond local", () => {
    expect(info.requiredPermissions ?? []).not.toContain("network.external");
  });
  it("receives the Back key itself instead of leaving the app", () => {
    expect(info.disableBackHistoryAPI).toBe(true);
  });
});
