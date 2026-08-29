import "../shared/load-env";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { repoPath } from "@/lib/paths";
import {
  GAME_COLLECTION_GROUPS,
  GAME_COLLECTIONS,
  type GameCollectionConfig,
  type GameCollectionGroup
} from "@/lib/game-collections";
import { isManagedDevelopmentSupabaseUrl, isProductionSupabaseUrl } from "../shared/supabase-target";
import { loadR2ClientConfig, R2Client } from "../shared/r2-client";
import { isDatabaseOnlyGameCollectionGame } from "@/lib/game-collections/database-only";

type DatasetDocument = {
  meta?: Record<string, unknown>;
  items?: DatasetRow[];
};

type DatasetRow = {
  item?: Record<string, unknown>;
  system?: {
    slug?: string;
    section?: string;
    sortOrder?: number;
    image?: string | null;
  };
};

type PlannedItem = {
  item_slug: string;
  item_name: string;
  section: string;
  sort_order: number;
  image_key: string | null;
  image_mime: string | null;
  image_width: number | null;
  image_height: number | null;
  image_bytes: number | null;
  image_sha256: string | null;
  fields_json: Record<string, unknown>;
  source_path: string | null;
  source_git_path: string | null;
  source_url: string | null;
  media_was_normalized: boolean;
};

type CollectionPlan = {
  config: GameCollectionConfig;
  universeId: number;
  datasetPath: string;
  schemaVersion: number;
  contentHash: string;
  metaJson: Record<string, unknown>;
  validationJson: Record<string, unknown>;
  sourceManifestJson: Record<string, unknown>;
  items: PlannedItem[];
  finalJson: Record<string, unknown> | null;
};

type RuntimeManifest = {
  schemaVersion: 1;
  game: { slug: string; name: string; universeId: number };
  collection: { slug: string; label: string; sortOrder?: number };
  dataset: string;
  finalJson?: string;
  mediaRoot: string;
  sourceUrls: string[];
};

type CollectionSource = {
  config: GameCollectionConfig;
  universeId: number;
  datasetPath: string;
  mediaRoot: string;
  finalJsonPath: string | null;
  manifestPath: string | null;
  sourceUrls: string[];
  allowGitFallback: boolean;
  allowRemoteImages: boolean;
};

const argv = process.argv.slice(2);
const flags = new Set(argv);
const apply = flags.has("--apply");
const publish = flags.has("--publish");
const uploadMedia = flags.has("--upload-media");
const allowProd = flags.has("--allow-prod");
const existingPublishedPagesOnly = flags.has("--existing-published-pages-only");
const normalizeLegacyMedia = flags.has("--normalize-legacy-media");
const gameFilters = collectValues("--game");
const collectionFilters = collectValues("--collection");
const publicRoot = path.resolve(collectValue("--public-root") || repoPath("apps", "web", "public"));
const outputPath = collectValue("--output");
const manifestPaths = collectValues("--manifest", false).map((value) => path.resolve(value));
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_IMAGE_BYTES = 1_000_000;
const MAX_IMAGE_DIMENSION = 960;
const execFileAsync = promisify(execFile);

function collectValues(name: string, normalize = true) {
  const values: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === name && argv[index + 1]) values.push(argv[++index].trim());
    else if (value.startsWith(`${name}=`)) values.push(value.slice(name.length + 1).trim());
  }
  return [...new Set(values.filter(Boolean).map((value) => (normalize ? value.toLowerCase() : value)))];
}

function collectValue(name: string) {
  const values = collectValues(name, false);
  if (values.length > 1) throw new Error(`Expected one ${name} value.`);
  return values[0] || null;
}

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)])
    );
  }
  return value;
}

function stableJson(value: unknown) {
  return JSON.stringify(stableValue(value));
}

function safeSlugFromName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function mimeForFormat(format: string | undefined) {
  const formats: Record<string, string> = {
    avif: "image/avif",
    gif: "image/gif",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    png: "image/png",
    webp: "image/webp"
  };
  return format ? formats[format] || null : null;
}

function extensionForMime(mime: string) {
  const extensions: Record<string, string> = {
    "image/avif": "avif",
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  };
  const extension = extensions[mime];
  if (!extension) throw new Error(`Unsupported collection image MIME: ${mime}`);
  return extension;
}

