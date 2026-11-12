import { describe, it, expect } from "vitest";
import { chartBars, shortDuration } from "../js/chart.js";
import { createApi } from "../js/api.js";
import { DAILY_CHOICES, APP_CHOICES, limitLabel, lockMessage, pinPress } from "../js/limits.js";
import { loadDays } from "../js/screentime.js";
import { weekdayShort } from "../js/clock.js";

describe("chartBars", () => {
  it("scales bars to the largest day and keeps tiny non-zero days visible", () => {
    const bars = chartBars([3600, 1800, 0, 36], 100);
    expect(bars.map((b) => b.height)).toEqual([100, 50, 0, 4]);
    expect(bars[0].seconds).toBe(3600);
  });
  it("returns zero heights when every day is empty", () => {
    expect(chartBars([0, 0], 100).map((b) => b.height)).toEqual([0, 0]);
  });
});

describe("weekdayShort", () => {
  it("gives the short French weekday", () => {
    expect(weekdayShort(new Date(2026, 10, 12))).toBe("jeu.");
    expect(weekdayShort(new Date(2026, 10, 15))).toBe("dim.");
  });
});

describe("loadDays", () => {
  it("loads one usage map per day, today first", async () => {
    const files = { "data/usage-2026-11-12.log": "10:00:00 a\n", "data/usage-2026-11-11.tsv": "a\t100\n" };
    const fetchText = (u) => Promise.resolve(u in files ? files[u] : null);
    const days = await loadDays(fetchText, new Date(2026, 10, 12, 12), 3, 10);
    expect(days).toEqual([{ a: 10 }, { a: 100 }, {}]);
  });
});

describe("limit choices and labels", () => {
  it("starts with no limit and has labelled values", () => {
    expect(DAILY_CHOICES[0]).toEqual({ value: 0, label: "Aucune" });
    expect(DAILY_CHOICES.some((c) => c.value === 7200)).toBe(true);
    expect(APP_CHOICES[0].value).toBe(0);
  });
  it("labels a limit in seconds", () => {
    expect(limitLabel(0)).toBe("Aucune");
    expect(limitLabel(5400)).toBe("1 h 30 min");
    expect(limitLabel(undefined)).toBe("Aucune");
  });
});

describe("lockMessage", () => {
  it("describes a daily and an app lock", () => {
    expect(lockMessage({ reason: "daily", allowed: 7200 }, {})).toBe("Limite quotidienne atteinte (2 h 00 min).");
    expect(lockMessage({ reason: "app", app: "netflix", allowed: 1800 }, { netflix: "Netflix" })).toBe("Limite de Netflix atteinte (30 min).");
  });
});

describe("pinPress", () => {
  it("appends digits up to 8 and deletes with back", () => {
    let pin = "";
    for (const d of "123456789") pin = pinPress(pin, d);
    expect(pin).toBe("12345678");
    expect(pinPress("12", "back")).toBe("1");
    expect(pinPress("", "back")).toBe("");
  });
  it("ignores anything that is not a digit or back", () => {
    expect(pinPress("1", "x")).toBe("1");
  });
});

describe("createApi", () => {
  const reply = (status, body) => () => Promise.resolve({ status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body) });
  it("returns the state or null when the service is unreachable", async () => {
    expect(await createApi("http://x", reply(200, { total: 5 })).state()).toEqual({ total: 5 });
    expect(await createApi("http://x", () => Promise.reject(new Error("down"))).state()).toBeNull();
    expect(await createApi("http://x", reply(500, {})).state()).toBeNull();
  });
  it("posts JSON and returns status and body", async () => {
    let seen = null;
    const fetchFn = (url, opts) => { seen = { url, opts }; return reply(403, { error: "pin" })(); };
    const res = await createApi("http://x", fetchFn).post("/config", { daily_limit: 1 });
    expect(res).toEqual({ status: 403, body: { error: "pin" } });
    expect(seen.url).toBe("http://x/config");
    expect(JSON.parse(seen.opts.body)).toEqual({ daily_limit: 1 });
  });
  it("reports status 0 when the post cannot reach the service", async () => {
    const res = await createApi("http://x", () => Promise.reject(new Error("down"))).post("/pin", {});
    expect(res.status).toBe(0);
  });
});

describe("shortDuration", () => {
  it("formats compactly", () => {
    expect(shortDuration(0)).toBe("");
    expect(shortDuration(20)).toBe("<1m");
    expect(shortDuration(45 * 60)).toBe("45m");
    expect(shortDuration(3600 + 5 * 60)).toBe("1h05");
    expect(shortDuration(5 * 3600)).toBe("5h00");
  });
});
