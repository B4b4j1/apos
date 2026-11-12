import { describe, it, expect } from "vitest";
import { createGrid } from "../js/grid.js";

describe("createGrid", () => {
  it("starts on the first row and column", () => {
    expect(createGrid([3, 2]).position).toEqual({ row: 0, col: 0 });
  });
  it("moves left and right inside a row, clamped", () => {
    const g = createGrid([3]);
    g.move("left");
    expect(g.position.col).toBe(0);
    g.move("right"); g.move("right"); g.move("right");
    expect(g.position.col).toBe(2);
  });
  it("moves between rows and clamps the column to the row length", () => {
    const g = createGrid([5, 2]);
    for (let i = 0; i < 4; i++) g.move("right");
    g.move("down");
    expect(g.position).toEqual({ row: 1, col: 1 });
    g.move("up");
    expect(g.position.row).toBe(0);
  });
  it("skips empty rows and never lands on one", () => {
    const g = createGrid([2, 0, 3]);
    g.move("down");
    expect(g.position.row).toBe(2);
    g.move("up");
    expect(g.position.row).toBe(0);
  });
  it("stays put with no rows or only empty rows", () => {
    expect(createGrid([]).move("down")).toEqual({ row: 0, col: 0 });
    expect(createGrid([0, 0]).move("right")).toEqual({ row: 0, col: 0 });
  });
  it("re-clamps when row lengths change", () => {
    const g = createGrid([5]);
    for (let i = 0; i < 4; i++) g.move("right");
    g.setLengths([2]);
    expect(g.position).toEqual({ row: 0, col: 1 });
  });
  it("sets an explicit position, clamped to the grid", () => {
    const g = createGrid([3, 2]);
    g.setPosition(1, 5);
    expect(g.position).toEqual({ row: 1, col: 1 });
    g.setPosition(9, 0);
    expect(g.position.row).toBe(0);
  });
});