async function resolveImageSource(
  value: string,
  mediaRoot: string,
  options: { allowGitFallback: boolean; allowRemoteImages: boolean }
) {
  if (/^https?:\/\//i.test(value)) {
    if (!options.allowRemoteImages || !normalizeLegacyMedia) {
      throw new Error(`Remote image ${value} must be downloaded and verified before runtime publication.`);
    }
    const url = new URL(value);
    if (url.protocol !== "https:") throw new Error(`Collection image must use HTTPS: ${value}`);
    return { sourcePath: null, sourceGitPath: null, sourceUrl: url.toString() };
  }
  const decoded = decodeURIComponent(value.split(/[?#]/, 1)[0]).replace(/^\/+/, "");
  const absolute = path.resolve(mediaRoot, decoded);
  const relative = path.relative(mediaRoot, absolute);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Image escapes the public root: ${value}`);
  }
  try {
    await fs.access(absolute);
    return { sourcePath: absolute, sourceGitPath: null, sourceUrl: null };
  } catch (error) {
    if (!options.allowGitFallback || (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const gitPath = path.posix.join("apps/web/public", decoded.split(path.sep).join("/"));
    return { sourcePath: null, sourceGitPath: gitPath, sourceUrl: null };
  }
}

async function readSourceBytes(source: {
  source_path: string | null;
  source_git_path: string | null;
  source_url: string | null;
}) {
  if (source.source_path) return fs.readFile(source.source_path);
  if (source.source_git_path) {
    const result = await execFileAsync("git", ["show", `HEAD:${source.source_git_path}`], {
      encoding: "buffer",
      maxBuffer: 20_000_000
    });
    return Buffer.from(result.stdout);
  }
  if (source.source_url) {
    const response = await fetch(source.source_url, { redirect: "follow" });
    if (!response.ok) throw new Error(`Could not fetch collection image ${source.source_url}: ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > 20_000_000) throw new Error(`Remote collection image exceeds the 20 MB ingestion limit: ${source.source_url}`);
    return bytes;
  }
  throw new Error("Collection image source is missing.");
}

async function prepareImageBytes(original: Buffer) {
  const originalMetadata = await sharp(original, { animated: true }).metadata();
  const originalMime = mimeForFormat(originalMetadata.format);
  const originalWidth = originalMetadata.width || null;
  const originalHeight = originalMetadata.height || null;
  const withinPolicy = Boolean(originalMime) && original.byteLength <= MAX_IMAGE_BYTES &&
    (originalWidth || 0) <= MAX_IMAGE_DIMENSION &&
    (originalHeight || 0) <= MAX_IMAGE_DIMENSION;
  if (withinPolicy) {
    return {
      bytes: original,
      height: originalHeight,
      mime: originalMime!,
      normalized: false,
      width: originalWidth
    };
  }
  if (!normalizeLegacyMedia) {
    if (!originalMime) throw new Error("Could not determine a supported collection image MIME.");
    if (original.byteLength > MAX_IMAGE_BYTES) throw new Error(`image exceeds ${MAX_IMAGE_BYTES} bytes.`);
    throw new Error(`image exceeds ${MAX_IMAGE_DIMENSION}px.`);
  }

  for (const dimension of [960, 800, 640]) {
    for (const quality of [82, 72, 62, 52, 42]) {
      const output = await sharp(original)
        .resize({ width: dimension, height: dimension, fit: "inside", withoutEnlargement: true })
        .webp({ quality, effort: 4 })
        .toBuffer({ resolveWithObject: true });
      if (output.data.byteLength <= MAX_IMAGE_BYTES && output.info.width <= MAX_IMAGE_DIMENSION && output.info.height <= MAX_IMAGE_DIMENSION) {
        return {
          bytes: output.data,
          height: output.info.height,
          mime: "image/webp",
          normalized: true,
          width: output.info.width
        };
      }
    }
  }
  throw new Error("Could not normalize collection image within the R2 media policy.");
}

async function targetSources(): Promise<CollectionSource[]> {
  if (manifestPaths.length) {
    return Promise.all(manifestPaths.map(async (manifestPath) => {
      const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as RuntimeManifest;
      if (manifest.schemaVersion !== 1 || !manifest.game?.slug || !manifest.collection?.slug) {
        throw new Error(`Invalid wiki collection runtime manifest: ${manifestPath}`);
      }
      if (!Number.isSafeInteger(manifest.game.universeId) || manifest.game.universeId <= 0) {
        throw new Error(`Invalid universeId in ${manifestPath}.`);
      }
      if (!SAFE_SLUG.test(manifest.game.slug) || !SAFE_SLUG.test(manifest.collection.slug)) {
        throw new Error(`Invalid game or collection slug in ${manifestPath}.`);
      }
      if (!manifest.game.name?.trim() || !manifest.collection.label?.trim()) {
        throw new Error(`Missing game name or collection label in ${manifestPath}.`);
      }
      if (!Array.isArray(manifest.sourceUrls) || !manifest.sourceUrls.length) {
        throw new Error(`At least one sourceUrls entry is required in ${manifestPath}.`);
      }
      for (const sourceUrl of manifest.sourceUrls) {
        const url = new URL(sourceUrl);
        if (url.protocol !== "https:") throw new Error(`Runtime manifest sources must use HTTPS: ${sourceUrl}`);
      }
      const root = path.dirname(manifestPath);
      const rootRealPath = await fs.realpath(root);
      const resolveInput = async (value: string, label: string) => {
        const resolved = path.resolve(root, value);
        const relative = path.relative(root, resolved);
        if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
          throw new Error(`${label} must stay inside the collection workspace: ${manifestPath}`);
        }
        const realPath = await fs.realpath(resolved);
        const realRelative = path.relative(rootRealPath, realPath);
        if (!realRelative || realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
          throw new Error(`${label} cannot escape the collection workspace through a symlink: ${manifestPath}`);
        }
        return realPath;
      };
      const config: GameCollectionConfig = {
        code: `${manifest.game.slug}-${manifest.collection.slug}`,
        gameSlug: manifest.game.slug,
        gameName: manifest.game.name,
        dataDir: "",
        file: path.basename(manifest.dataset),
        slug: manifest.collection.slug,
        label: manifest.collection.label,
        sortOrder: manifest.collection.sortOrder ?? 0,
        universeNames: [manifest.game.name]
      };
      return {
        config,
        universeId: manifest.game.universeId,
        datasetPath: await resolveInput(manifest.dataset, "dataset"),
        mediaRoot: await resolveInput(manifest.mediaRoot, "mediaRoot"),
        finalJsonPath: manifest.finalJson ? await resolveInput(manifest.finalJson, "finalJson") : null,
        manifestPath,
        sourceUrls: [...new Set(manifest.sourceUrls)],
        allowGitFallback: false,
        allowRemoteImages: false
      };
    }));
  }

  const databaseOnlyFilters = gameFilters.filter(isDatabaseOnlyGameCollectionGame);
  if (databaseOnlyFilters.length) {
    throw new Error(
      `${databaseOnlyFilters.join(", ")} no longer has registered local runtime files. Use a task-local --manifest for refresh work.`
    );
  }
  let sources = GAME_COLLECTIONS.filter(
    (config) =>
      !isDatabaseOnlyGameCollectionGame(config.gameSlug) &&
      (!gameFilters.length || gameFilters.includes(config.gameSlug)) &&
      (!collectionFilters.length || collectionFilters.includes(config.slug))
  ).map((config) => {
    const group = GAME_COLLECTION_GROUPS.find(
      (candidate) => candidate.gameSlug === config.gameSlug
    ) as GameCollectionGroup | undefined;
    if (!group?.universeId) throw new Error(`${config.gameSlug} has no explicit universeId in its collection group.`);
    return {
      config,
      universeId: group.universeId,
      datasetPath: repoPath("data", config.dataDir, config.file),
      mediaRoot: publicRoot,
      finalJsonPath: null,
      manifestPath: null,
      sourceUrls: [],
      allowGitFallback: true,
      allowRemoteImages: true
    };
  });
  if (existingPublishedPagesOnly) {
    if (manifestPaths.length) throw new Error("--existing-published-pages-only cannot be combined with --manifest.");
    const pages = await supabaseAdmin()
      .from("wiki_collection_pages")
      .select("code")
      .eq("is_published", true);
    if (pages.error) throw pages.error;
    const codes = new Set((pages.data || []).map((page) => String(page.code)));
    const skipped = sources.filter((source) => !codes.has(source.config.code)).map((source) => source.config.code);
    sources = sources.filter((source) => codes.has(source.config.code));
    if (skipped.length) {
      const sample = skipped.slice(0, 20).join(", ");
      const remainder = skipped.length > 20 ? `, and ${skipped.length - 20} more` : "";
      console.error(`Skipping ${skipped.length} registered collections without published target rows: ${sample}${remainder}`);
    }
  }
  return sources;
}

