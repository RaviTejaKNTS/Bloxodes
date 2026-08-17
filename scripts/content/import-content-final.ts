import "../shared/load-env";

import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  pickEligibleArticleAuthorId,
  type ArticleAuthorCandidate
} from "../shared/article-author-selection";
import { assertEditorialSlug } from "../shared/editorial-slugs";
import { assertCanonicalMediaUrls, toMediaPublicUrl } from "../shared/storage-public-url";

type CliOptions = {
  files: string[];
  dryRun: boolean;
  allowProd: boolean;
};

type ArticleFinal = {
  title: string;
  slug: string;
  meta_description?: string | null;
  content_md: string;
  cover_image?: string | null;
  author_id?: string | null;
  universe_id?: number | null;
  tags?: string[];
  sources?: string[];
  faq_json?: ArticleFaqEntry[] | null;
  is_published?: boolean;
};

type ArticleFaqEntry = {
  q: string;
  a: string;
};

type SupabaseAdminClient = ReturnType<typeof supabaseAdmin>;

const SUPABASE_MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET;
const PRODUCTION_MEDIA_ORIGIN = "https://media.bloxodes.com";
const LOCAL_URL_PATTERN = /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i;

let cachedAuthors: ArticleAuthorCandidate[] | null = null;

type ChecklistFinal = {
  page: {
    universe_id: number;
    slug: string;
    title: string;
    seo_title?: string | null;
    seo_description?: string | null;
    description_md?: string | null;
    is_public?: boolean;
  };
  items: Array<{
    section_code: string;
    title: string;
    description?: string | null;
    is_required?: boolean;
  }>;
};

type LegacyChecklistFinal = {
  checklist_pages: ChecklistFinal["page"];
  checklist_items: ChecklistFinal["items"];
};

type QuizFinal = {
  page: {
    universe_id?: number | null;
    code: string;
    title: string;
    description_md?: string | null;
    seo_title?: string | null;
    seo_description?: string | null;
    is_published?: boolean;
  };
  quizData?: unknown;
};

function printUsage() {
  console.log(`Usage: npm run import:content-final -- --file <final.json> [--file <final.json>...] [--dry-run] [--allow-prod]`);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    files: [],
    dryRun: false,
    allowProd: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "-h":
      case "--help":
        printUsage();
        process.exit(0);
      case "--file": {
        const value = argv[i + 1];
        if (!value) throw new Error("Missing value for --file");
        options.files.push(value);
        i += 1;
        break;
      }
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--allow-prod":
        options.allowProd = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!options.files.length) {
    throw new Error("At least one --file is required");
  }

  return options;
}

async function readJson(filePath: string): Promise<unknown> {
  const resolved = path.resolve(process.cwd(), filePath);
  const raw = await readFile(resolved, "utf8");
  return JSON.parse(raw);
}

function wordCount(markdown: string): number {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/\[[^\]]+\]\([^)]+\)/g, " ")
    .replace(/[#>*_\-|]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

function isArticleFinal(value: unknown): value is ArticleFinal {
  const candidate = value as Partial<ArticleFinal>;
  return Boolean(candidate?.slug && candidate?.title && candidate?.content_md);
}

function normalizeFaqJson(value: unknown, label: string): ArticleFaqEntry[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error(`${label} faq_json must be an array`);

  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`${label} faq_json[${index}] must be an object`);
    }

    const candidate = entry as { q?: unknown; a?: unknown };
    const q = typeof candidate.q === "string" ? candidate.q.trim() : "";
    const a = typeof candidate.a === "string" ? candidate.a.trim() : "";
    if (!q || !a) throw new Error(`${label} faq_json[${index}] must include non-empty q and a strings`);
    return { q, a };
  });
}

function isChecklistFinal(value: unknown): value is ChecklistFinal {
  const candidate = value as Partial<ChecklistFinal>;
  return Boolean(candidate?.page?.slug && candidate?.page?.title && Array.isArray(candidate.items));
}

function isLegacyChecklistFinal(value: unknown): value is LegacyChecklistFinal {
  const candidate = value as Partial<LegacyChecklistFinal>;
  return Boolean(
    candidate?.checklist_pages?.slug &&
      candidate?.checklist_pages?.title &&
      Array.isArray(candidate.checklist_items)
  );
}

function normalizeChecklistFinal(finalJson: ChecklistFinal | LegacyChecklistFinal): ChecklistFinal {
  if ("page" in finalJson) return finalJson;
  return {
    page: finalJson.checklist_pages,
    items: finalJson.checklist_items
  };
}

