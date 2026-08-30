import "../shared/load-env";

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  assertNoArticleMediaErrors,
  checkArticleMedia,
  logArticleMediaFindings,
} from "./check-article-media";
import {
  assertArticleImageReadiness,
  checkArticleImageReadiness,
  readArticleImageManifest,
  type ArticleImageManifest,
} from "./article-image-readiness";
import { verifyArticleImageUrls } from "./verify-article-image-urls";

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

type CliOptions = {
  files: string[];
  baseUrl: string | null;
};

type LoadedImageManifest = {
  file: string;
  manifest: ArticleImageManifest;
};

type ArticleRow = {
  id: string;
  title: string | null;
  slug: string | null;
  content_md: string | null;
  cover_image: string | null;
  author_id: string | null;
  universe_id: number | null;
  is_published: boolean | null;
  word_count: number | null;
  meta_description: string | null;
  tags: unknown;
  sources: unknown;
  faq_json: unknown;
  published_at: string | null;
};

function printUsage() {
  console.log(
    [
      "Usage:",
      "  npm run verify:article-finals -- --base-url http://localhost:3000 --file <final.json> [--file <final.json>...]",
      "",
      "Checks:",
      "  - parse article final.json files",
      "  - YouTube directive + hosted image media checks",
      "  - require and validate sibling media.json for every article",
      "  - run content:check-copy",
      "  - import into managed Supabase development",
      "  - read back saved article rows",
      "  - request every /articles/<slug> route",
      "  - confirm YouTube embeds and images appear in HTML when present",
      "  - download every unique body image and require a non-empty image response",
    ].join("\n")
  );
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    files: [],
    baseUrl: null,
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
      case "--base-url": {
        const value = argv[i + 1];
        if (!value) throw new Error("Missing value for --base-url");
        options.baseUrl = value;
        i += 1;
        break;
      }
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!options.files.length) throw new Error("At least one --file is required");
  if (!options.baseUrl) throw new Error("--base-url is required");

  return options;
}

function isArticleFinal(value: unknown): value is ArticleFinal {
  const candidate = value as Partial<ArticleFinal>;
  return Boolean(
    candidate &&
      typeof candidate.title === "string" &&
      candidate.title.trim() &&
      typeof candidate.slug === "string" &&
      candidate.slug.trim() &&
      typeof candidate.content_md === "string" &&
      candidate.content_md.trim()
  );
}

async function readArticleFinal(filePath: string): Promise<ArticleFinal> {
  const raw = await readFile(path.resolve(process.cwd(), filePath), "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!isArticleFinal(parsed)) {
    throw new Error(`${filePath} is not an article final.json with title, slug, and content_md`);
  }

  return {
    ...parsed,
    title: parsed.title.trim(),
    slug: parsed.slug.trim().toLowerCase(),
    content_md: parsed.content_md.trim(),
    faq_json: normalizeFaqJson((parsed as ArticleFinal).faq_json, filePath),
  };
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

function runCommand(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      shell: false,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
      }
    });
  });
}

function normalizeBaseUrl(value: string): string {
  const url = new URL(value);
  return url.toString().replace(/\/$/, "");
}

function articleUrl(baseUrl: string, slug: string): string {
  return `${baseUrl}/articles/${slug}`;
}

function assertRowMatchesFinal(row: ArticleRow | null, finalJson: ArticleFinal) {
  if (!row) throw new Error(`No managed-dev articles row found for slug ${finalJson.slug}`);
  if (row.slug !== finalJson.slug) throw new Error(`Readback slug mismatch for ${finalJson.slug}`);
  if (row.title !== finalJson.title) {
    throw new Error(`Readback title mismatch for ${finalJson.slug}: expected "${finalJson.title}", got "${row.title}"`);
  }
  if (!row.is_published) throw new Error(`Readback article ${finalJson.slug} is not published`);
  if (!row.author_id) throw new Error(`Readback article ${finalJson.slug} has no author_id`);
  if (!row.content_md || row.content_md.trim().length < finalJson.content_md.slice(0, 80).trim().length) {
    throw new Error(`Readback article ${finalJson.slug} has missing or very short content_md`);
  }
  if (row.cover_image && row.content_md.includes(row.cover_image)) {
    throw new Error(`Readback article ${finalJson.slug} repeats cover_image inside content_md`);
  }
  if (finalJson.universe_id && row.universe_id !== finalJson.universe_id) {
    throw new Error(`Readback universe_id mismatch for ${finalJson.slug}`);
  }
  if (finalJson.meta_description && row.meta_description !== finalJson.meta_description) {
    throw new Error(`Readback meta_description mismatch for ${finalJson.slug}`);
  }
  const expectedFaq = normalizeFaqJson(finalJson.faq_json, finalJson.slug);
  const actualFaq = normalizeFaqJson(row.faq_json, `${finalJson.slug} readback`);
  if (JSON.stringify(actualFaq) !== JSON.stringify(expectedFaq)) {
    throw new Error(`Readback faq_json mismatch for ${finalJson.slug}`);
  }
}

