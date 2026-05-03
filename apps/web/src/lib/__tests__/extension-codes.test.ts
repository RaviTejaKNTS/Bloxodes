import { describe, expect, it } from "vitest";
import {
  extractPlaceIdFromRobloxUrl,
  normalizeExtensionLimit,
  normalizeRobloxGameName,
  normalizeRobloxGameUrl,
  normalizeRobloxPlaceId
} from "../extension-codes-utils";

describe("extension code request normalization", () => {
  it("normalizes preview limits to the three-code extension cap", () => {
    expect(normalizeExtensionLimit(null)).toBe(3);
    expect(normalizeExtensionLimit("1")).toBe(1);
    expect(normalizeExtensionLimit("12")).toBe(3);
    expect(normalizeExtensionLimit("-2")).toBe(3);
  });

  it("accepts safe Roblox game URLs only", () => {
    expect(normalizeRobloxGameUrl("https://www.roblox.com/games/1234/Game-Name")).toBe(
      "https://www.roblox.com/games/1234/Game-Name"
    );
    expect(normalizeRobloxGameUrl("https://web.roblox.com/games/1234/Game-Name")).toBe(
      "https://web.roblox.com/games/1234/Game-Name"
    );
    expect(normalizeRobloxGameUrl("https://example.com/games/1234/Game-Name")).toBeNull();
    expect(normalizeRobloxGameUrl("javascript:alert(1)")).toBeNull();
  });

  it("extracts place IDs from Roblox game URLs", () => {
    expect(extractPlaceIdFromRobloxUrl("https://www.roblox.com/games/987654321/Test")).toBe(987654321);
    expect(extractPlaceIdFromRobloxUrl("https://www.roblox.com/catalog/987654321/Test")).toBeNull();
  });

  it("normalizes place IDs and game names", () => {
    expect(normalizeRobloxPlaceId("123")).toBe(123);
    expect(normalizeRobloxPlaceId("0")).toBeNull();
    expect(normalizeRobloxGameName("  Grow   a Garden  ")).toBe("Grow a Garden");
    expect(normalizeRobloxGameName("")).toBeNull();
  });
});