function isQuizFinal(value: unknown): value is QuizFinal {
  const candidate = value as Partial<QuizFinal>;
  return Boolean(candidate?.page?.code && candidate?.page?.title && "quizData" in candidate);
}

function normalizeThumbnailUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (entry && typeof entry === "object" && "url" in entry) {
        const url = (entry as { url?: unknown }).url;
        return typeof url === "string" ? url : null;
      }
      return null;
    })
    .filter((url): url is string => typeof url === "string" && url.trim().length > 0);
}

function pickRandom<T>(items: T[]): T | null {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

async function pickAuthorId(sb: SupabaseAdminClient, preferredAuthorId?: string | null): Promise<string> {
  if (!cachedAuthors) {
    const { data, error } = await sb.from("authors").select("id,name,slug");
    if (error) throw new Error(`Unable to load eligible article authors: ${error.message}`);
    cachedAuthors = (data ?? []) as ArticleAuthorCandidate[];
  }

  return pickEligibleArticleAuthorId(cachedAuthors, { preferredAuthorId });
}

async function pickUniverseCoverImage(sb: SupabaseAdminClient, universeId: number | null | undefined): Promise<string | null> {
  if (!universeId || !Number.isFinite(universeId)) return null;

  const { data, error } = await sb
    .from("roblox_universes")
    .select("thumbnail_urls, icon_url")
    .eq("universe_id", universeId)
    .maybeSingle();

  if (error) {
    console.warn(`Unable to load universe thumbnail for ${universeId}: ${error.message}`);
    return null;
  }

  const thumbs = normalizeThumbnailUrls((data as { thumbnail_urls?: unknown } | null)?.thumbnail_urls);
  const iconUrl = (data as { icon_url?: unknown } | null)?.icon_url;
  const candidates = thumbs.length ? thumbs : typeof iconUrl === "string" && iconUrl.trim() ? [iconUrl] : [];

  return pickRandom(candidates);
}

function escapeForSvg(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeOverlayTitle(value: string | null | undefined, limit = 70): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > limit ? `${cleaned.slice(0, limit - 1)}...` : cleaned;
}

function coverOverlayTitle(title: string): string {
  const cleaned = title
    .replace(/^slime rng\s+/i, "")
    .replace(/\s*:\s*.*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return normalizeOverlayTitle(cleaned || title) ?? "Roblox Guide";
}

function pickOverlayFontSize(lines: string[]): number {
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
  if (longest <= 10) return 104;
  if (longest <= 16) return 94;
  if (longest <= 22) return 82;
  if (longest <= 28) return 70;
  if (longest <= 34) return 62;
  return 52;
}

function wrapOverlayLines(text: string): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= 18) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function isEditedArticleCover(value: string | null | undefined, slug: string): boolean {
  if (!value) return false;
  return value.includes(`/articles/${slug}/`) || value.includes(`/article-covers/`);
}

function normalizeArticleCover(value: string | null | undefined): string | null {
  const normalized = toMediaPublicUrl(value?.trim() || null);
  return normalized?.trim() || null;
}

function assertProductionArticleMedia(params: {
  slug: string;
  coverImage: string | null;
  contentMd: string;
  isPublished: boolean;
}) {
  if (process.env.NODE_ENV !== "production" || !params.isPublished) return;

  const configuredMediaBase = process.env.SUPABASE_MEDIA_PUBLIC_URL?.trim();
  if (!configuredMediaBase) {
    throw new Error(
      `Refusing to publish article ${params.slug}: SUPABASE_MEDIA_PUBLIC_URL must be ${PRODUCTION_MEDIA_ORIGIN}`
    );
  }

  let configuredOrigin: string;
  try {
    configuredOrigin = new URL(configuredMediaBase).origin;
  } catch {
    throw new Error(
      `Refusing to publish article ${params.slug}: SUPABASE_MEDIA_PUBLIC_URL is not a valid URL`
    );
  }

  if (configuredOrigin !== PRODUCTION_MEDIA_ORIGIN) {
    throw new Error(
      `Refusing to publish article ${params.slug}: SUPABASE_MEDIA_PUBLIC_URL must use ${PRODUCTION_MEDIA_ORIGIN}`
    );
  }

  if (!params.coverImage) {
    throw new Error(`Refusing to publish article ${params.slug}: cover_image is required`);
  }
  if (LOCAL_URL_PATTERN.test(params.coverImage) || LOCAL_URL_PATTERN.test(params.contentMd)) {
    throw new Error(`Refusing to publish article ${params.slug}: local URLs cannot be saved to production`);
  }

  let coverUrl: URL;
  try {
    coverUrl = new URL(params.coverImage);
  } catch {
    throw new Error(`Refusing to publish article ${params.slug}: cover_image must be an absolute URL`);
  }
  if (coverUrl.protocol !== "https:") {
    throw new Error(`Refusing to publish article ${params.slug}: cover_image must use HTTPS`);
  }
}

async function verifyProductionArticleMedia(params: {
  slug: string;
  sb: SupabaseAdminClient;
}) {
  if (process.env.NODE_ENV !== "production") return;

  const { data, error } = await params.sb
    .from("articles")
    .select("cover_image,content_md,is_published")
    .eq("slug", params.slug)
    .single();
  if (error || !data) {
    throw new Error(`Failed to read back article ${params.slug}: ${error?.message ?? "no row returned"}`);
  }

  const row = data as { cover_image?: string | null; content_md?: string | null; is_published?: boolean | null };
  if (row.is_published !== true) return;
  const coverImage = normalizeArticleCover(row.cover_image);
  assertProductionArticleMedia({
    slug: params.slug,
    coverImage,
    contentMd: row.content_md ?? "",
    isPublished: true,
  });

  // The assertion above guarantees a published production article has a cover.
  if (!coverImage) return;
  const response = await fetch(coverImage, {
    headers: {
      Range: "bytes=0-0",
      "User-Agent": "Bloxodes article release check",
    },
  });
  if (!response.ok) {
    throw new Error(`Article ${params.slug} cover returned HTTP ${response.status}: ${coverImage}`);
  }
  await response.body?.cancel();
}

async function uploadEditedArticleCover(params: {
  imageUrl: string;
  slug: string;
  title: string;
  sb: SupabaseAdminClient;
}): Promise<string | null> {
  if (!SUPABASE_MEDIA_BUCKET) {
    console.warn("SUPABASE_MEDIA_BUCKET is not configured; falling back to the raw universe thumbnail.");
    return null;
  }

  try {
    const response = await fetch(params.imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
      }
    });

    if (!response.ok) {
      console.warn(`Unable to download universe thumbnail for ${params.slug}: ${response.statusText}`);
      return null;
    }

    const source = Buffer.from(await response.arrayBuffer());
    const overlayText = coverOverlayTitle(params.title);
    const overlayLines = wrapOverlayLines(overlayText);
    const fontSize = pickOverlayFontSize(overlayLines);
    const lineHeight = Math.round(fontSize * 1.2);
    const startY = Math.round(337.5 - ((overlayLines.length - 1) * lineHeight) / 2);
    const textBlock = overlayLines
      .map((line, index) => `<tspan x="600" dy="${index === 0 ? 0 : lineHeight}">${escapeForSvg(line)}</tspan>`)
      .join("");

    const overlay = Buffer.from(
      `<svg width="1200" height="675" xmlns="http://www.w3.org/2000/svg" role="presentation">
        <rect x="0" y="0" width="1200" height="675" fill="rgba(0,0,0,0.78)"/>
        <text x="600" y="${startY}" text-anchor="middle" fill="#f8f9fb" font-size="${fontSize}" font-family="Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-weight="800" font-style="italic" letter-spacing="1.2" dominant-baseline="hanging">${textBlock}</text>
      </svg>`.replace(/\s+/g, " ")
    );

    const cover = await sharp(source)
      .resize(1200, 675, { fit: "cover", position: "attention" })
      .composite([{ input: overlay, blend: "over" }])
      .webp({ quality: 90, effort: 4 })
      .toBuffer();

    const storagePath = `articles/${params.slug}/${params.slug}-cover.webp`;
    const storage = params.sb.storage.from(SUPABASE_MEDIA_BUCKET);
    const { error } = await storage.upload(storagePath, cover, {
      contentType: "image/webp",
      upsert: true,
    });

    if (error) {
      console.warn(`Unable to upload edited cover for ${params.slug}: ${error.message}`);
      return null;
    }

    return toMediaPublicUrl(storage.getPublicUrl(storagePath).data.publicUrl);
  } catch (error) {
    console.warn(`Unable to create edited cover for ${params.slug}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function injectCoverImageBeforeFirstH2(content: string, imageUrl: string, altText: string): string {
  const firstH2Index = content.search(/^## /m);
  const beforeFirstH2 = firstH2Index === -1 ? content : content.slice(0, firstH2Index);
  if (/!\[[^\]]*]\([^)]+\)/.test(beforeFirstH2)) return content;

  const imageLine = `![${altText}](${imageUrl})`;
  if (firstH2Index === -1) return `${content.trim()}\n\n${imageLine}`;
  return `${content.slice(0, firstH2Index).trim()}\n\n${imageLine}\n\n${content.slice(firstH2Index).trimStart()}`;
}

async function importArticle(finalJson: ArticleFinal, dryRun: boolean) {
  const sb = supabaseAdmin();
  const slug = finalJson.slug.trim().toLowerCase();
  const isPublished = finalJson.is_published ?? true;
  const universeId = finalJson.universe_id ?? null;
  assertEditorialSlug(slug, "articles.slug", universeId, { matchAnyTrailingId: false });

  const { data: existing, error: existingError } = await sb
    .from("articles")
    .select("id,published_at,author_id,cover_image")
    .eq("slug", slug)
    .maybeSingle();
  if (existingError) throw new Error(`Failed to check article ${slug}: ${existingError.message}`);

  const existingAuthorId = ((existing as { author_id?: string | null } | null)?.author_id || null) ?? null;
  const authorId =
    existingAuthorId ??
    (await pickAuthorId(sb, finalJson.author_id ?? process.env.ARTICLE_AUTHOR_ID ?? null));
  const suppliedCover = normalizeArticleCover(finalJson.cover_image);
  const existingCover = normalizeArticleCover(
    ((existing as { cover_image?: string | null } | null)?.cover_image || null) ?? null
  );
  const universeCover = await pickUniverseCoverImage(sb, universeId);
  const forceEditedCover = process.env.ARTICLE_WRITER_REGENERATE_COVERS === "true";
  let coverImage: string | null;
  if (forceEditedCover) {
    const coverSource = universeCover ?? suppliedCover ?? existingCover;
    if (!coverSource) {
      throw new Error(`Article writer cannot create an edited cover for ${slug}: no source image is available.`);
    }
    if (dryRun) {
      coverImage = coverSource;
    } else {
      coverImage = await uploadEditedArticleCover({
        imageUrl: coverSource,
        slug,
        title: finalJson.title,
        sb,
      });
      if (!coverImage) {
        throw new Error(`Article writer could not generate and upload the required edited cover for ${slug}.`);
      }
    }
  } else {
    coverImage =
      suppliedCover ??
      (isEditedArticleCover(existingCover, slug) ? existingCover : null) ??
      (!dryRun && universeCover
        ? await uploadEditedArticleCover({
            imageUrl: universeCover,
            slug,
            title: finalJson.title,
            sb,
          })
        : null) ??
      existingCover ??
      universeCover;
  }
  const contentMd = coverImage
    ? injectCoverImageBeforeFirstH2(finalJson.content_md, coverImage, finalJson.title)
    : finalJson.content_md;

  assertProductionArticleMedia({ slug, coverImage, contentMd, isPublished });

  const payload = {
    title: finalJson.title.trim(),
    slug,
    content_md: contentMd,
    cover_image: coverImage,
    author_id: authorId,
    universe_id: universeId,
    is_published: isPublished,
    published_at: isPublished ? new Date().toISOString() : null,
    word_count: wordCount(contentMd),
    meta_description: finalJson.meta_description ?? null,
    tags: finalJson.tags ?? [],
    sources: finalJson.sources ?? [],
    faq_json: normalizeFaqJson(finalJson.faq_json, slug),
  };

  if (existing?.published_at && isPublished) {
    payload.published_at = existing.published_at as string;
  }

  if (dryRun) {
    console.log(existing ? `Would update article ${slug}` : `Would create article ${slug}`);
    return;
  }

  const query = existing
    ? sb.from("articles").update(payload).eq("id", existing.id)
    : sb.from("articles").insert(payload);
  const { error } = await query;
  if (error) throw new Error(`Failed to save article ${slug}: ${error.message}`);
  await verifyProductionArticleMedia({ slug, sb });
  console.log(existing ? `Updated article ${slug}` : `Created article ${slug}`);
}

async function importChecklist(rawFinalJson: ChecklistFinal | LegacyChecklistFinal, dryRun: boolean) {
  const finalJson = normalizeChecklistFinal(rawFinalJson);
  const sb = supabaseAdmin();
  const page = finalJson.page;
  const slug = page.slug.trim().toLowerCase();
  const universeId = Number(page.universe_id);
  assertEditorialSlug(slug, "checklist_pages.slug", universeId);
  const isPublic = page.is_public ?? true;

  const pagePayload = {
    universe_id: universeId,
    slug,
    title: page.title.trim(),
    seo_title: page.seo_title ?? null,
    seo_description: page.seo_description ?? null,
    description_md: page.description_md ?? null,
    is_public: isPublic,
    published_at: isPublic ? new Date().toISOString() : null,
  };

  const { data: existing, error: existingError } = await sb
    .from("checklist_pages")
    .select("id,published_at")
    .eq("universe_id", universeId)
    .eq("slug", slug)
    .maybeSingle();
  if (existingError) throw new Error(`Failed to check checklist ${slug}: ${existingError.message}`);

  if (existing?.published_at && isPublic) {
    pagePayload.published_at = existing.published_at as string;
  }

  if (dryRun) {
    const leafCount = finalJson.items.filter((item) => item.section_code.split(".").filter(Boolean).length === 3).length;
    console.log(existing ? `Would update checklist ${slug}` : `Would create checklist ${slug}`);
    console.log(`Would replace ${finalJson.items.length} rows (${leafCount} leaf tasks)`);
    return;
  }

  const pageQuery = existing
    ? sb.from("checklist_pages").update(pagePayload).eq("id", existing.id)
    : sb.from("checklist_pages").insert(pagePayload);
  const { data: savedPage, error: pageError } = await pageQuery.select("id").single<{ id: string }>();
  if (pageError || !savedPage) throw new Error(`Failed to save checklist ${slug}: ${pageError?.message ?? "no row returned"}`);

  const { error: deleteError } = await sb.from("checklist_items").delete().eq("page_id", savedPage.id);
  if (deleteError) throw new Error(`Failed to clear checklist items for ${slug}: ${deleteError.message}`);

  if (finalJson.items.length) {
    const rows = finalJson.items.map((item) => ({
      page_id: savedPage.id,
      section_code: item.section_code.trim(),
      title: item.title.trim(),
      description: item.description ?? null,
      is_required: item.is_required ?? item.section_code.split(".").filter(Boolean).length === 3,
    }));
    const { error: insertError } = await sb.from("checklist_items").insert(rows);
    if (insertError) throw new Error(`Failed to insert checklist items for ${slug}: ${insertError.message}`);
  }

  console.log(existing ? `Updated checklist ${slug}` : `Created checklist ${slug}`);
}

async function importQuiz(finalJson: QuizFinal, dryRun: boolean) {
  const sb = supabaseAdmin();
  const page = finalJson.page;
  const code = page.code.trim().toLowerCase();
  assertEditorialSlug(code, "quiz_pages.code", page.universe_id ?? null);
  const isPublished = page.is_published ?? true;
  const payload = {
    universe_id: page.universe_id ?? null,
    code,
    title: page.title.trim(),
    description_md: page.description_md ?? null,
    seo_title: page.seo_title ?? null,
    seo_description: page.seo_description ?? null,
    is_published: isPublished,
    published_at: isPublished ? new Date().toISOString() : null,
  };

  const { data: existing, error: existingError } = await sb.from("quiz_pages").select("id,published_at").eq("code", code).maybeSingle();
  if (existingError) throw new Error(`Failed to check quiz ${code}: ${existingError.message}`);

  if (existing?.published_at && isPublished) {
    payload.published_at = existing.published_at as string;
  }

  if (dryRun) {
    console.log(existing ? `Would update quiz ${code}` : `Would create quiz ${code}`);
    return;
  }

  const query = existing
    ? sb.from("quiz_pages").update(payload).eq("id", existing.id)
    : sb.from("quiz_pages").insert(payload);
  const { error } = await query;
  if (error) throw new Error(`Failed to save quiz ${code}: ${error.message}`);
  console.log(existing ? `Updated quiz ${code}` : `Created quiz ${code}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (process.env.NODE_ENV === "production" && !options.allowProd) {
    throw new Error("Refusing to import to production without --allow-prod");
  }

  for (const file of options.files) {
    const value = await readJson(file);
    assertCanonicalMediaUrls(value, file);
    if (isArticleFinal(value)) {
      await importArticle(value, options.dryRun);
    } else if (isChecklistFinal(value) || isLegacyChecklistFinal(value)) {
      await importChecklist(value, options.dryRun);
    } else if (isQuizFinal(value)) {
      await importQuiz(value, options.dryRun);
    } else {
      throw new Error(`Unsupported final.json shape: ${file}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