async function planCollection(source: CollectionSource): Promise<CollectionPlan> {
  const { config, datasetPath } = source;
  const document = JSON.parse(await fs.readFile(datasetPath, "utf8")) as DatasetDocument;
  if (document.meta?.schemaVersion !== 2 || !Array.isArray(document.items)) {
    throw new Error(`${config.code} must be a schemaVersion 2 collection dataset.`);
  }
  if (!document.items.length) throw new Error(`${config.code} cannot publish an empty collection dataset.`);
  if (document.meta.gameSlug && document.meta.gameSlug !== config.gameSlug) {
    throw new Error(`${config.code} dataset gameSlug does not match the runtime manifest.`);
  }
  if (document.meta.collection && document.meta.collection !== config.slug) {
    throw new Error(`${config.code} dataset collection does not match the runtime manifest.`);
  }

  const itemSlugs = new Set<string>();
  const slugOccurrences = new Map<string, number>();
  let duplicateSlugCount = 0;
  let invalidLegacyImageCount = 0;
  let repairedSlugCount = 0;
  const items: PlannedItem[] = [];
  for (let index = 0; index < document.items.length; index += 1) {
    const row = document.items[index];
    const item = row.item || {};
    const system = row.system || {};
    const suppliedItemSlug = String(system.slug || "").trim();
    const itemName = String(item.name || "").trim();
    if (!itemName) throw new Error(`${config.code} row ${index + 1} is missing a name.`);
    const sourceItemSlug = SAFE_SLUG.test(suppliedItemSlug)
      ? suppliedItemSlug
      : safeSlugFromName(itemName) || `item-${index + 1}`;
    if (sourceItemSlug !== suppliedItemSlug) repairedSlugCount += 1;
    const occurrence = (slugOccurrences.get(sourceItemSlug) || 0) + 1;
    slugOccurrences.set(sourceItemSlug, occurrence);
    let itemSlug = sourceItemSlug;
    if (occurrence > 1 || itemSlugs.has(itemSlug)) {
      let suffix = Math.max(2, occurrence);
      do {
        itemSlug = `${sourceItemSlug}-${suffix}`;
        suffix += 1;
      } while (itemSlugs.has(itemSlug));
      duplicateSlugCount += 1;
    }
    itemSlugs.add(itemSlug);

    const section = typeof system.section === "string" ? system.section.trim() : "";
    if (!section) throw new Error(`${config.code} row ${index + 1} is missing a section.`);

    let image: Omit<PlannedItem, "item_slug" | "item_name" | "section" | "sort_order" | "fields_json"> = {
      image_key: null,
      image_mime: null,
      image_width: null,
      image_height: null,
      image_bytes: null,
      image_sha256: null,
      source_path: null,
      source_git_path: null,
      source_url: null,
      media_was_normalized: false
    };
    if (system.image) {
      const resolved = await resolveImageSource(system.image, source.mediaRoot, {
        allowGitFallback: source.allowGitFallback,
        allowRemoteImages: source.allowRemoteImages
      });
      try {
        const prepared = await prepareImageBytes(await readSourceBytes({
          source_path: resolved.sourcePath,
          source_git_path: resolved.sourceGitPath,
          source_url: resolved.sourceUrl
        }));
        const imageHash = sha256(prepared.bytes);
        const extension = extensionForMime(prepared.mime);
        image = {
          image_key: `${source.universeId}/${config.slug}/${itemSlug}-${imageHash.slice(0, 16)}.${extension}`,
          image_mime: prepared.mime,
          image_width: prepared.width,
          image_height: prepared.height,
          image_bytes: prepared.bytes.byteLength,
          image_sha256: imageHash,
          source_path: resolved.sourcePath,
          source_git_path: resolved.sourceGitPath,
          source_url: resolved.sourceUrl,
          media_was_normalized: prepared.normalized
        };
      } catch (error) {
        if (!normalizeLegacyMedia || resolved.sourceUrl) {
          throw new Error(`${config.code}/${itemSlug} ${String(error)}`);
        }
        invalidLegacyImageCount += 1;
        console.error(`Skipping unreadable legacy image for ${config.code}/${itemSlug}: ${String(error)}`);
      }
    }

    const { name: _name, ...fieldsJson } = item;
    items.push({
      item_slug: itemSlug,
      item_name: itemName,
      section,
      sort_order: Number.isInteger(system.sortOrder) ? Number(system.sortOrder) : (index + 1) * 10,
      fields_json: fieldsJson,
      ...image
    });
  }

  const metaJson = {
    ...document.meta,
    runtime: {
      gameName: config.gameName,
      label: config.label,
      source: "wiki_collection_datasets"
    }
  };
  const hashInput = {
    meta: metaJson,
    items: items.map(({ source_path: _sourcePath, source_git_path: _sourceGitPath, source_url: _sourceUrl, media_was_normalized: _normalized, ...item }) => item)
  };
  const contentHash = sha256(stableJson(hashInput));
  return {
    config,
    universeId: source.universeId,
    datasetPath,
    schemaVersion: 2,
    contentHash,
    metaJson,
    validationJson: {
      checkedAt: new Date().toISOString(),
      duplicateSlugCount,
      imageCount: items.filter((item) => item.image_key).length,
      invalidLegacyImageCount,
      missingImageCount: items.filter((item) => !item.image_key).length,
      normalizedImageCount: items.filter((item) => item.media_was_normalized).length,
      repairedSlugCount,
      rowCount: items.length,
      schemaVersion: 2
    },
    sourceManifestJson: {
      datasetFile: path.basename(datasetPath),
      runtimeManifestSchemaVersion: source.manifestPath ? 1 : null,
      mediaPrefix: `${source.universeId}/${config.slug}/`,
      sourceUrls: source.sourceUrls.length
        ? source.sourceUrls
        : document.meta?.sources || document.meta?.sourceUrls || []
    },
    items,
    finalJson: source.finalJsonPath
      ? JSON.parse(await fs.readFile(source.finalJsonPath, "utf8")) as Record<string, unknown>
      : null
  };
}

