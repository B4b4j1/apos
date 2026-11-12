import { describe, it, expect } from "vitest";
import { createMoodEngine, limitRatio, isNight, gaze, SLEEP_AFTER_MS, MOODS } from "../js/avatar.js";

const DAY = { hour: 14, limitRatio: 0, locked: false };

describe("mood engine", () => {
  it("is idle by default during the day", () => {
    const e = createMoodEngine();
    e.event("back", 1000);
    expect(e.mood(2600, DAY)).toBe("idle");
    expect(e.mood(1100, DAY)).toBe("idle");
  });
  it("reacts to actions then goes back to idle", () => {
    const e = createMoodEngine();
    e.event("launch", 1000);
    expect(e.mood(2000, DAY)).toBe("happy");
    expect(e.mood(6100, DAY)).toBe("idle");
    e.event("settings", 10000);
    expect(e.mood(11000, DAY)).toBe("curious");
    e.event("reorder", 20000);
    expect(e.mood(21000, DAY)).toBe("surprised");
    e.event("saved", 30000);
    expect(e.mood(31000, DAY)).toBe("proud");
  });
  it("keeps the current reaction when an unrelated key is pressed", () => {
    const e = createMoodEngine();
    e.event("launch", 1000);
    e.event("touch", 1500);
    expect(e.mood(2000, DAY)).toBe("happy");
  });
  it("falls asleep at night or after a long inactivity, and wakes on an action", () => {
    const e = createMoodEngine();
    e.event("back", 0);
    expect(e.mood(SLEEP_AFTER_MS + 1, DAY)).toBe("sleepy");
    expect(e.mood(1000, { hour: 23, limitRatio: 0, locked: false })).toBe("sleepy");
    expect(e.mood(1000, { hour: 3, limitRatio: 0, locked: false })).toBe("sleepy");
    e.event("launch", SLEEP_AFTER_MS + 5);
    expect(e.mood(SLEEP_AFTER_MS + 10, DAY)).toBe("happy");
  });
  it("worries near the limit or when locked, whatever the event", () => {
    const e = createMoodEngine();
    e.event("launch", 0);
    expect(e.mood(10, { hour: 14, limitRatio: 0.85, locked: false })).toBe("worried");
    expect(e.mood(10, { hour: 14, limitRatio: 0, locked: true })).toBe("worried");
    expect(e.mood(10, { hour: 14, limitRatio: 0.5, locked: false })).toBe("happy");
  });
  it("ignores unknown events and always returns a known mood", () => {
    const e = createMoodEngine();
    e.event("nonsense", 0);
    expect(MOODS).toContain(e.mood(10, DAY));
    expect(MOODS).toContain(e.mood(10, undefined));
  });
});

describe("helpers", () => {
  it("detects night hours", () => {
    expect(isNight(22)).toBe(true);
    expect(isNight(6)).toBe(true);
    expect(isNight(7)).toBe(false);
    expect(isNight(21)).toBe(false);
  });
  it("computes the used share of the daily limit", () => {
    expect(limitRatio(null)).toBe(0);
    expect(limitRatio({ config: { daily_limit: 0 }, total: 500 })).toBe(0);
    expect(limitRatio({ config: { daily_limit: 3600 }, total: 1800 })).toBe(0.5);
    expect(limitRatio({ config: { daily_limit: 100 }, total: 900 })).toBe(2);
  });
});

describe("gaze", () => {
  it("stays centred when the pointer is on the avatar", () => {
    expect(gaze(0, 0)).toEqual({ x: 0, y: 0 });
  });
  it("looks toward the pointer, further when it is further away", () => {
    const near = gaze(50, 0);
    const far = gaze(2000, 0);
    expect(near.x).toBeGreaterThan(0);
    expect(near.y).toBe(0);
    expect(far.x).toBeGreaterThan(near.x);
    expect(gaze(-2000, 0).x).toBeLessThan(0);
    expect(gaze(0, -2000).y).toBeLessThan(0);
    expect(gaze(0, 2000).y).toBeGreaterThan(0);
  });
  it("never leaves the eye whatever the distance or angle", () => {
    for (let a = 0; a < 360; a += 15) {
      const g = gaze(Math.cos(a * Math.PI / 180) * 5000, Math.sin(a * Math.PI / 180) * 5000);
      expect((g.x / 3.5) ** 2 + (g.y / 5.5) ** 2).toBeLessThanOrEqual(1.0001);
    }
  });
});
