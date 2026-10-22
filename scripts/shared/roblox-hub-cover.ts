import { createHash } from "node:crypto";
import sharp from "sharp";

const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const types: Record<string, string> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp", avif: "image/avif" };

// Approval replaces only official-byte equality. Validate and return the same bytes' metadata.
export async function validateRobloxHubCover(bytes: Buffer, officialBytes: Buffer, approvedSha256?: string) {
  const sha256 = hash(bytes);
  if (approvedSha256 !== undefined) {
    if (approvedSha256.length !== 64 || !/^[a-f0-9]{64}$/i.test(approvedSha256)) throw new Error("--approved-hub-cover-sha256 must be exactly 64 hexadecimal characters.");
    if (sha256 !== approvedSha256.toLowerCase()) throw new Error(`hub.coverImage SHA256 ${sha256} does not match --approved-hub-cover-sha256. Review the exact local file again.`);
  } else if (sha256 !== hash(officialBytes)) {
    throw new Error("hub.coverImage differs from the current official thumbnail. Download it again or omit coverImage to use the official image.");
  }
  const invalid = "Hub cover must be a readable 768x432 PNG, JPEG, WebP or AVIF at most 1 MB. Replace hub.coverImage.";
  if (bytes.length > 1_000_000) throw new Error(invalid);
  try {
    const metadata = await sharp(bytes).metadata();
    const format = metadata.format === "heif" && metadata.compression === "av1" ? "avif" : metadata.format;
    if (!format || !types[format] || metadata.width !== 768 || metadata.height !== 432) throw new Error(invalid);
    // Metadata can survive truncated image data; require a full pixel decode as well.
    await sharp(bytes).stats();
    return { sha256, format, mime: types[format] };
  } catch {
    throw new Error(invalid);
  }
}