async function readBackRows(finals: ArticleFinal[]) {
  const sb = supabaseAdmin();
  const slugs = finals.map((entry) => entry.slug);
  const { data, error } = await sb
    .from("articles")
    .select(
      "id,title,slug,content_md,cover_image,author_id,universe_id,is_published,word_count,meta_description,tags,sources,faq_json,published_at"
    )
    .in("slug", slugs);

  if (error) throw new Error(`Failed to read back managed-dev article rows: ${error.message}`);

  const rowsBySlug = new Map((data ?? []).map((row) => [(row as ArticleRow).slug, row as ArticleRow]));
  for (const finalJson of finals) {
    assertRowMatchesFinal(rowsBySlug.get(finalJson.slug) ?? null, finalJson);
  }

  const missingCovers = finals
    .map((finalJson) => rowsBySlug.get(finalJson.slug) ?? null)
    .filter((row): row is ArticleRow => Boolean(row && !row.cover_image))
    .map((row) => row.slug);

  if (missingCovers.length) {
    console.warn(`Warning: ${missingCovers.length} article row(s) have no cover_image: ${missingCovers.join(", ")}`);
  }

  console.log(`Managed-dev Supabase readback passed for ${finals.length} article${finals.length === 1 ? "" : "s"}.`);
  return rowsBySlug;
}

async function loadAndCheckImageManifests(
  files: string[],
  finals: ArticleFinal[]
): Promise<LoadedImageManifest[]> {
  const loaded: LoadedImageManifest[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const finalFile = path.resolve(process.cwd(), files[index]!);
    const mediaFile = path.join(path.dirname(finalFile), "media.json");
    let manifest: ArticleImageManifest;
    try {
      manifest = await readArticleImageManifest(mediaFile);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") {
        throw new Error(`${files[index]} requires sibling media.json for image readiness`);
      }
      throw error;
    }

    const result = checkArticleImageReadiness({ manifest, finalJson: finals[index]! });
    const summary = result.summary;
    console.log(
      `Image readiness ${manifest.article_slug}: expected=${summary.expected} verified=${summary.verified} uploaded=${summary.uploaded} inserted=${summary.inserted} missing=${summary.missing} accepted_missing=${summary.acceptedMissing}`
    );
    assertArticleImageReadiness(result, mediaFile);
    loaded.push({ file: mediaFile, manifest });
  }

  return loaded;
}

async function syncImageProvenance(
  manifests: LoadedImageManifest[],
  rowsBySlug: Map<string | null, ArticleRow>
): Promise<void> {
  const sb = supabaseAdmin();
  let synced = 0;

  for (const loaded of manifests) {
    const article = rowsBySlug.get(loaded.manifest.article_slug);
    if (!article) throw new Error(`Cannot sync image provenance: article ${loaded.manifest.article_slug} was not imported`);

    for (const entry of loaded.manifest.entries) {
      if (entry.status !== "verified" || !entry.original_image_url || !entry.public_url) {
        continue;
      }
      const publicUrl = entry.public_url.trim();
      if (!entry.uploaded_path) continue;
      const payload = {
        article_id: article.id,
        source_url: entry.source_page_url!,
        source_host: new URL(entry.source_page_url!).hostname.replace(/^www\./i, "").toLowerCase(),
        name: entry.label,
        original_url: entry.original_image_url,
        uploaded_path: entry.uploaded_path,
        public_url: publicUrl,
        alt_text: entry.alt ?? null,
        caption: null,
        context: entry.match_evidence ?? entry.placement_heading,
        is_table: false,
        width: entry.width ?? null,
        height: entry.height ?? null,
        table_key: null,
        row_text: entry.placement_heading,
      };

      const { data: existing, error: lookupError } = await sb
        .from("article_source_images")
        .select("id")
        .eq("article_id", article.id)
        .eq("uploaded_path", entry.uploaded_path)
        .limit(1)
        .maybeSingle();
      if (lookupError) throw new Error(`Failed to read image provenance for ${entry.label}: ${lookupError.message}`);

      const operation = existing?.id
        ? sb.from("article_source_images").update(payload).eq("id", existing.id)
        : sb.from("article_source_images").insert(payload);
      const { error } = await operation;
      if (error) throw new Error(`Failed to sync image provenance for ${entry.label}: ${error.message}`);
      synced += 1;
    }
  }

  if (synced) console.log(`Synced ${synced} article_source_images provenance row${synced === 1 ? "" : "s"}.`);
}

