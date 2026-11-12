import { describe, it, expect } from "vitest";
import { CHANNELS, YOUTUBE_APP_ID } from "../config/youtube.js";
import { channelUrl, launchParams, validChannels, readRecents, markOpened, orderChannels, RECENT_KEY } from "../js/youtube.js";
import { launchApp } from "../js/luna.js";

function memory() {
  const data = {};
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
}

describe("youtube channels", () => {
  it("lists the three requested channels with safe direct links", () => {
    expect(YOUTUBE_APP_ID).toBe("youtube.leanback.v4");
    expect(CHANNELS.map(channelUrl)).toEqual([
      "https://www.youtube.com/@3-kota",
      "https://www.youtube.com/@malyshariki",
      "https://www.youtube.com/@BlueyFrancais",
    ]);
    expect(validChannels(CHANNELS)).toHaveLength(3);
  });
  it("rejects other hosts and malformed entries", () => {
    expect(validChannels([{ id: "x", title: "X", handle: "https://evil.test/@x" }, null, { id: 1 }, { id: "y", title: "Y", handle: "y" }])).toEqual([]);
    expect(validChannels(null)).toEqual([]);
  });
  it("builds launch params carrying the url", () => {
    expect(launchParams(CHANNELS[0])).toEqual({ contentTarget: "https://www.youtube.com/@3-kota" });
  });
  it("orders the last opened channel first and keeps config order otherwise", () => {
    expect(orderChannels(CHANNELS, {}).map((c) => c.id)).toEqual(["3-kota", "malyshariki", "blueyfrancais"]);
    expect(orderChannels(CHANNELS, { blueyfrancais: 20, malyshariki: 10 }).map((c) => c.id)).toEqual(["blueyfrancais", "malyshariki", "3-kota"]);
  });
  it("stores and reads recents, ignoring corrupt data", () => {
    const s = memory();
    expect(markOpened(s, "malyshariki", 5)).toBe(true);
    expect(readRecents(s)).toEqual({ malyshariki: 5 });
    s.setItem(RECENT_KEY, "not json");
    expect(readRecents(s)).toEqual({});
    s.setItem(RECENT_KEY, "[1]");
    expect(readRecents(s)).toEqual({});
  });
  it("passes launch params to the application manager", async () => {
    const calls = [];
    function Bridge() { this.call = (uri, body) => { calls.push([uri, JSON.parse(body)]); setTimeout(() => this.onservicecallback('{"returnValue":true}'), 0); }; }
    await launchApp("youtube.leanback.v4", { bridge: Bridge }, { contentTarget: "https://www.youtube.com/@x" });
    await launchApp("a", { bridge: Bridge });
    expect(calls[0][1]).toEqual({ id: "youtube.leanback.v4", params: { contentTarget: "https://www.youtube.com/@x" } });
    expect(calls[1][1]).toEqual({ id: "a" });
  });
});
