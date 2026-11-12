import { describe, it, expect } from "vitest";
import { updateSummary, installErrorMessage } from "../js/update.js";

describe("updateSummary", () => {
  it("says never checked when there is no result", () => {
    expect(updateSummary(null)).toEqual({ value: "Jamais vérifié", available: false });
  });
  it("announces a newer version", () => {
    expect(updateSummary({ current: "0.2.0", latest: "0.3.0", available: true, error: "" })).toEqual({ value: "Version 0.3.0 disponible", available: true });
  });
  it("says up to date", () => {
    expect(updateSummary({ current: "0.3.0", latest: "0.3.0", available: false, error: "" }).value).toBe("À jour");
  });
  it("reports errors without offering an install", () => {
    expect(updateSummary({ current: "0.2.0", latest: "", available: false, error: "dépôt injoignable" })).toEqual({ value: "Dépôt injoignable", available: false });
    expect(updateSummary({ current: "", latest: "", available: false, error: "index invalide" }).available).toBe(false);
  });
});

describe("installErrorMessage", () => {
  it("maps statuses to messages", () => {
    expect(installErrorMessage(0)).toBe("Service injoignable.");
    expect(installErrorMessage(400)).toContain("réessayez");
    expect(installErrorMessage(500)).toBe("Échec de l'installation.");
  });
});
