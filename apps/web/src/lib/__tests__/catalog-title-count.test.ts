import { describe, expect, it } from "vitest";
import { catalogTitleCount } from "../catalog-title-count";
import { catalogIdTitle } from "../catalog-id-title";

describe("catalog title counts", () => {
  it.each([
    ["IDs [24K+ Image Codes]", 38657, "IDs [38K+ Image Codes]"],
    ["Music [58K+ songs]", 60550, "Music [60K+ songs]"],
    ["IDs [1,000 3D Mesh Assets]", 1000, "IDs [1K+ 3D Mesh Assets]"],
    ["500+ Roblox Adonis Admin Commands List", 999, "999 Roblox Adonis Admin Commands List"],
    ["IDs [1K+ images]", 2500, "IDs [2K+ images]"],
    ["IDs [85]", 86, "IDs [86]"],
    ["Fonts [85 FontFamily Assets]", 12, "Fonts [12 FontFamily Assets]"],
    ["Items (150 items)", 999, "Items (999 items)"],
    ["115 Roblox error codes", 116, "116 Roblox error codes"],
    ["3008 Music IDs [32 Music Menu Songs]", 40, "3008 Music IDs [40 Music Menu Songs]"],
    ["Mystery 2 Music IDs [82 MM2 Radio Codes]", 90, "Mystery 2 Music IDs [90 MM2 Radio Codes]"],
    ["85 Music IDs", 90, "90 Music IDs"],
    ["85 songs and 12 sounds", 100, "100 songs and 12 sounds"],
    ["Roblox Color Codes (BrickColor & Color3)", 100, "Roblox Color Codes (BrickColor & Color3)"],
    ["Music IDs (November 2026) - Page 2 | Bloxodes", 90, "Music IDs (November 2026) - Page 2 | Bloxodes"]
  ])("updates %s", (title, count, expected) => expect(catalogTitleCount(title, count)).toBe(expected));

  it.each([
    "image", "images", "picture", "pictures", "texture", "textures", "poster", "posters",
    "decal", "decals", "mesh", "meshes", "font", "fonts", "emote", "emotes", "bundle", "bundles"
  ])("updates bracketed %s counts", noun => {
    expect(catalogTitleCount(`IDs [1K+ ${noun}]`, 2500)).toBe(`IDs [2K+ ${noun}]`);
  });

  it("preserves unrecognized count wording", () => {
    expect(catalogTitleCount("IDs [1K+ widgets]", 2500)).toBe("IDs [1K+ widgets]");
  });

  it("preserves an image count when the total is unknown", () => {
    expect(catalogTitleCount("IDs [1K+ images]", undefined)).toBe("IDs [1K+ images]");
  });

  it.each([null, undefined, 0, -1, NaN, Infinity])("preserves unknown totals %s", count => {
    expect(catalogTitleCount("IDs [24K+ images]", count)).toBe("IDs [24K+ images]");
  });

  it("is idempotent with date, page and brand suffixes in either call order", () => {
    const now = new Date("2026-11-16T00:00:00Z");
    const saved = "IDs [24K+ images] (October 2025) - Page 2 | Bloxodes";
    const result = catalogIdTitle(catalogTitleCount(saved, 38657), now);
    expect(result).toBe("IDs [38K+ images] (November 2026) - Page 2 | Bloxodes");
    expect(catalogTitleCount(catalogIdTitle(saved, now), 38657)).toBe(result);
    expect(catalogIdTitle(catalogTitleCount(result, 38657), now)).toBe(result);
  });
});

it.each([
  ["Roblox Music IDs (2026)", "Roblox Music IDs (2026)"],
  ["Roblox Music IDs (2026-11-16)", "Roblox Music IDs (2026-11-16)"],
  ["Retail Tycoon 2 Item IDs [88 items]", "Retail Tycoon 2 Item IDs [900 items]"],
  ["Roblox 3008 Music IDs [32 songs]", "Roblox 3008 Music IDs [900 songs]"]
])("preserves dates and numeric names in %s", (title, expected) => {
  expect(catalogTitleCount(title, 900)).toBe(expected);
});

