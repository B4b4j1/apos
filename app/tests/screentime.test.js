import { describe, it, expect } from "vitest";
import { parseRaw, parseSummary, mergeUsage, totalSeconds, sortedUsage, formatDuration, appTitle, dayKey, loadDay, loadRange } from "../js/screentime.js";

describe("parsing", () => {
  it("counts raw log lines per app and converts them to seconds", () => {
    const text = "10:00:00 netflix\n10:00:10 netflix\n10:00:20 youtube.leanback.v4\n";
    expect(parseRaw(text, 10)).toEqual({ netflix: 20, "youtube.leanback.v4": 10 });
  });
  it("ignores malformed raw lines and unsafe ids", () => {
    expect(parseRaw("garbage\n10:00:00\n10:00:10 bad id!\n10:00:20 ok.app\n\n", 10)).toEqual({ "ok.app": 10 });
  });
  it("reads a tab-separated summary and ignores bad rows", () => {
    expect(parseSummary("netflix\t120\nyoutube\t30\nbad\tx\n\nonlyid\n")).toEqual({ netflix: 120, youtube: 30 });
  });
  it("returns empty usage for null or empty input", () => {
    expect(parseRaw(null, 10)).toEqual({});
    expect(parseSummary("")).toEqual({});
  });
});

describe("aggregation", () => {
  it("merges usage maps and totals them", () => {
    const merged = mergeUsage([{ a: 10, b: 5 }, { a: 20 }]);
    expect(merged).toEqual({ a: 30, b: 5 });
    expect(totalSeconds(merged)).toBe(35);
  });
  it("sorts by seconds descending and drops zero entries", () => {
    expect(sortedUsage({ a: 10, b: 50, c: 0 })).toEqual([{ id: "b", seconds: 50 }, { id: "a", seconds: 10 }]);
  });
});

describe("formatDuration", () => {
  it("formats seconds, minutes and hours", () => {
    expect(formatDuration(0)).toBe("0 min");
    expect(formatDuration(45)).toBe("< 1 min");
    expect(formatDuration(60)).toBe("1 min");
    expect(formatDuration(59 * 60)).toBe("59 min");
    expect(formatDuration(3600)).toBe("1 h 00 min");
    expect(formatDuration(3600 + 5 * 60 + 30)).toBe("1 h 05 min");
    expect(formatDuration(5 * 3600 + 25 * 60)).toBe("5 h 25 min");
  });
});

describe("appTitle", () => {
  it("prefers the known title, then friendly names for system ids, then the id", () => {
    expect(appTitle("netflix", { netflix: "Netflix" })).toBe("Netflix");
    expect(appTitle("com.apos.launcher", {})).toBe("ApOS (accueil)");
    expect(appTitle("com.webos.app.hdmi2", {})).toBe("HDMI 2");
    expect(appTitle("com.webos.app.livetv", {})).toBe("TV en direct");
    expect(appTitle("some.unknown.app", {})).toBe("some.unknown.app");
  });
});

describe("dayKey", () => {
  it("formats the local date as YYYY-MM-DD", () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("loading", () => {
  const files = {
    "data/usage-2026-11-12.log": "10:00:00 a\n10:00:10 a\n",
    "data/usage-2026-11-11.tsv": "a\t100\nb\t50\n",
    "data/usage-2026-11-10.log": "09:00:00 c\n",
  };
  const fetchText = (url) => Promise.resolve(url in files ? files[url] : null);
  const today = new Date(2026, 10, 12, 12, 0);

  it("reads today from the raw log and past days from summaries", async () => {
    expect(await loadDay(fetchText, today, 0, 10)).toEqual({ a: 20 });
    expect(await loadDay(fetchText, today, 1, 10)).toEqual({ a: 100, b: 50 });
  });
  it("falls back to the raw log for a past day without summary", async () => {
    expect(await loadDay(fetchText, today, 2, 10)).toEqual({ c: 10 });
  });
  it("returns empty usage when nothing exists", async () => {
    expect(await loadDay(fetchText, today, 5, 10)).toEqual({});
  });
  it("sums a range of days", async () => {
    expect(await loadRange(fetchText, today, 3, 10)).toEqual({ a: 120, b: 50, c: 10 });
  });
});
