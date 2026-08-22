import { readFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { toMediaPublicUrl } from "./storage-public-url";

export type ArticleCoverStorage = {
  upload(
    path: string,
    body: Buffer,
    options: { contentType: string; upsert: boolean },
  ): Promise<{ error: { message: string } | null }>;
  getPublicUrl(path: string): { data: { publicUrl: string } };
};

export function normalizeCoverOverlayTitle(value: string | null | undefined, limit = 70): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > limit ? `${cleaned.slice(0, limit - 1)}…` : cleaned;
}

function escapeForSvg(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function pickOverlayFontSize(lines: string[]): number {
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
  let base: number;
  if (longest <= 10) base = 104;
  else if (longest <= 16) base = 94;
  else if (longest <= 22) base = 82;
  else if (longest <= 28) base = 70;
  else if (longest <= 34) base = 62;
  else base = 52;

  const linePenalty = Math.max(0, lines.length - 2) * 6;
  return Math.max(44, base - linePenalty);
}

function wrapOverlayLines(text: string): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!words.length) return [];

  const length = words.join(" ").length;
  const maxLine = length > 80 ? 24 : length > 60 ? 20 : length > 40 ? 18 : 16;
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > maxLine) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function coverFileBase(value: string | undefined, slug: string): string {
  return (
    (value ?? slug)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/(^-|-$)/g, "") || slug
  );
}

export function articleCoverStoragePath(slug: string, fileBase?: string): string {
  return `articles/${slug}/${coverFileBase(fileBase, slug)}-cover.webp`;
}

export function articleCoverPublicUrl(storage: ArticleCoverStorage, slug: string, fileBase?: string): string {
  return toMediaPublicUrl(storage.getPublicUrl(articleCoverStoragePath(slug, fileBase)).data.publicUrl) ?? "";
}

export async function createEditedArticleCover(params: {
  imageUrl?: string | null;
  sourceFile?: string | null;
  slug: string;
  fileBase?: string;
  overlayTitle?: string | null;
  storage: ArticleCoverStorage | null;
}): Promise<string | null> {
  if (!params.storage) return null;
  if (!params.imageUrl && !params.sourceFile) return null;

  try {
    const source = params.sourceFile
      ? await readFile(path.resolve(process.cwd(), params.sourceFile))
      : await fetchSourceImage(params.imageUrl!);
    const overlayText = normalizeCoverOverlayTitle(params.overlayTitle);
    const overlayLines = overlayText ? wrapOverlayLines(overlayText) : [];
    const fontSize = overlayLines.length ? pickOverlayFontSize(overlayLines) : 0;
    const lineHeight = fontSize ? Math.round(fontSize * 1.2) : 0;
    const startY = fontSize ? Math.round(337.5 - ((overlayLines.length - 1) * lineHeight) / 2) : 0;
    const textBlock =
      overlayLines.length && fontSize
        ? `<text x="600" y="${startY}" text-anchor="middle" fill="#f8f9fb" font-size="${fontSize}" font-family="Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-weight="800" font-style="italic" letter-spacing="1.2" dominant-baseline="hanging">${overlayLines
            .map((line, index) => `<tspan x="600" dy="${index === 0 ? 0 : lineHeight}">${escapeForSvg(line)}</tspan>`)
            .join("")}</text>`
        : "";
    const svgOverlay = Buffer.from(
      `<svg width="1200" height="675" xmlns="http://www.w3.org/2000/svg" role="presentation"><rect x="0" y="0" width="1200" height="675" fill="rgba(0,0,0,0.78)"/>${textBlock}</svg>`,
    );
    const cover = await sharp(source)
      .resize(1200, 675, { fit: "cover", position: "attention" })
      .composite([{ input: svgOverlay, blend: "over" }])
      .webp({ quality: 90, effort: 4 })
      .toBuffer();
    const objectPath = articleCoverStoragePath(params.slug, params.fileBase);
    const { error } = await params.storage.upload(objectPath, cover, {
      contentType: "image/webp",
      upsert: true,
    });
    if (error) throw new Error(error.message);
    return articleCoverPublicUrl(params.storage, params.slug, params.fileBase);
  } catch (error) {
    console.warn(
      `Unable to create edited cover for ${params.slug}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

async function fetchSourceImage(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 Bloxodes article cover generator",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