// Saved inventory captured for this change; expected titles are independent literals.
it.each([
  ["Roblox Admin Commands: What They Are, How to Use Them", "Roblox Admin Commands: What They Are, How to Use Them"],
  ["500+ Roblox Adonis Admin Commands List", "900 Roblox Adonis Admin Commands List"],
  ["100 Roblox Basic Admin Essentials (BAE) Commands List", "900 Roblox Basic Admin Essentials (BAE) Commands List"],
  ["150+ Roblox HD Admin Commands List", "900 Roblox HD Admin Commands List"],
  ["250+ Roblox Kohl's Admin Commands List", "900 Roblox Kohl's Admin Commands List"],
  ["Roblox Free Items and Bundles (150 items)", "Roblox Free Items and Bundles (900 items)"],
  ["Roblox Color Codes (BrickColor & Color3)", "Roblox Color Codes (BrickColor & Color3)"],
  ["Roblox Decal IDs [24K+ Image Codes] (November 2026)", "Roblox Decal IDs [900 Image Codes] (November 2026)"],
  ["Best Roblox Decal IDs to Copy [Image IDs] (November 2026) | Bloxodes", "Best Roblox Decal IDs to Copy [Image IDs] (November 2026) | Bloxodes"],
  ["Berry Avenue Picture Codes [Wall Art & Rug IDs] (November 2026)", "Berry Avenue Picture Codes [Wall Art & Rug IDs] (November 2026)"],
  ["Bloxburg Decal IDs [Pictures, Posters & Textures] (November 2026)", "Bloxburg Decal IDs [Pictures, Posters & Textures] (November 2026)"],
  ["BloxStrike Crosshair IDs [Custom Image Codes] (November 2026)", "BloxStrike Crosshair IDs [Custom Image Codes] (November 2026)"],
  ["Da Hood Crosshair IDs [Custom Cursor Codes] (November 2026)", "Da Hood Crosshair IDs [Custom Cursor Codes] (November 2026)"],
  ["Jujutsu Shenanigans Image IDs (November 2026)", "Jujutsu Shenanigans Image IDs (November 2026)"],
  ["Shindo Life Face and Eye IDs (November 2026)", "Shindo Life Face and Eye IDs (November 2026)"],
  ["Roblox Spray Paint IDs [Decal & Image Codes] (November 2026)", "Roblox Spray Paint IDs [Decal & Image Codes] (November 2026)"],
  ["Roblox Dictionary [251 Slang, Acronyms & Terms]", "Roblox Dictionary [900 Slang, Acronyms & Terms]"],
  ["Roblox Emote Commands", "Roblox Emote Commands"],
  ["115 Roblox error codes: full list and fixes", "900 Roblox error codes: full list and fixes"],
  ["Roblox Font IDs [85 FontFamily Assets]", "Roblox Font IDs [900 FontFamily Assets]"],
  ["Roblox Item & Bundle Codes [91K+ Marketplace IDs]", "Roblox Item & Bundle Codes [900 Marketplace IDs]"],
  ["Roblox Accessory Codes [39K+ Item IDs]", "Roblox Accessory Codes [900 Item IDs]"],
  ["Roblox Back Accessory Codes [4K+ Item IDs]", "Roblox Back Accessory Codes [900 Item IDs]"],
  ["Roblox Face Accessory Codes [4K+ Item IDs]", "Roblox Face Accessory Codes [900 Item IDs]"],
  ["Roblox Front Accessory Codes [4K+ Item IDs]", "Roblox Front Accessory Codes [900 Item IDs]"],
  ["Roblox Gear Codes [1K+ Item IDs]", "Roblox Gear Codes [900 Item IDs]"],
  ["Roblox Hair Codes [4K+ Item IDs]", "Roblox Hair Codes [900 Item IDs]"],
  ["Roblox Hat & Head Accessory Codes [6K+ Item IDs]", "Roblox Hat & Head Accessory Codes [900 Item IDs]"],
  ["Roblox Neck Accessory Codes [5K+ Item IDs]", "Roblox Neck Accessory Codes [900 Item IDs]"],
  ["Roblox Shoulder Accessory Codes [4K+ Item IDs]", "Roblox Shoulder Accessory Codes [900 Item IDs]"],
  ["Roblox Waist Accessory Codes [4K+ Item IDs]", "Roblox Waist Accessory Codes [900 Item IDs]"],
  ["Roblox Animation Codes [3K+ Bundle IDs]", "Roblox Animation Codes [900 Bundle IDs]"],
  ["Roblox Body Codes [6K+ Item & Bundle IDs]", "Roblox Body Codes [900 Item & Bundle IDs]"],
  ["Roblox Classic Face Codes [354 Item IDs]", "Roblox Classic Face Codes [900 Item IDs]"],
  ["Roblox Classic Head Codes [8 Item IDs]", "Roblox Classic Head Codes [900 Item IDs]"],
  ["Roblox Dynamic Head Codes [3K+ Item IDs]", "Roblox Dynamic Head Codes [900 Item IDs]"],
  ["Roblox Avatar Bundle Codes [2K+ Bundle IDs]", "Roblox Avatar Bundle Codes [900 Bundle IDs]"],
  ["Roblox Clothing Codes [37K+ Item IDs]", "Roblox Clothing Codes [900 Item IDs]"],
  ["Roblox Classic Pants Codes [4K+ Item IDs]", "Roblox Classic Pants Codes [900 Item IDs]"],
  ["Roblox Classic Shirt Codes [3K+ Item IDs]", "Roblox Classic Shirt Codes [900 Item IDs]"],
  ["Roblox Classic T-Shirt Codes [3K+ Item IDs]", "Roblox Classic T-Shirt Codes [900 Item IDs]"],
  ["Roblox Dress & Skirt Codes [3K+ Item IDs]", "Roblox Dress & Skirt Codes [900 Item IDs]"],
  ["Roblox Jacket Codes [3K+ Item IDs]", "Roblox Jacket Codes [900 Item IDs]"],
  ["Roblox Layered T-Shirt Codes [3K+ Item IDs]", "Roblox Layered T-Shirt Codes [900 Item IDs]"],
  ["Roblox Layered Pants Codes [3K+ Item IDs]", "Roblox Layered Pants Codes [900 Item IDs]"],
  ["Roblox Layered Shirt Codes [3K+ Item IDs]", "Roblox Layered Shirt Codes [900 Item IDs]"],
  ["Roblox Shoe Codes [1K+ Item IDs]", "Roblox Shoe Codes [900 Item IDs]"],
  ["Roblox Shorts Codes [3K+ Item IDs]", "Roblox Shorts Codes [900 Item IDs]"],
  ["Roblox Sweater Codes [3K+ Item IDs]", "Roblox Sweater Codes [900 Item IDs]"],
  ["Roblox Emote IDs [4K+ Marketplace Items]", "Roblox Emote IDs [900 Marketplace Items]"],
  ["Roblox Makeup Codes [608 Item IDs]", "Roblox Makeup Codes [900 Item IDs]"],
  ["Roblox Mesh IDs [1,000 3D Mesh Assets]", "Roblox Mesh IDs [900 3D Mesh Assets]"],
  ["Roblox Music Codes [58K+ Audio/Song IDs] (November 2026)", "Roblox Music Codes [900 Audio/Song IDs] (November 2026)"],
  ["3008 Music IDs [32 Music Menu Songs] (November 2026)", "3008 Music IDs [900 Music Menu Songs] (November 2026)"],
  ["A Dusty Trip Music IDs [33 Radio Songs] (November 2026)", "A Dusty Trip Music IDs [900 Radio Songs] (November 2026)"],
  ["Adopt Me Music IDs [85 Jukebox Songs] (November 2026)", "Adopt Me Music IDs [900 Jukebox Songs] (November 2026)"],
  ["Basketball Zero Music IDs [64 Boombox Songs] (November 2026)", "Basketball Zero Music IDs [900 Boombox Songs] (November 2026)"],
  ["Brookhaven RP Music IDs [85 Speaker Songs] (November 2026)", "Brookhaven RP Music IDs [900 Speaker Songs] (November 2026)"],
  ["Da Hood Music IDs [28 Boombox Songs] (November 2026)", "Da Hood Music IDs [900 Boombox Songs] (November 2026)"],
  ["Driving Empire Music IDs [67 Radio Songs] (November 2026)", "Driving Empire Music IDs [900 Radio Songs] (November 2026)"],
  ["Evade Music IDs [70 Boombox Songs] (November 2026)", "Evade Music IDs [900 Boombox Songs] (November 2026)"],
  ["Fisch Music IDs [85 Radio Songs] (November 2026)", "Fisch Music IDs [900 Radio Songs] (November 2026)"],
  ["Forsaken Music IDs [70 Hit & Kill Sounds] (November 2026)", "Forsaken Music IDs [900 Hit & Kill Sounds] (November 2026)"],
  ["Grand Piece Online Music IDs [72 Music Snail Songs] (November 2026)", "Grand Piece Online Music IDs [900 Music Snail Songs] (November 2026)"],
  ["Jujutsu Shenanigans Music IDs [137 Kill & Death Sounds] (November 2026)", "Jujutsu Shenanigans Music IDs [900 Kill & Death Sounds] (November 2026)"],
  ["Murder Mystery 2 Music IDs [82 MM2 Radio Codes] (November 2026)", "Murder Mystery 2 Music IDs [900 MM2 Radio Codes] (November 2026)"],
  ["Nico's Nextbots Music IDs [53 Boombox Songs] (November 2026)", "Nico's Nextbots Music IDs [900 Boombox Songs] (November 2026)"],
  ["Retail Tycoon 2 Music IDs [88 Playlist Songs] (November 2026)", "Retail Tycoon 2 Music IDs [900 Playlist Songs] (November 2026)"],
  ["The Strongest Battlegrounds Music IDs [30 Kill Sound Codes] (November 2026)", "The Strongest Battlegrounds Music IDs [900 Kill Sound Codes] (November 2026)"],
  ["Trending Roblox music IDs (November 2026) | Bloxodes", "Trending Roblox music IDs (November 2026) | Bloxodes"],
  ["Roblox Promo Codes and Free Items", "Roblox Promo Codes and Free Items"],
])("updates saved title %s", (title, expected) => {
  expect(catalogTitleCount(title, 900)).toBe(expected);
});
