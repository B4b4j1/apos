import { describe, it, expect } from "vitest";
import { listMedia } from "../js/media.js";

describe("listMedia", () => {
  it("returns an error instead of throwing when the folder is missing", () => {
    const r = listMedia([{ id: "m", title: "M", kind: "folder", target: "/media/usb/x" }], () => { throw new Error("ENOENT"); });
    expect(r.items).toEqual([]);
    expect(r.error).toMatch(/introuvable|indisponible/i);
  });
  it("lists files from an available folder", () => {
    const r = listMedia([{ id: "m", title: "M", kind: "folder", target: "/media/usb/x" }], () => ["a.mp4", "b.mp4"]);
    expect(r.items.map(i => i.name)).toEqual(["a.mp4", "b.mp4"]);
    expect(r.error).toBeUndefined();
  });
});