async function uploadPlanMedia(plan: CollectionPlan, client: R2Client) {
  await mapWithConcurrency(plan.items, 16, async (item) => {
    if (!item.image_key || !item.image_mime || !item.image_sha256) return;
    if (await client.hasObject(item.image_key)) return;
    const prepared = await prepareImageBytes(await readSourceBytes(item));
    if (sha256(prepared.bytes) !== item.image_sha256 || prepared.mime !== item.image_mime || prepared.bytes.byteLength !== item.image_bytes) {
      throw new Error(`${plan.config.code}/${item.item_slug} media changed after planning.`);
    }
    await client.putObject({
      key: item.image_key,
      body: prepared.bytes,
      contentType: item.image_mime,
      metadata: {
        height: item.image_height || 0,
        sha256: item.image_sha256,
        width: item.image_width || 0
      }
    });
  });
}

async function verifyPlanMedia(plan: CollectionPlan, client: R2Client) {
  await mapWithConcurrency(plan.items, 32, async (item) => {
    if (item.image_key && !(await client.hasObject(item.image_key))) {
      throw new Error(`${plan.config.code} cannot publish: R2 object is missing for ${item.item_slug}.`);
    }
  });
}

async function mapWithConcurrency<T>(items: T[], concurrency: number, work: (item: T) => Promise<void>) {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      await work(items[index]);
    }
  });
  await Promise.all(workers);
}

