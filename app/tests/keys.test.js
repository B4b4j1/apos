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
  it("maps the red remote button to reorder", () => {
    expect(keyAction({ key: "", keyCode: 403 })).toEqual({ type: "reorder" });
  });
  it("maps number keys to digits by name, main row code or keypad code", () => {
    expect(keyAction({ key: "7", keyCode: 55 })).toEqual({ type: "digit", digit: "7" });
    expect(keyAction({ key: "", keyCode: 48 })).toEqual({ type: "digit", digit: "0" });
    expect(keyAction({ key: "", keyCode: 99 })).toEqual({ type: "digit", digit: "3" });
  });
  it("ignores other keys", () => {
    expect(keyAction({ key: "a", keyCode: 65 })).toBeNull();
  });
});
