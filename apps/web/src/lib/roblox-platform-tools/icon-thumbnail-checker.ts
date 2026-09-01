export const PROMOTIONAL_IMAGE_RULES_VERIFIED_DATE = "2026-08-31";
export const ICON_MIN_SIZE = 512;
export const THUMBNAIL_IDEAL_WIDTH = 1920;
export const THUMBNAIL_IDEAL_HEIGHT = 1080;
export const HOME_PERSONALIZATION_MAX_BYTES_EXCLUSIVE = 3_000_000;
export const LOCAL_INSPECTION_MAX_BYTES = 20_000_000;
export const LOCAL_INSPECTION_MAX_PIXELS = 40_000_000;

export type DetectedImageFormat = "png" | "jpeg" | "gif" | "bmp" | "tga" | "webp" | "unknown";
export type CheckStatus = "pass" | "warn" | "fail" | "unknown";

export type ImageMetadata = {
  width: number;
  height: number;
  bytes: number;
  format: DetectedImageFormat;
};

export type ImageTargetResult = {
  status: Exclude<CheckStatus, "unknown">;
  aspect: CheckStatus;
  resolution: CheckStatus;
  format: CheckStatus;
  fileSize: CheckStatus;
  correction: string | null;
};

export type PromotionalImageCheck = {
  icon: ImageTargetResult;
  detailThumbnail: ImageTargetResult;
  homePersonalization: ImageTargetResult;
  isExactSixteenNine: boolean;
  reducedAspect: string;
  decimalAspect: number;
};

const THUMBNAIL_FORMATS = new Set<DetectedImageFormat>(["png", "jpeg", "gif", "bmp", "tga"]);

function gcd(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

function combineStatus(checks: CheckStatus[]): Exclude<CheckStatus, "unknown"> {
  if (checks.includes("fail")) return "fail";
  if (checks.includes("warn")) return "warn";
  return "pass";
}

export function checkPromotionalImage(metadata: ImageMetadata): PromotionalImageCheck {
  const { width, height, bytes, format } = metadata;
  const exactSixteenNine = width * 9 === height * 16;
  const square = width === height;
  const thumbnailFormat = THUMBNAIL_FORMATS.has(format) ? "pass" : "fail";
  const divisor = gcd(width, height);

  const iconAspect: CheckStatus = square ? "pass" : "fail";
  const iconResolution: CheckStatus = width >= ICON_MIN_SIZE && height >= ICON_MIN_SIZE ? "pass" : "fail";
  const iconChecks = [iconAspect, iconResolution];

  const detailAspect: CheckStatus = exactSixteenNine ? "pass" : "fail";
  const detailResolution: CheckStatus = exactSixteenNine && width >= THUMBNAIL_IDEAL_WIDTH && height >= THUMBNAIL_IDEAL_HEIGHT
    ? "pass"
    : exactSixteenNine
      ? "warn"
      : "fail";

  const homeResolution: CheckStatus = width === THUMBNAIL_IDEAL_WIDTH && height === THUMBNAIL_IDEAL_HEIGHT
    ? "pass"
    : exactSixteenNine
      ? "warn"
      : "fail";
  const homeFileSize: CheckStatus = bytes < HOME_PERSONALIZATION_MAX_BYTES_EXCLUSIVE ? "pass" : "fail";

  return {
    icon: {
      status: combineStatus(iconChecks),
      aspect: iconAspect,
      resolution: iconResolution,
      format: "unknown",
      fileSize: "unknown",
      correction: square && iconResolution === "pass" ? null : "Export a square version at 512 × 512 pixels or larger."
    },
    detailThumbnail: {
      status: combineStatus([thumbnailFormat, detailAspect, detailResolution]),
      aspect: detailAspect,
      resolution: detailResolution,
      format: thumbnailFormat,
      fileSize: "unknown",
      correction: exactSixteenNine
        ? detailResolution === "warn" ? "Use 1920 × 1080 pixels for Roblox's documented ideal." : null
        : "Export an exact 16:9 image. Roblox documents stretching other ratios to 16:9."
    },
    homePersonalization: {
      status: combineStatus([thumbnailFormat, detailAspect, homeResolution, homeFileSize]),
      aspect: detailAspect,
      resolution: homeResolution,
      format: thumbnailFormat,
      fileSize: homeFileSize,
      correction: homeFileSize === "fail"
        ? "Reduce the file below 3,000,000 bytes under this calculator's conservative interpretation."
        : !exactSixteenNine
          ? "Export an exact 16:9 version at the documented 1920 × 1080 size."
          : homeResolution === "warn"
            ? "Use exactly 1920 × 1080 pixels for the named personalization upload size."
            : null
    },
    isExactSixteenNine: exactSixteenNine,
    reducedAspect: `${width / divisor}:${height / divisor}`,
    decimalAspect: width / height
  };
}

export function calculateCenteredCropLoss(width: number, height: number, targetWidth: number, targetHeight: number): {
  axis: "horizontal" | "vertical" | "none";
  totalLossPercent: number;
  perSidePercent: number;
} {
  const sourceRatio = width / height;
  const targetRatio = targetWidth / targetHeight;
  if (Math.abs(sourceRatio - targetRatio) < Number.EPSILON) return { axis: "none", totalLossPercent: 0, perSidePercent: 0 };
  const totalLoss = sourceRatio > targetRatio
    ? 1 - (height * targetRatio) / width
    : 1 - (width / targetRatio) / height;
  return {
    axis: sourceRatio > targetRatio ? "horizontal" : "vertical",
    totalLossPercent: totalLoss * 100,
    perSidePercent: totalLoss * 50
  };
}

function readUint32BigEndian(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>> 0;
}

function readUint16LittleEndian(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

export function inspectImageHeader(bytes: Uint8Array, filename: string): {
  format: DetectedImageFormat;
  width: number | null;
  height: number | null;
} {
  if (bytes.length >= 24 && bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index])) {
    return { format: "png", width: readUint32BigEndian(bytes, 16), height: readUint32BigEndian(bytes, 20) };
  }
  const header = new TextDecoder("ascii").decode(bytes.slice(0, 12));
  if (header.startsWith("GIF87a") || header.startsWith("GIF89a")) {
    return { format: "gif", width: readUint16LittleEndian(bytes, 6), height: readUint16LittleEndian(bytes, 8) };
  }
  if (bytes.length >= 26 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { format: "bmp", width: Math.abs(view.getInt32(18, true)), height: Math.abs(view.getInt32(22, true)) };
  }
  if (bytes.length >= 12 && header.slice(0, 4) === "RIFF" && header.slice(8, 12) === "WEBP") {
    return { format: "webp", width: null, height: null };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1]!;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { format: "jpeg", height: (bytes[offset + 5]! << 8) | bytes[offset + 6]!, width: (bytes[offset + 7]! << 8) | bytes[offset + 8]! };
      }
      if (marker === 0xd9 || marker === 0xda) break;
      const segmentLength = (bytes[offset + 2]! << 8) | bytes[offset + 3]!;
      if (segmentLength < 2) break;
      offset += 2 + segmentLength;
    }
    return { format: "jpeg", width: null, height: null };
  }
  const extension = filename.toLowerCase().split(".").pop();
  if (extension === "tga" && bytes.length >= 18) {
    const imageType = bytes[2]!;
    const width = readUint16LittleEndian(bytes, 12);
    const height = readUint16LittleEndian(bytes, 14);
    if ([2, 3, 10, 11].includes(imageType) && width > 0 && height > 0) return { format: "tga", width, height };
  }
  return { format: "unknown", width: null, height: null };
}
