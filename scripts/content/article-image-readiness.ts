import { readFile } from "node:fs/promises";
import path from "node:path";

import { classifyArticleImageSrc, findMarkdownImages } from "@/lib/article-media";

export type ArticleImageStatus = "candidate" | "verified" | "missing" | "accepted_missing";

export type ArticleImageEntry = {
  id: string;
  label: string;
  required: true;
  placement_heading: string;
  status: ArticleImageStatus;
  source_page_url?: string | null;
  original_image_url?: string | null;
  match_evidence?: string | null;
  rights_note?: string | null;
  alt?: string | null;
  uploaded_path?: string | null;
  public_url?: string | null;
  width?: number | null;
  height?: number | null;
  missing_reason?: string | null;
  acceptance_note?: string | null;
  search_queries?: string[] | null;
  searched_source_urls?: string[] | null;
};

export type ArticleImageManifest = {
  schema: 1;
  article_slug: string;
  visual_type: "locations" | "steps" | "npcs" | "puzzles" | "routes" | "collectibles" | "items" | "other";
  required: true;
  expected_count: number;
  entries: ArticleImageEntry[];
};

export type ArticleImageReadinessSummary = {
  expected: number;
  verified: number;
  uploaded: number;
  inserted: number;
  missing: number;
  acceptedMissing: number;
};

export type ArticleImageReadinessResult = {
  ready: boolean;
  errors: string[];
  summary: ArticleImageReadinessSummary;
};

type ArticleFinalForImages = {
  slug: string;
  content_md: string;
};

