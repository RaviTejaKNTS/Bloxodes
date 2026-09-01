import { describe, expect, it } from "vitest";

import { calculateCenteredCropLoss, checkPromotionalImage, inspectImageHeader } from "../roblox-platform-tools/icon-thumbnail-checker";

describe("Roblox icon and thumbnail checker", () => {
  it("grades square icons independently from thumbnails", () => {
    const result = checkPromotionalImage({ width: 512, height: 512, bytes: 500_000, format: "png" });
    expect(result.icon.status).toBe("pass");
    expect(result.icon.format).toBe("unknown");
    expect(result.detailThumbnail.status).toBe("fail");
    expect(result.homePersonalization.status).toBe("fail");
  });

  it("grades ideal and smaller 16:9 thumbnails", () => {
    const ideal = checkPromotionalImage({ width: 1920, height: 1080, bytes: 2_500_000, format: "jpeg" });
    expect(ideal.detailThumbnail.status).toBe("pass");
    expect(ideal.homePersonalization.status).toBe("pass");
    expect(ideal.icon.status).toBe("fail");

    const small = checkPromotionalImage({ width: 1280, height: 720, bytes: 1_000_000, format: "png" });
    expect(small.detailThumbnail.status).toBe("warn");
    expect(small.homePersonalization.status).toBe("warn");
  });

  it("keeps the Home byte rule separate and exclusive", () => {
    const exact = checkPromotionalImage({ width: 1920, height: 1080, bytes: 3_000_000, format: "png" });
    expect(exact.detailThumbnail.fileSize).toBe("unknown");
    expect(exact.detailThumbnail.status).toBe("pass");
    expect(exact.homePersonalization.fileSize).toBe("fail");
    expect(exact.homePersonalization.status).toBe("fail");
  });

  it("fails unsupported thumbnail formats", () => {
    const result = checkPromotionalImage({ width: 1920, height: 1080, bytes: 800_000, format: "webp" });
    expect(result.detailThumbnail.format).toBe("fail");
    expect(result.homePersonalization.format).toBe("fail");
  });

  it("calculates centered crop loss", () => {
    const loss = calculateCenteredCropLoss(1920, 1200, 16, 9);
    expect(loss.axis).toBe("vertical");
    expect(loss.totalLossPercent).toBeCloseTo(10, 8);
    expect(loss.perSidePercent).toBeCloseTo(5, 8);
  });

  it("parses trusted PNG and GIF headers", () => {
    const png = new Uint8Array(24);
    png.set([137, 80, 78, 71, 13, 10, 26, 10]);
    new DataView(png.buffer).setUint32(16, 1920);
    new DataView(png.buffer).setUint32(20, 1080);
    expect(inspectImageHeader(png, "image.png")).toEqual({ format: "png", width: 1920, height: 1080 });

    const gif = new Uint8Array(12);
    gif.set(new TextEncoder().encode("GIF89a"));
    gif[6] = 0x00; gif[7] = 0x05; gif[8] = 0xd0; gif[9] = 0x02;
    expect(inspectImageHeader(gif, "image.gif")).toEqual({ format: "gif", width: 1280, height: 720 });
  });
});
