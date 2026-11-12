import { describe, it, expect } from "vitest";
import { lunaCall } from "../js/luna.js";

function fakeBridge(reply) {
  return function Bridge() {
    this.call = (uri, params) => {
      this.uri = uri; this.params = params;
      if (reply !== null) setTimeout(() => this.onservicecallback(reply), 0);
    };
    this.cancel = () => {};
  };
}

describe("lunaCall", () => {
  it("resolves with the parsed reply", async () => {
    const data = await lunaCall("luna://x/y", { a: 1 }, { bridge: fakeBridge('{"returnValue":true,"v":2}') });
    expect(data.v).toBe(2);
  });
  it("rejects when the service reports an error", async () => {
    await expect(lunaCall("luna://x/y", {}, { bridge: fakeBridge('{"returnValue":false,"errorText":"denied"}') })).rejects.toThrow("denied");
  });
  it("rejects on invalid JSON", async () => {
    await expect(lunaCall("luna://x/y", {}, { bridge: fakeBridge("pas du json") })).rejects.toThrow("bad-json");
  });
  it("rejects with no-bridge when the bridge is missing", async () => {
    await expect(lunaCall("luna://x/y", {}, { bridge: null })).rejects.toThrow("no-bridge");
  });
  it("rejects on timeout when no reply arrives", async () => {
    await expect(lunaCall("luna://x/y", {}, { bridge: fakeBridge(null), timeoutMs: 20 })).rejects.toThrow("timeout");
  });
});