async function fetchWithTimeout(url: string, timeoutMs = 20000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function bodyIncludesTitle(body: string, title: string): boolean {
  const variants = new Set([title, escapeHtml(title), escapeHtml(title).replace(/&#x27;/g, "&#39;")]);
  return Array.from(variants).some((candidate) => body.includes(candidate));
}

async function verifyRoute(url: string, title: string, finalJson: ArticleFinal) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url);
      const body = await response.text();
      if (response.status !== 200) {
        throw new Error(`${url} returned HTTP ${response.status}`);
      }
      if (!bodyIncludesTitle(body, title)) {
        throw new Error(`${url} returned 200 but did not include the article title`);
      }

      // End-to-end media checks on the rendered page when the final claims media.
      const { findYouTubeDirectives, findMarkdownImages } = await import("@/lib/article-media");
      const { extractArticleBlockImageRefs, parseArticleContentBlocks } = await import("@/lib/article-blocks");
      const youtube = findYouTubeDirectives(finalJson.content_md);
      for (const directive of youtube) {
        if (!directive.videoId) continue;
        if (!body.includes(`youtube-nocookie.com/embed/${directive.videoId}`)) {
          throw new Error(
            `${url} is missing rendered YouTube embed for ${directive.videoId}`
          );
        }
        if (!body.includes("video-embed")) {
          throw new Error(`${url} is missing video-embed container for YouTube`);
        }
      }

      const images = [
        ...findMarkdownImages(finalJson.content_md),
        ...extractArticleBlockImageRefs(finalJson.content_md).map((image) => ({
          alt: image.alt,
          src: image.src,
          raw: image.src,
          index: 0,
        })),
      ];
      for (const image of images) {
        if (image.src.startsWith("/")) {
          // Next may encode paths; check the path segment at least.
          const fileName = image.src.split("/").pop() ?? "";
          if (fileName && !body.includes(fileName) && !body.includes(image.src)) {
            throw new Error(`${url} is missing rendered image for ${image.src}`);
          }
        }
      }

      const verifiedImageUrls = await verifyArticleImageUrls({
        articleUrl: url,
        imageSources: images.map((image) => image.src),
      });
      if (verifiedImageUrls.length) {
        console.log(
          `Rendered image responses passed for ${verifiedImageUrls.length} unique image URL${verifiedImageUrls.length === 1 ? "" : "s"}.`,
        );
      }

      const contentBlocks = parseArticleContentBlocks(finalJson.content_md);
      if (contentBlocks.some((block) => block.kind === "tier-list") && !body.includes('data-article-block="tier-list"')) {
        throw new Error(`${url} is missing the rendered tier-list component`);
      }
      if (
        contentBlocks.some((block) => block.kind === "article-checklist") &&
        !body.includes('data-article-block="checklist"')
      ) {
        throw new Error(`${url} is missing the rendered article checklist component`);
      }

      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to verify ${url}`);
}

async function verifyRoutes(baseUrl: string, finals: ArticleFinal[]) {
  const urls = finals.map((finalJson) => ({
    slug: finalJson.slug,
    title: finalJson.title,
    finalJson,
    url: articleUrl(baseUrl, finalJson.slug),
  }));

  for (const entry of urls) {
    await verifyRoute(entry.url, entry.title, entry.finalJson);
    console.log(`Route passed: ${entry.url}`);
  }

  return urls.map((entry) => entry.url);
}

async function verifyArticleMedia(finals: Array<ArticleFinal & { label?: string }>, fileLabels: string[]) {
  for (let i = 0; i < finals.length; i += 1) {
    const finalJson = finals[i]!;
    const findings = await checkArticleMedia({
      title: finalJson.title,
      slug: finalJson.slug,
      content_md: finalJson.content_md,
      cover_image: finalJson.cover_image,
      label: fileLabels[i] ?? finalJson.slug,
      requireLocalFiles: true,
      requireImageAlt: true,
    });
    logArticleMediaFindings(findings);
    assertNoArticleMediaErrors(findings);
  }
  console.log(`Article media checks passed for ${finals.length} article${finals.length === 1 ? "" : "s"}.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? "");
  const finals = await Promise.all(options.files.map(readArticleFinal));

  console.log(`Parsed ${finals.length} article final file${finals.length === 1 ? "" : "s"}.`);

  const imageManifests = await loadAndCheckImageManifests(options.files, finals);
  await verifyArticleMedia(finals, options.files);
  await runCommand("npm", ["run", "content:check-copy", "--", ...options.files]);

  const importArgs = options.files.flatMap((file) => ["--file", file]);
  await runCommand("npm", ["run", "import:content-final", "--", ...importArgs]);

  const rowsBySlug = await readBackRows(finals);
  await syncImageProvenance(imageManifests, rowsBySlug);
  const urls = await verifyRoutes(baseUrl, finals);

  console.log("\nVerified localhost article links:");
  for (const url of urls) {
    console.log(`- ${url}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
