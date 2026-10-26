import { afterEach, describe, expect, it, vi } from "vitest";
import { catalogIdTitle } from "../catalog-id-title";

const october = new Date("2026-10-26T12:00:00Z");

afterEach(() => vi.useRealTimers());

describe("music and decal catalog title dates", () => {
  it.each([
    ["2026-10-31T23:59:59.999Z", "October 2026"],
    ["2026-11-01T00:00:00.000Z", "November 2026"],
    ["2026-12-31T23:59:59.999Z", "December 2026"],
    ["2027-01-01T00:00:00.000Z", "January 2027"],
    ["2026-11-01T00:30:00+14:00", "October 2026"],
    ["2026-10-31T23:30:00-07:00", "November 2026"]
  ])("uses the UTC calendar at %s", (instant, label) => {
    expect(catalogIdTitle("Roblox Music IDs", new Date(instant))).toBe(`Roblox Music IDs (${label})`);
  });

  it("reads the clock on each call, including after a year rollover", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-12-31T23:59:59Z"));
    expect(catalogIdTitle("Roblox Decal IDs")).toBe("Roblox Decal IDs (December 2026)");
    vi.setSystemTime(new Date("2027-01-01T00:00:00Z"));
    expect(catalogIdTitle("Roblox Decal IDs")).toBe("Roblox Decal IDs (January 2027)");
  });

  it.each([
    "Roblox Music IDs",
    "Roblox Music IDs (January 2024)",
    "Roblox Music IDs [January 2024]",
    "Roblox Music IDs (%month% %year%)",
    "Roblox Music IDs [%month% %year%]",
    "Roblox Music IDs %MONTH% %YEAR%",
    "Roblox Music IDs - %month% %year%",
    "Roblox Music IDs (January 2024) (February 2025)"
  ])("keeps one current date for %s", title => {
    const result = catalogIdTitle(title, october);
    expect(result).toBe("Roblox Music IDs (October 2026)");
    expect(catalogIdTitle(result, october)).toBe(result);
  });

  it.each([
    "Example Game May 2025",
    "Show Name - June 2024"
  ])("preserves a bare month and year in the real name %s", title => {
    const result = catalogIdTitle(title, october);
    expect(result).toBe(`${title} (October 2026)`);
    expect(catalogIdTitle(result, october)).toBe(result);
    expect(catalogIdTitle(`${title} - Page 2 | Bloxodes`, october))
      .toBe(`${title} (October 2026) - Page 2 | Bloxodes`);
  });

  it.each([
    "Game Music IDs [1,234 songs] - Page 2 | Bloxodes",
    "Game Music IDs [1,234 songs] (January 2024) - Page 2 | Bloxodes",
    "Game Music IDs [1,234 songs] - Page 2 (January 2024) | Bloxodes",
    "Game Music IDs [1,234 songs] - Page 2 | Bloxodes (January 2024)",
    "Game Music IDs [1,234 songs] (%month% %year%) - Page 2 | Bloxodes"
  ])("preserves counts, page number and final brand for %s", title => {
    const result = catalogIdTitle(title, october);
    expect(result).toBe("Game Music IDs [1,234 songs] (October 2026) - Page 2 | Bloxodes");
    expect(catalogIdTitle(result, october)).toBe(result);
    expect(catalogIdTitle(result, new Date("2027-01-01T00:00:00Z")))
      .toBe("Game Music IDs [1,234 songs] (January 2027) - Page 2 | Bloxodes");
  });
});
