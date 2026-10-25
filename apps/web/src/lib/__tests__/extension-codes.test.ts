import { describe, expect, it } from "vitest";
import {
  extractPlaceIdFromRobloxUrl,
  normalizeExtensionLimit,
  normalizeRobloxGameName,
  normalizeRobloxGameUrl,
  normalizeRobloxPlaceId,
  pickUniverseCodePage
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

  it("picks one page when several published pages share a universe", () => {
    const rows = [
      { slug: "murder-mystery-x", roblox_link: "https://www.roblox.com/games/111/MMX", active_code_count: 2 },
      { slug: "murder-mystery-2", roblox_link: "https://www.roblox.com/games/142823291/MM2", active_code_count: 1 },
      { slug: "murder-mystery-3", roblox_link: null, active_code_count: 5 }
    ];
    expect(pickUniverseCodePage(rows, 142823291)?.slug).toBe("murder-mystery-2");
    expect(pickUniverseCodePage(rows, 999)?.slug).toBe("murder-mystery-3");
    expect(pickUniverseCodePage(rows.slice(0, 1), null)?.slug).toBe("murder-mystery-x");
    expect(pickUniverseCodePage([], 142823291)).toBeNull();
  });
});
