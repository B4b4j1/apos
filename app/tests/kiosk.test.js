import { describe, it, expect } from "vitest";
import { hashPin, checkPin, isAppAllowed } from "../js/kiosk.js";

describe("kiosk PIN", () => {
  it("accepts the right PIN and rejects a wrong one", async () => {
    const h = await hashPin("1234", "salt-a");
    expect(await checkPin("1234", "salt-a", h)).toBe(true);
    expect(await checkPin("0000", "salt-a", h)).toBe(false);
  });
  it("produces different hashes for different salts", async () => {
    expect(await hashPin("1234", "a")).not.toBe(await hashPin("1234", "b"));
  });
  it("rejects a PIN that is not four digits", async () => {
    await expect(hashPin("12", "s")).rejects.toThrow(/4 chiffres/);
  });
});

describe("isAppAllowed", () => {
  it("allows only listed ids", () => {
    expect(isAppAllowed("lecture", ["lecture"])).toBe(true);
    expect(isAppAllowed("navigateur", ["lecture"])).toBe(false);
  });
});
