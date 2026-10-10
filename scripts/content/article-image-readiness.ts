import { readFile } from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";
import { lexer, walkTokens } from "marked";

export function normalizeImageAlt(value: string): string {
  // Decode entities as text, never interpret literal angle brackets as markup.
  return load(`<span>${value.replace(/</g, "&lt;")}</span>`)("span").text().replace(/\s+/g, " ").trim();
}

import { classifyArticleImageSrc, findMarkdownImages, findRawHtmlArticleImages } from "@/lib/article-media";
import { extractArticleBlockImageRefs, stripArticleContentBlocks } from "@/lib/article-blocks";

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
  rejected_urls?: string[];
  width?: number | null;
  height?: number | null;
  missing_reason?: string | null;
  acceptance_note?: string | null;
  search_queries?: string[] | null;
  searched_source_urls?: string[] | null;
  availability_failure?: "transfer" | "inspection";
};

export type ArticleImageManifest = {
  schema: 1;
  article_slug: string;
  visual_type: "locations" | "steps" | "npcs" | "puzzles" | "routes" | "collectibles" | "items" | "other";
  required: true;
  expected_count: number;
  entries: ArticleImageEntry[];
};

export function acceptArticleImageOmission(entry: ArticleImageEntry, summary: string) {
  entry.rejected_urls = [...new Set([...(entry.rejected_urls ?? []), entry.public_url, entry.original_image_url].filter((url): url is string => Boolean(url)))];
  entry.public_url = null;
  entry.uploaded_path = null;
  entry.status = "accepted_missing";
  entry.missing_reason ||= summary;
  entry.acceptance_note = summary;
}

export function findArticleImages(content: string) {
  return [
    ...findMarkdownImages(stripArticleContentBlocks(content)),
    ...extractArticleBlockImageRefs(content),
  ];
}

export function canonicalArticleMediaUrl(value: string): string {
  return value.trim()
    .replaceAll("https://bmwksaykcsndsvgspapz.supabase.co/storage/v1/object/public/", "https://media.bloxodes.com/storage/v1/object/public/")
    .replaceAll("https://database.bloxodes.com/storage/v1/object/public/", "https://media.bloxodes.com/storage/v1/object/public/");
}

export function usedVerifiedArticleImages(manifest: ArticleImageManifest, content: string): ArticleImageEntry[] {
  const usedUrls = new Set(findArticleImages(content).map(image => canonicalArticleMediaUrl(image.src)));
  return manifest.entries.filter(entry => entry.status === "verified" && usedUrls.has(canonicalArticleMediaUrl(entry.public_url ?? "")));
}

export function articleImagePlacementSections(content: string, src: string): string[][] {
  const sections: string[][] = [];
  const headings: Array<{ depth: number; text: string }> = [];
  walkTokens(lexer(content), token => {
    if (token.type === "heading") {
      while (headings.length && headings[headings.length - 1]!.depth >= token.depth) headings.pop();
      if (token.depth === 1) headings.length = 0;
      else headings.push({ depth: token.depth, text: token.text });
    }
    if (token.type === "image" && token.href.trim() === src) sections.push(headings.map(heading => heading.text));
    if (token.type === "code") {
      for (const image of extractArticleBlockImageRefs(token.raw)) {
        if (image.src === src) sections.push(headings.map(heading => heading.text));
      }
    }
  });
  return sections;
}

export function articleImagePlacementHeadings(content: string, src: string): Array<string | null> {
  return articleImagePlacementSections(content, src).map(headings => headings[headings.length - 1] ?? null);
}

export function articleImagePlacementHeading(content: string, src: string): string | null {
  return articleImagePlacementHeadings(content, src)[0] ?? null;
}

