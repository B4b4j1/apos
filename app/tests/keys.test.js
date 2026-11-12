import { describe, it, expect } from "vitest";
import { keyAction } from "../js/keys.js";

describe("keyAction", () => {
  it("maps arrow keys to directions by name or legacy code", () => {
    expect(keyAction({ key: "ArrowLeft", keyCode: 37 })).toEqual({ type: "move", dir: "left" });
    expect(keyAction({ key: "", keyCode: 40 })).toEqual({ type: "move", dir: "down" });
  });
  it("maps OK/Enter to select", () => {
    expect(keyAction({ key: "Enter", keyCode: 13 })).toEqual({ type: "select" });
    expect(keyAction({ key: "", keyCode: 13 })).toEqual({ type: "select" });
  });
  it("maps the webOS Back key, Escape and Backspace to back", () => {
    expect(keyAction({ key: "", keyCode: 461 })).toEqual({ type: "back" });
    expect(keyAction({ key: "Escape", keyCode: 27 })).toEqual({ type: "back" });
    expect(keyAction({ key: "Backspace", keyCode: 8 })).toEqual({ type: "back" });
  });
  it("ignores other keys", () => {
    expect(keyAction({ key: "a", keyCode: 65 })).toBeNull();
  });
});