function resolveCountTokens<T>(value: T, count: number): T {
  if (typeof value === "string") return value.replaceAll("{count}", count.toLocaleString("en-US")) as T;
  if (Array.isArray(value)) return value.map((entry) => resolveCountTokens(entry, count)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, resolveCountTokens(entry, count)])
    ) as T;
  }
  return value;
}

function pageCopyFromFinal(plan: CollectionPlan) {
  if (!plan.finalJson) return null;
  const final = resolveCountTokens(plan.finalJson, plan.items.length);
  if (final.code !== plan.config.code) {
    throw new Error(`${plan.config.code} final.json has code ${String(final.code || "(missing)")}.`);
  }
  for (const key of ["title", "display_name", "seo_title", "meta_description"] as const) {
    if (typeof final[key] !== "string" || !final[key].trim()) {
      throw new Error(`${plan.config.code} final.json is missing ${key}.`);
    }
  }
  if (!final.description_json || typeof final.description_json !== "object" || Array.isArray(final.description_json)) {
    throw new Error(`${plan.config.code} final.json needs description_json.`);
  }
  if (!Array.isArray(final.faq_json)) throw new Error(`${plan.config.code} final.json needs faq_json.`);
  return {
    title: final.title,
    display_name: final.display_name,
    seo_title: final.seo_title,
    meta_description: final.meta_description,
    intro_md: typeof final.intro_md === "string" ? final.intro_md : null,
    how_it_works_md: typeof final.how_it_works_md === "string" ? final.how_it_works_md : null,
    description_md: typeof final.description_md === "string" ? final.description_md : null,
    description_json: final.description_json,
    faq_json: final.faq_json,
    schema_ld_json: final.schema_ld_json && typeof final.schema_ld_json === "object" ? final.schema_ld_json : null,
    thumb_url: typeof final.thumb_url === "string" && final.thumb_url.trim() ? final.thumb_url : null,
    wiki_md: typeof final.wiki_md === "string" ? final.wiki_md : null,
    wiki_sort_order: Number.isFinite(final.wiki_sort_order) ? Number(final.wiki_sort_order) : plan.config.sortOrder
  };
}

