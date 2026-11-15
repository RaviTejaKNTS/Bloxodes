import sharp from "sharp";

export const MAX_DECORATION_BYTES = 5 * 1024 * 1024;

export function isCatalogArtworkUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      /^(?:[a-z0-9-]+\.)*rbxcdn\.(?:com|net)$/.test(url.hostname);
  } catch { return false; }
}

/** Remote artwork is optional. Never follow redirects or buffer an unbounded body. */
export async function decoration(url: string): Promise<string | undefined> {
  if (!isCatalogArtworkUrl(url)) return undefined;
  try {
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(5000) });
    if (!response.ok || !response.body) { await response.body?.cancel(); return undefined; }
    if (Number(response.headers.get("content-length")) > MAX_DECORATION_BYTES) {
      await response.body.cancel(); return undefined;
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_DECORATION_BYTES) { await reader.cancel(); return undefined; }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const png = await sharp(Buffer.concat(chunks), { limitInputPixels: 40_000_000 })
      .resize(1200, 630, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    // Only remote decoration may fail open; catalog and dataset readers still throw.
    return undefined;
  }
}
