import { describe, expect, it } from "vitest";

import {
  hasOfficialUniverseMedia,
  isOfficialRobloxImageUrl,
  normalizeOfficialUniverseThumbnails,
  selectOfficialUniverseMedia,
} from "@/lib/roblox/universe-media";

describe("official Roblox universe media", () => {
  it("accepts only Roblox CDN image URLs", () => {
    expect(isOfficialRobloxImageUrl("https://tr.rbxcdn.com/asset/512/512/Image/Png/noFilter")).toBe(true);
    expect(isOfficialRobloxImageUrl("https://media.bloxodes.com/article.webp")).toBe(false);
    expect(isOfficialRobloxImageUrl("/local/game.png")).toBe(false);
  });

  it("selects the matching square icon and ordered landscape thumbnails", () => {
    expect(
      selectOfficialUniverseMedia(
        42,
        {
          data: [
            { targetId: 7, imageUrl: "https://tr.rbxcdn.com/wrong/512/512/Image/Png/noFilter" },
            {
              targetId: 42,
              imageUrl: "https://tr.rbxcdn.com/current-icon/512/512/Image/Png/noFilter",
              state: "Completed",
            },
          ],
        },
        {
          data: [
            {
              universeId: 42,
              thumbnails: [
                {
                  imageUrl: "https://tr.rbxcdn.com/primary-landscape/768/432/Image/Png/noFilter",
                  state: "Completed",
                  thumbnailType: "GameThumbnail",
                },
                {
                  imageUrl: "https://tr.rbxcdn.com/secondary-landscape/768/432/Image/Png/noFilter",
                  state: "Completed",
                },
              ],
            },
          ],
        }
      )
    ).toEqual({
      iconUrl: "https://tr.rbxcdn.com/current-icon/512/512/Image/Png/noFilter",
      iconRaw: {
        targetId: 42,
        imageUrl: "https://tr.rbxcdn.com/current-icon/512/512/Image/Png/noFilter",
        state: "Completed",
      },
      thumbnails: [
        {
          url: "https://tr.rbxcdn.com/primary-landscape/768/432/Image/Png/noFilter",
          state: "Completed",
          type: "GameThumbnail",
        },
        {
          url: "https://tr.rbxcdn.com/secondary-landscape/768/432/Image/Png/noFilter",
          state: "Completed",
          type: null,
        },
      ],
    });
  });

  it("requires both official image roles", () => {
    expect(
      hasOfficialUniverseMedia({
        icon_url: "https://tr.rbxcdn.com/icon/512/512/Image/Png/noFilter",
        thumbnail_urls: [{ url: "https://tr.rbxcdn.com/landscape/768/432/Image/Png/noFilter" }],
      })
    ).toBe(true);
    expect(
      hasOfficialUniverseMedia({
        icon_url: "https://media.bloxodes.com/article.webp",
        thumbnail_urls: [{ url: "https://tr.rbxcdn.com/landscape/768/432/Image/Png/noFilter" }],
      })
    ).toBe(false);
  });

  it("normalizes and de-duplicates stored thumbnails without changing order", () => {
    expect(
      normalizeOfficialUniverseThumbnails([
        "https://tr.rbxcdn.com/one.png",
        { imageUrl: "https://tr.rbxcdn.com/two.png", state: "Completed" },
        { url: "https://tr.rbxcdn.com/one.png" },
      ])
    ).toEqual([
      { url: "https://tr.rbxcdn.com/one.png", state: null, type: null },
      { url: "https://tr.rbxcdn.com/two.png", state: "Completed", type: null },
    ]);
  });
});
