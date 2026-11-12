import { describe, it, expect } from "vitest";
import { validWallpapers, pickWallpaper, readChoice, saveChoice, WALLPAPER_STORAGE_KEY } from "../js/wallpaper.js";

function fakeStorage() {
  const data = {};
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

describe("validWallpapers", () => {
  it("keeps local wallpapers with a valid id, title and src", () => {
    const { wallpapers, warnings } = validWallpapers([
      { id: "foret", title: "Forêt", src: "assets/wallpapers/foret.jpg" },
      { id: "mer", title: "Mer", src: "assets/wallpapers/mer.PNG" },
    ]);
    expect(wallpapers.map((w) => w.id)).toEqual(["foret", "mer"]);
    expect(warnings).toEqual([]);
  });

  it("drops remote, absolute, traversal and wrong-extension sources with a warning", () => {
    const { wallpapers, warnings } = validWallpapers([
      { id: "a", title: "A", src: "https://example.test/a.jpg" },
      { id: "b", title: "B", src: "/etc/b.jpg" },
      { id: "c", title: "C", src: "assets/wallpapers/../c.jpg" },
      { id: "d", title: "D", src: "assets/wallpapers/d.gif" },
      { id: "e", title: "E", src: "assets/wallpapers/sub/e.jpg" },
      { id: "f", title: "F", src: "javascript:alert(1)" },
    ]);
    expect(wallpapers).toEqual([]);
    expect(warnings.length).toBe(6);
  });

  it("drops entries missing fields or not objects", () => {
    const { wallpapers, warnings } = validWallpapers([null, "x", { id: 1, title: "T", src: "assets/wallpapers/t.jpg" }]);
    expect(wallpapers).toEqual([]);
    expect(warnings.length).toBe(3);
  });

  it("returns an empty list for non-array input", () => {
    expect(validWallpapers(undefined).wallpapers).toEqual([]);
    expect(validWallpapers({}).wallpapers).toEqual([]);
  });
});

describe("pickWallpaper", () => {
  const list = [{ id: "foret", title: "Forêt", src: "assets/wallpapers/foret.jpg" }];
  it("finds a wallpaper by id", () => {
    expect(pickWallpaper(list, "foret")).toBe(list[0]);
  });
  it("returns null for unknown, empty or missing ids", () => {
    expect(pickWallpaper(list, "inconnu")).toBeNull();
    expect(pickWallpaper(list, "")).toBeNull();
    expect(pickWallpaper(list, null)).toBeNull();
  });
});

describe("wallpaper choice storage", () => {
  it("round-trips the chosen id", () => {
    const s = fakeStorage();
    expect(saveChoice(s, "foret")).toBe(true);
    expect(s.getItem(WALLPAPER_STORAGE_KEY)).toBe("foret");
    expect(readChoice(s)).toBe("foret");
  });
  it("reads null when nothing was saved or no storage exists", () => {
    expect(readChoice(fakeStorage())).toBeNull();
    expect(readChoice(undefined)).toBeNull();
  });
  it("never throws when storage is unavailable", () => {
    const broken = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
    expect(readChoice(broken)).toBeNull();
    expect(saveChoice(broken, "foret")).toBe(false);
    expect(saveChoice(undefined, "foret")).toBe(false);
  });
});