const VALID_STATUSES = new Set<ArticleImageStatus>([
  "candidate",
  "verified",
  "missing",
  "accepted_missing",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasText(value: unknown, minimum = 1): value is string {
  return typeof value === "string" && value.trim().length >= minimum;
}

function isHttpUrl(value: unknown): value is string {
  if (!hasText(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function distinctTextCount(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return new Set(
    value
      .filter((item): item is string => hasText(item, 4))
      .map((item) => item.trim().toLowerCase())
  ).size;
}

function distinctHttpUrlCount(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return new Set(
    value
      .filter((item): item is string => isHttpUrl(item))
      .map((item) => new URL(item).toString())
  ).size;
}

function normalizeHeading(value: string): string {
  return value
    .trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function sectionForHeading(content: string, heading: string): string | null {
  const lines = content.split(/\r?\n/);
  const target = normalizeHeading(heading);

  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(#{2,6})\s+(.+?)\s*$/.exec(lines[index] ?? "");
    if (!match || normalizeHeading(match[2] ?? "") !== target) continue;

    const level = match[1]!.length;
    let end = lines.length;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const next = /^(#{2,6})\s+/.exec(lines[cursor] ?? "");
      if (next && next[1]!.length <= level) {
        end = cursor;
        break;
      }
    }
    return lines.slice(index, end).join("\n");
  }

  return null;
}

export function parseArticleImageManifest(value: unknown, label = "media.json"): ArticleImageManifest {
  if (!isRecord(value)) throw new Error(`${label} must contain a JSON object`);
  if (value.schema !== 1) throw new Error(`${label} schema must be 1`);
  if (!hasText(value.article_slug)) throw new Error(`${label} article_slug is required`);
  if (!hasText(value.visual_type)) throw new Error(`${label} visual_type is required`);
  if (value.required !== true) throw new Error(`${label} required must be true`);
  if (!Number.isInteger(value.expected_count) || Number(value.expected_count) < 1) {
    throw new Error(`${label} expected_count must be a positive integer`);
  }
  if (!Array.isArray(value.entries)) throw new Error(`${label} entries must be an array`);
  for (const [index, entry] of value.entries.entries()) {
    if (!isRecord(entry)) throw new Error(`${label} entries[${index}] must be an object`);
    if (entry.required !== true) throw new Error(`${label} entries[${index}].required must be true`);
  }

  return value as unknown as ArticleImageManifest;
}

export async function readArticleImageManifest(filePath: string): Promise<ArticleImageManifest> {
  const resolved = path.resolve(process.cwd(), filePath);
  const parsed = JSON.parse(await readFile(resolved, "utf8")) as unknown;
  return parseArticleImageManifest(parsed, filePath);
}

export function checkArticleImageReadiness(params: {
  manifest: ArticleImageManifest;
  finalJson: ArticleFinalForImages;
}): ArticleImageReadinessResult {
  const { manifest, finalJson } = params;
  const errors: string[] = [];
  const images = findMarkdownImages(finalJson.content_md);
  const ids = new Set<string>();
  const publicUrls = new Set<string>();
  let verified = 0;
  let uploaded = 0;
  let inserted = 0;
  let missing = 0;
  let acceptedMissing = 0;

  if (manifest.article_slug !== finalJson.slug) {
    errors.push(`article_slug ${manifest.article_slug} does not match final slug ${finalJson.slug}`);
  }
  if (manifest.expected_count !== manifest.entries.length) {
    errors.push(
      `expected_count is ${manifest.expected_count}, but the manifest contains ${manifest.entries.length} entries`
    );
  }

  for (const [index, entry] of manifest.entries.entries()) {
    const label = entry.label?.trim() || `entry ${index + 1}`;

    if (!hasText(entry.id) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)) {
      errors.push(`${label}: id must be a lowercase hyphenated slug`);
    } else if (ids.has(entry.id)) {
      errors.push(`${label}: duplicate id ${entry.id}`);
    } else {
      ids.add(entry.id);
    }
    if (!hasText(entry.label)) errors.push(`${label}: label is required`);
    if (entry.required !== true) errors.push(`${label}: required must be true`);
    if (!hasText(entry.placement_heading)) errors.push(`${label}: placement_heading is required`);
    if (!VALID_STATUSES.has(entry.status)) errors.push(`${label}: invalid status ${String(entry.status)}`);

    if (entry.status === "accepted_missing") {
      acceptedMissing += 1;
      if (!hasText(entry.missing_reason, 8)) {
        errors.push(`${label}: accepted_missing needs a specific missing_reason`);
      }
      if (!hasText(entry.acceptance_note, 8)) {
        errors.push(`${label}: accepted_missing needs an explicit acceptance_note`);
      }
      if (distinctTextCount(entry.search_queries) < 2) {
        errors.push(`${label}: accepted_missing needs at least two distinct search_queries`);
      }
      if (distinctHttpUrlCount(entry.searched_source_urls) < 2) {
        errors.push(`${label}: accepted_missing needs at least two distinct searched_source_urls`);
      }
      continue;
    }

    if (entry.status === "missing") {
      missing += 1;
      if (!hasText(entry.missing_reason, 8)) errors.push(`${label}: missing needs a specific missing_reason`);
      errors.push(`${label}: required visual is still missing`);
      continue;
    }

    if (entry.status === "candidate") {
      errors.push(`${label}: required visual is still only a candidate`);
      continue;
    }

    verified += 1;
    if (!isHttpUrl(entry.source_page_url)) errors.push(`${label}: source_page_url must be an HTTP URL`);
    if (!isHttpUrl(entry.original_image_url)) errors.push(`${label}: original_image_url must be an HTTP URL`);
    if (!hasText(entry.match_evidence, 12)) errors.push(`${label}: match_evidence is too weak`);
    if (!hasText(entry.rights_note, 8)) errors.push(`${label}: rights_note is required`);
    if (!hasText(entry.alt, 8)) errors.push(`${label}: useful alt text is required`);

    const publicUrl = hasText(entry.public_url) ? entry.public_url.trim() : "";
    const uploadedPath = hasText(entry.uploaded_path) ? entry.uploaded_path.trim() : "";
    const isCanonicalLocalAsset =
      manifest.visual_type === "items" &&
      publicUrl.startsWith("/") &&
      classifyArticleImageSrc(publicUrl, manifest.article_slug).ok;
    if (!publicUrl || (!isHttpUrl(publicUrl) && !isCanonicalLocalAsset)) {
      errors.push(`${label}: verified visual has no hosted public_url`);
    } else if (isHttpUrl(publicUrl)) {
      uploaded += 1;
      const classified = classifyArticleImageSrc(publicUrl, manifest.article_slug);
      if (!classified.ok) errors.push(`${label}: public_url is not Bloxodes-hosted (${classified.reason})`);
      if (publicUrls.has(publicUrl)) errors.push(`${label}: public_url is reused by another visual`);
      publicUrls.add(publicUrl);
    }
    if (!isCanonicalLocalAsset && (!uploadedPath.startsWith(`articles/${manifest.article_slug}/sources/`) || !uploadedPath.endsWith(".webp"))) {
      errors.push(`${label}: uploaded_path must be articles/${manifest.article_slug}/sources/<name>.webp`);
    }
    if (!Number.isInteger(entry.width) || Number(entry.width) < 1) errors.push(`${label}: width is required`);
    if (!Number.isInteger(entry.height) || Number(entry.height) < 1) errors.push(`${label}: height is required`);

    const placed = images.find((image) => image.src === publicUrl);
    if (!placed) {
      errors.push(`${label}: hosted image is not inserted in content_md`);
      continue;
    }
    inserted += 1;
    if (hasText(entry.alt) && placed.alt.trim() !== entry.alt.trim()) {
      errors.push(`${label}: content_md alt text does not match media.json`);
    }

    const section = sectionForHeading(finalJson.content_md, entry.placement_heading);
    if (!section) {
      errors.push(`${label}: placement heading not found: ${entry.placement_heading}`);
    } else if (!section.includes(publicUrl)) {
      errors.push(`${label}: image is not inside its ${entry.placement_heading} section`);
    }
  }

  const summary = {
    expected: manifest.expected_count,
    verified,
    uploaded,
    inserted,
    missing,
    acceptedMissing,
  };

  return { ready: errors.length === 0, errors, summary };
}

export function assertArticleImageReadiness(result: ArticleImageReadinessResult, label: string): void {
  if (result.ready) return;
  throw new Error(
    `${label} image readiness failed:\n${result.errors.map((error) => `- ${error}`).join("\n")}`
  );
}