async function applyPlan(plan: CollectionPlan) {
  const sb = supabaseAdmin();
  let { data: page, error: pageError } = await sb
    .from("wiki_collection_pages")
    .select("id, universe_id, wiki_slug, collection_slug, code, is_published, published_dataset_id")
    .eq("wiki_slug", plan.config.gameSlug)
    .eq("collection_slug", plan.config.slug)
    .maybeSingle();
  if (pageError) throw pageError;
  const pageCopy = pageCopyFromFinal(plan);
  if (!page && pageCopy) {
    const wikiPageLookup = await sb.from("wiki_pages").select("id").eq("slug", plan.config.gameSlug).maybeSingle();
    if (wikiPageLookup.error) throw wikiPageLookup.error;
    const insertedPage = await sb
      .from("wiki_collection_pages")
      .insert({
        ...pageCopy,
        wiki_page_id: wikiPageLookup.data?.id || null,
        universe_id: plan.universeId,
        wiki_slug: plan.config.gameSlug,
        collection_slug: plan.config.slug,
        code: plan.config.code,
        item_count: plan.items.length,
        is_published: false
      })
      .select("id, universe_id, wiki_slug, collection_slug, code, is_published, published_dataset_id")
      .single();
    if (insertedPage.error) throw insertedPage.error;
    page = insertedPage.data;
  }
  if (!page) {
    throw new Error(`Missing wiki_collection_pages row for ${plan.config.code}. Supply --manifest with an approved finalJson.`);
  }
  if (Number(page.universe_id) !== plan.universeId) {
    throw new Error(`${plan.config.code} universe mismatch: page=${page.universe_id} local=${plan.universeId}.`);
  }

  let { data: dataset, error: datasetError } = await sb
    .from("wiki_collection_datasets")
    .select("id, item_count")
    .eq("collection_page_id", page.id)
    .eq("content_hash", plan.contentHash)
    .maybeSingle();
  if (datasetError) throw datasetError;
  if (dataset) {
    const existingCount = await sb
      .from("wiki_collection_items")
      .select("id", { count: "exact", head: true })
      .eq("dataset_id", dataset.id);
    if (existingCount.error) throw existingCount.error;
    if (existingCount.count !== plan.items.length || Number(dataset.item_count) !== plan.items.length) {
      if (page.published_dataset_id === dataset.id) {
        throw new Error(`${plan.config.code} published revision is incomplete and cannot be repaired in place.`);
      }
      const removed = await sb.from("wiki_collection_datasets").delete().eq("id", dataset.id);
      if (removed.error) throw removed.error;
      dataset = null;
    }
  }
  if (!dataset) {
    const inserted = await sb
      .from("wiki_collection_datasets")
      .insert({
        collection_page_id: page.id,
        content_hash: plan.contentHash,
        item_count: plan.items.length,
        meta_json: plan.metaJson,
        schema_version: plan.schemaVersion,
        source_manifest_json: plan.sourceManifestJson,
        validation_json: plan.validationJson
      })
      .select("id, item_count")
      .single();
    if (inserted.error) throw inserted.error;
    dataset = inserted.data;

    try {
      for (let start = 0; start < plan.items.length; start += 500) {
        const rows = plan.items.slice(start, start + 500).map(({ source_path: _sourcePath, source_git_path: _sourceGitPath, source_url: _sourceUrl, media_was_normalized: _normalized, ...item }) => ({
          dataset_id: dataset!.id,
          ...item
        }));
        const insertedItems = await sb.from("wiki_collection_items").insert(rows);
        if (insertedItems.error) throw insertedItems.error;
      }
    } catch (itemError) {
      const cleanup = await sb.from("wiki_collection_datasets").delete().eq("id", dataset.id);
      if (cleanup.error) {
        throw new Error(`${String(itemError)}; cleanup also failed: ${cleanup.error.message}`);
      }
      throw itemError;
    }
  }

  const { count, error: countError } = await sb
    .from("wiki_collection_items")
    .select("id", { count: "exact", head: true })
    .eq("dataset_id", dataset.id);
  if (countError) throw countError;
  if (count !== plan.items.length || Number(dataset.item_count) !== plan.items.length) {
    throw new Error(`${plan.config.code} revision verification failed: expected ${plan.items.length}, found ${count}.`);
  }

  if (publish) {
    if (!pageCopy && !page.is_published) {
      throw new Error(`${plan.config.code} is a draft and cannot publish without an approved finalJson.`);
    }
    const published = await sb
      .from("wiki_collection_pages")
      .update({
        ...(pageCopy || {}),
        published_dataset_id: dataset.id,
        item_count: plan.items.length,
        is_published: true
      })
      .eq("id", page.id)
      .select("id, published_dataset_id, item_count")
      .single();
    if (published.error) throw published.error;
    if (published.data.published_dataset_id !== dataset.id) throw new Error(`${plan.config.code} pointer verification failed.`);
  }
}

