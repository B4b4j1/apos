import { describe, it, expect } from "vitest";
import { normalizeApps } from "../js/apps.js";

describe("normalizeApps", () => {
  it("reads launch points and converts local icon paths to file URLs", () => {
    const apps = normalizeApps({ launchPoints: [{ id: "netflix", title: "Netflix", icon: "/mnt/lg/x/icon.png" }] });
    expect(apps).toEqual([{ id: "netflix", title: "Netflix", icon: "file:///mnt/lg/x/icon.png" }]);
  });
  it("reads the apps list shape too", () => {
    const apps = normalizeApps({ apps: [{ id: "a.b", title: "AB", icon: "/usr/palm/a.png", visible: true }] });
    expect(apps.length).toBe(1);
  });
  it("drops invisible apps, hidden ids and our own launcher", () => {
    const apps = normalizeApps({ apps: [
      { id: "x", title: "X", visible: false },
      { id: "com.apos.launcher", title: "ApOS" },
      { id: "com.webos.app.home", title: "Home" },
      { id: "ok", title: "Ok" },
    ] });
    expect(apps.map((a) => a.id)).toEqual(["ok"]);
  });
  it("keeps bundled relative icons under assets/icons only", () => {
    const apps = normalizeApps({ apps: [
      { id: "a", title: "A", icon: "assets/icons/a.png" },
      { id: "b", title: "B", icon: "assets/icons/../../x.png" },
      { id: "c", title: "C", icon: "other/c.png" },
    ] });
    expect(apps.map((e) => e.icon)).toEqual(["assets/icons/a.png", "", ""]);
  });
  it("rejects remote icons and keeps the app without an icon", () => {
    const apps = normalizeApps({ launchPoints: [{ id: "r", title: "R", icon: "https://evil.test/i.png" }] });
    expect(apps).toEqual([{ id: "r", title: "R", icon: "" }]);
  });
  it("uses the id as title when missing, drops entries without id, dedupes", () => {
    const apps = normalizeApps({ launchPoints: [{ id: "a" }, { title: "no id" }, null, { id: "a", title: "dup" }] });
    expect(apps).toEqual([{ id: "a", title: "a", icon: "" }]);
  });
  it("returns an empty list for unusable input", () => {
    expect(normalizeApps(null)).toEqual([]);
    expect(normalizeApps({})).toEqual([]);
    expect(normalizeApps("x")).toEqual([]);
  });
});
