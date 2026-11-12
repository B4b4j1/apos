import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { resolve } from "path";
import { createMoodEngine, limitRatio, isNight, gaze, pupilGeometry, ACTIONS, actionDuration, SLEEP_AFTER_MS, MOODS } from "../js/avatar.js";
import { COMPANIONS, COMPANION_ORDER } from "../js/companion-data.js";
import { GROUPS, sanitize } from "../js/settings.js";

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
  it("never leaves the unit disk whatever the distance or angle", () => {
    for (let a = 0; a < 360; a += 15) {
      const g = gaze(Math.cos(a * Math.PI / 180) * 5000, Math.sin(a * Math.PI / 180) * 5000);
      expect(g.x * g.x + g.y * g.y).toBeLessThanOrEqual(1.0001);
    }
  });
});

describe("pupil geometry", () => {
  it("keeps the pupil fully inside the eye at the extreme of its travel", () => {
    const eye = { x: 0.33, y: 0.54, w: 0.15, h: 0.19 };
    const g = pupilGeometry(eye);
    expect(g.d).toBeLessThan(Math.min(eye.w, eye.h));
    expect(g.tx + g.d / 2).toBeLessThan(eye.w / 2);
    expect(g.ty + g.d / 2).toBeLessThan(eye.h / 2);
  });
  it("never has a negative travel for a very small eye", () => {
    const g = pupilGeometry({ x: 0.5, y: 0.5, w: 0.01, h: 0.01 });
    expect(g.tx).toBeGreaterThanOrEqual(0);
    expect(g.ty).toBeGreaterThanOrEqual(0);
  });
});

describe("companion data", () => {
  const root = resolve(__dirname, "..");
  it("offers all three companions, each one alone, or none", () => {
    const item = GROUPS.reduce((acc, g) => acc.concat(g.items), []).filter((i) => i.key === "companion")[0];
    expect(item.choices.map((c) => c.value)).toEqual(["all"].concat(COMPANION_ORDER, ["none"]));
    expect(item.default).toBe("all");
    expect(sanitize({ companion: "unicorn" }).companion).toBe("unicorn");
    expect(sanitize({ companion: "dragon" }).companion).toBe("all");
    expect(sanitize({ avatar: false }).companion).toBe("none");
    expect(sanitize({ avatar: false, companion: "rabbit" }).companion).toBe("rabbit");
  });
  COMPANION_ORDER.forEach((id) => {
    it(id + " has an image for every mood, a pupil, and two eyes on the open-eyed heads", () => {
      const c = COMPANIONS[id];
      expect(existsSync(resolve(root, c.pupil))).toBe(true);
      MOODS.forEach((mood) => {
        expect(existsSync(resolve(root, c.moods[mood].img))).toBe(true);
      });
      ["idle", "curious", "worried"].forEach((mood) => {
        const eyes = c.moods[mood].eyes;
        expect(eyes.length).toBe(2);
        expect(eyes[0].x).toBeLessThan(eyes[1].x);
        eyes.forEach((e) => {
          [e.x, e.y].forEach((v) => { expect(v).toBeGreaterThan(0); expect(v).toBeLessThan(1); });
          expect(e.w).toBeGreaterThan(0.05);
          expect(e.h).toBeGreaterThan(0.05);
        });
      });
    });
  });
});

describe("click actions", () => {
  const root = resolve(__dirname, "..");
  it("has an animation for each companion, with the effects and images it needs", () => {
    COMPANION_ORDER.forEach((id) => {
      const a = ACTIONS[id];
      const c = COMPANIONS[id];
      expect(a.steps.length).toBeGreaterThan(1);
      a.steps.forEach((st) => {
        expect(c.moods[st.layer]).toBeDefined();
        expect(st.ms).toBeGreaterThan(0);
      });
      expect(actionDuration(id)).toBeGreaterThan(1500);
      expect(actionDuration(id)).toBeLessThan(8000);
    });
    expect(ACTIONS.cat.bubble).toBe("Miaou !");
    expect(ACTIONS.unicorn.steps.some((st) => st.fx === "rainbow")).toBe(true);
    expect(COMPANIONS.unicorn.horn.y).toBeLessThan(0.2);
    expect(["eat1", "eat2", "eat3"].every((l) => COMPANIONS.rabbit.moods[l])).toBe(true);
    expect(existsSync(resolve(root, COMPANIONS.rabbit.sprites.carrot.img))).toBe(true);
    expect(actionDuration("unknown")).toBe(0);
  });
  it("has the images of every extra layer", () => {
    COMPANION_ORDER.forEach((id) => {
      Object.keys(COMPANIONS[id].moods).forEach((l) => expect(existsSync(resolve(root, COMPANIONS[id].moods[l].img))).toBe(true));
    });
  });
});