async function main() {
  if (publish && !apply) throw new Error("--publish requires --apply.");
  const managedDevelopment = isManagedDevelopmentSupabaseUrl(process.env.SUPABASE_URL);
  const production = isProductionSupabaseUrl(process.env.SUPABASE_URL);
  if (apply && !managedDevelopment && !allowProd) {
    throw new Error("Refusing database writes outside managed development. Production requires explicit --allow-prod.");
  }
  if (allowProd && !apply) throw new Error("--allow-prod is only valid with --apply.");
  if (allowProd && !production) throw new Error("--allow-prod requires the recognized production Supabase target.");
  if (uploadMedia && !apply) throw new Error("--upload-media requires --apply so uploaded media has a database revision owner.");

  const sources = await targetSources();
  if (!sources.length) throw new Error("No collection matched the supplied filters or manifests.");
  const plans = [] as CollectionPlan[];
  for (const source of sources) plans.push(await planCollection(source));

  const report = plans.map((plan) => ({
    code: plan.config.code,
    contentHash: plan.contentHash,
    duplicateSlugCount: Number(plan.validationJson.duplicateSlugCount || 0),
    imageCount: plan.items.filter((item) => item.image_key).length,
    invalidLegacyImageCount: Number(plan.validationJson.invalidLegacyImageCount || 0),
    itemCount: plan.items.length,
    missingImageCount: plan.items.filter((item) => !item.image_key).length,
    normalizedImageCount: plan.items.filter((item) => item.media_was_normalized).length,
    remoteImageCount: plan.items.filter((item) => item.source_url).length,
    repairedSlugCount: Number(plan.validationJson.repairedSlugCount || 0),
    totalImageBytes: plan.items.reduce((sum, item) => sum + (item.image_bytes || 0), 0),
    universeId: plan.universeId
  }));
  if (outputPath) {
    const absoluteOutput = path.resolve(outputPath);
    await fs.mkdir(path.dirname(absoluteOutput), { recursive: true });
    await fs.writeFile(absoluteOutput, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.table(report);
  if (!apply) return;

  const r2Config = uploadMedia || publish ? loadR2ClientConfig(process.env) : null;
  const r2 = r2Config ? new R2Client(r2Config) : null;
  if (r2) {
    const expectedBucket = "bloxodes-wiki";
    const actualBucket = r2Config!.bucket;
    if (actualBucket !== expectedBucket) {
      throw new Error(`Refusing wiki runtime sync with R2 bucket ${actualBucket}; expected shared bucket ${expectedBucket}.`);
    }
  }
  for (let index = 0; index < plans.length; index += 1) {
    const plan = plans[index];
    console.error(`[${index + 1}/${plans.length}] Syncing ${plan.config.code}`);
    if (uploadMedia && r2) await uploadPlanMedia(plan, r2);
    if (publish && r2) await verifyPlanMedia(plan, r2);
    await applyPlan(plan);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