export type ArticleImageReadinessSummary = {
  expected: number;
  verified: number;
  uploaded: number;
  inserted: number;
  unused: number;
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
  env?: NodeJS.ProcessEnv;
}): ArticleImageReadinessResult {
  const { manifest, finalJson, env } = params;
  const errors: string[] = [];
  const images = findArticleImages(finalJson.content_md);
  const approvedUrls = new Set(manifest.entries.filter(entry => entry.status === "verified").map(entry => entry.public_url?.trim()).filter(Boolean));
  const rejectedUrls = new Set(manifest.entries.filter(entry => entry.status !== "verified").flatMap(entry => [entry.public_url, entry.original_image_url, ...(entry.rejected_urls ?? [])]).filter(Boolean));
  for (const image of images) {
    if (rejectedUrls.has(image.src)) errors.push(`content_md references an omitted or rejected image: ${image.src}`);
    if (!approvedUrls.has(image.src)) errors.push(`content_md image has no verified manifest entry: ${image.src}`);
    const entry = manifest.entries.find(entry => entry.status === "verified" && entry.public_url?.trim() === image.src);
    if (entry?.alt && normalizeImageAlt(image.alt) !== normalizeImageAlt(entry.alt)) errors.push(`content_md image alt text does not match its verified manifest entry: ${image.src}`);
  }
  if (findRawHtmlArticleImages(stripArticleContentBlocks(finalJson.content_md)).length) errors.push("content_md contains unsupported raw HTML images; use verified Markdown or structured-block images");
  const ids = new Set<string>();
  const publicUrls = new Set<string>();
  let verified = 0;
  let uploaded = 0;
  let inserted = 0;
  let unused = 0;
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
      const unavailable = ["transfer", "inspection"].includes(entry.availability_failure ?? "");
      if (!unavailable && distinctTextCount(entry.search_queries) < 2) {
        errors.push(`${label}: accepted_missing needs at least two distinct search_queries`);
      }
      if (!unavailable && distinctHttpUrlCount(entry.searched_source_urls) < 2) {
        errors.push(`${label}: accepted_missing needs at least two distinct searched_source_urls`);
      }
      continue;
    }

    if (entry.status === "missing") {
      missing += 1;
      if (!hasText(entry.missing_reason, 8)) errors.push(`${label}: missing needs a specific missing_reason`);
      if (!["transfer", "inspection"].includes(entry.availability_failure ?? "") || !hasText(entry.acceptance_note, 8)) {
        errors.push(`${label}: required visual is still missing`);
      }
      continue;
    }

    if (entry.status === "candidate") {
      errors.push(`${label}: required visual is still only a candidate`);
      continue;
    }

    verified += 1;
    const publicUrl = hasText(entry.public_url) ? entry.public_url.trim() : "";
    const placed = images.filter(image => image.src === publicUrl);
    if (!placed.length) unused += 1;
    if (!isHttpUrl(entry.source_page_url)) errors.push(`${label}: source_page_url must be an HTTP URL`);
    if (!isHttpUrl(entry.original_image_url)) errors.push(`${label}: original_image_url must be an HTTP URL`);
    if (!hasText(entry.match_evidence, 12)) errors.push(`${label}: match_evidence is too weak`);
    if (!hasText(entry.rights_note, 8)) errors.push(`${label}: rights_note is required`);
    if (!hasText(entry.alt, 8)) errors.push(`${label}: useful alt text is required`);

    const uploadedPath = hasText(entry.uploaded_path) ? entry.uploaded_path.trim() : "";
    const isCanonicalLocalAsset =
      manifest.visual_type === "items" &&
      publicUrl.startsWith("/") &&
      classifyArticleImageSrc(publicUrl, manifest.article_slug, env).ok;
    if (!publicUrl || (!isHttpUrl(publicUrl) && !isCanonicalLocalAsset)) {
      errors.push(`${label}: verified visual has no hosted public_url`);
    } else if (isHttpUrl(publicUrl)) {
      uploaded += 1;
      const classified = classifyArticleImageSrc(publicUrl, manifest.article_slug, env);
      // Unused development assets retain their URL when the used assets are promoted.
      if (placed.length && !classified.ok) errors.push(`${label}: public_url is not Bloxodes-hosted (${classified.reason})`);
      if (publicUrls.has(publicUrl)) errors.push(`${label}: public_url is reused by another visual`);
      publicUrls.add(publicUrl);
    }
    if (!isCanonicalLocalAsset && (!uploadedPath.startsWith(`articles/${manifest.article_slug}/sources/`) || !uploadedPath.endsWith(".webp"))) {
      errors.push(`${label}: uploaded_path must be articles/${manifest.article_slug}/sources/<name>.webp`);
    }
    if (!Number.isInteger(entry.width) || Number(entry.width) < 1) errors.push(`${label}: width is required`);
    if (!Number.isInteger(entry.height) || Number(entry.height) < 1) errors.push(`${label}: height is required`);

    if (!placed.length) continue;
    inserted += 1;
    const sections = articleImagePlacementSections(finalJson.content_md, publicUrl);
    if (sections.length !== placed.length || sections.some(headings => !headings.length)) {
      errors.push(`${label}: image is not inside a heading section for every occurrence`);
    }
    if (!sections.some(headings => headings.some(heading => normalizeHeading(heading) === normalizeHeading(entry.placement_heading)))) {
      errors.push(`${label}: image is not inside its ${entry.placement_heading} section`);
    }
  }

  const summary = {
    expected: manifest.expected_count,
    verified,
    uploaded,
    inserted,
    unused,
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
