import "../shared/load-env";

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { loadR2ClientConfig, R2Client } from "../shared/r2-client";
import { isManagedDevelopmentSupabaseUrl, isProductionSupabaseUrl } from "../shared/supabase-target";

type Manifest = {
  schemaVersion: 1;
  game: { slug: string; name: string };
  collection: { slug: string; label: string; sortOrder?: number; pageType?: "database" | "checklist" };
  route?: string;
  dataset: string;
  finalJson?: string;
  mediaRoot: string;
  sourceUrls: string[];
};
type Dataset = {
  meta?: Record<string, unknown>;
  items?: Array<{
    item?: Record<string, unknown>;
    system?: { slug?: string; section?: string; sortOrder?: number; image?: string | null };
  }>;
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
  prepared_image: Buffer | null;
};
type Plan = {
  manifest: Manifest;
  manifestPath: string;
  code: string;
  pageType: "database" | "checklist";
  datasetPath: string;
  contentHash: string;
  metaJson: Record<string, unknown>;
  items: PlannedItem[];
  finalJson: Record<string, unknown> | null;
};

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  console.log("Usage: npm run sync:gta-collection-runtime -- --manifest <runtime-manifest.json> [--apply] [--upload-media] [--publish] [--allow-prod]");
  process.exit(0);
}
const apply = argv.includes("--apply");
const publish = argv.includes("--publish");
const uploadMedia = argv.includes("--upload-media");
const allowProd = argv.includes("--allow-prod");
const manifestPaths = collectValues("--manifest").map((value) => path.resolve(value));
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ALLOWED_SYSTEM_FIELDS = new Set(["slug", "section", "sortOrder", "image"]);
const FORBIDDEN_PUBLIC_FIELDS = new Set([
  "slug", "section", "sortOrder", "image", "sourceUrl", "source_url", "sourcePage", "source_page",
  "sourceImageUrl", "source_image_url", "verificationNote", "rawText", "fields"
]);

function collectValues(name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === name && argv[index + 1]) values.push(argv[++index]);
    else if (argv[index].startsWith(`${name}=`)) values.push(argv[index].slice(name.length + 1));
  }
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableValue(entry)]));
  }
  return value;
}

function slugFromName(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function mimeForFormat(format: string | undefined): string | null {
  if (format === "png") return "image/png";
  if (format === "jpeg" || format === "jpg") return "image/jpeg";
  if (format === "webp") return "image/webp";
  if (format === "avif") return "image/avif";
  if (format === "gif") return "image/gif";
  return null;
}

function extensionForMime(mime: string): string {
  return mime === "image/jpeg" ? "jpg" : mime.replace("image/", "");
}

async function mapConcurrent<T>(values: T[], concurrency: number, task: (value: T) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (next < values.length) {
      const index = next++;
      await task(values[index]);
    }
  });
  await Promise.all(workers);
}

function transientFailure(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : JSON.stringify(error);
  return /(?:fetch failed|connection timed out|\b5(?:00|02|03|04|22)\b|ECONNRESET|ETIMEDOUT|UND_ERR)/i.test(text);
}

async function prepareImage(file: string) {
  const original = await fs.readFile(file);
  const metadata = await sharp(original, { animated: true }).metadata();
  const originalMime = mimeForFormat(metadata.format);
  const withinPolicy = Boolean(originalMime) && original.byteLength <= 1_000_000 && (metadata.width ?? 0) <= 960 && (metadata.height ?? 0) <= 960;
  const bytes = withinPolicy
    ? original
    : await sharp(original, { animated: true }).rotate().resize({ width: 960, height: 960, fit: "inside", withoutEnlargement: true }).webp({ quality: 86 }).toBuffer();
  const outputMetadata = await sharp(bytes, { animated: true }).metadata();
  const mime = mimeForFormat(outputMetadata.format);
  if (!mime || !outputMetadata.width || !outputMetadata.height) throw new Error(`Unsupported collection image: ${file}`);
  return { bytes, mime, width: outputMetadata.width, height: outputMetadata.height, hash: sha256(bytes) };
}

function resolveInside(root: string, value: string, label: string): string {
  const resolved = path.resolve(root, value);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`${label} must stay inside ${root}.`);
  return resolved;
}

async function planManifest(manifestPath: string): Promise<Plan> {
  const root = path.dirname(manifestPath);
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as Manifest;
  if (manifest.schemaVersion !== 1) throw new Error(`${manifestPath} must use schemaVersion 1.`);
  const gameSlug = manifest.game?.slug?.trim().toLowerCase();
  const collectionSlug = manifest.collection?.slug?.trim().toLowerCase();
  if (!SAFE_SLUG.test(gameSlug) || !SAFE_SLUG.test(collectionSlug)) throw new Error(`${manifestPath} has invalid GTA slugs.`);
  if (!manifest.game.name?.trim() || !manifest.collection.label?.trim()) throw new Error(`${manifestPath} needs game and collection labels.`);
  const pageType = manifest.collection.pageType ?? "database";
  if (pageType !== "database" && pageType !== "checklist") throw new Error(`${manifestPath} has an invalid collection.pageType.`);
  if (manifest.route && manifest.route !== `/gta/wiki/${gameSlug}/${collectionSlug}`) throw new Error(`${manifestPath} route does not match its slugs.`);
  const datasetPath = resolveInside(root, manifest.dataset, "dataset");
  const mediaRoot = resolveInside(root, manifest.mediaRoot, "mediaRoot");
  const finalPath = manifest.finalJson ? resolveInside(root, manifest.finalJson, "finalJson") : path.join(root, "final.json");
  const document = JSON.parse(await fs.readFile(datasetPath, "utf8")) as Dataset;
  if (document.meta?.schemaVersion !== 2 || !Array.isArray(document.items) || !document.items.length) {
    throw new Error(`${datasetPath} must be a non-empty schemaVersion 2 dataset.`);
  }
  if (document.meta.gameSlug !== gameSlug || document.meta.collection !== collectionSlug) {
    throw new Error(`${datasetPath} identity does not match its manifest.`);
  }
  const code = `${gameSlug}-${collectionSlug}`;
  const seen = new Set<string>();
  const items: PlannedItem[] = [];
  for (let index = 0; index < document.items.length; index += 1) {
    const row = document.items[index];
    const item = row.item ?? {};
    const system = row.system ?? {};
    const unexpectedSystem = Object.keys(system).filter((key) => !ALLOWED_SYSTEM_FIELDS.has(key));
    if (unexpectedSystem.length) throw new Error(`${code} row ${index + 1} has invalid system fields: ${unexpectedSystem.join(", ")}`);
    const forbiddenItem = Object.keys(item).filter((key) => FORBIDDEN_PUBLIC_FIELDS.has(key));
    if (forbiddenItem.length) throw new Error(`${code} row ${index + 1} exposes source/system fields: ${forbiddenItem.join(", ")}`);
    const itemName = typeof item.name === "string" ? item.name.trim() : "";
    if (!itemName) throw new Error(`${code} row ${index + 1} is missing name.`);
    const itemSlug = typeof system.slug === "string" && SAFE_SLUG.test(system.slug) ? system.slug : slugFromName(itemName);
    if (!itemSlug || seen.has(itemSlug)) throw new Error(`${code} has an invalid or duplicate item slug: ${itemSlug}.`);
    seen.add(itemSlug);
    const section = typeof system.section === "string" ? system.section.trim() : "";
    if (!section) throw new Error(`${code} row ${index + 1} is missing section.`);
    let image: Omit<PlannedItem, "item_slug" | "item_name" | "section" | "sort_order" | "fields_json"> = {
      image_key: null,
      image_mime: null,
      image_width: null,
      image_height: null,
      image_bytes: null,
      image_sha256: null,
      prepared_image: null
    };
    if (typeof system.image === "string" && system.image.trim()) {
      const relativeImage = system.image.replace(/^media\//, "");
      const source = resolveInside(mediaRoot, relativeImage, `image for ${itemSlug}`);
      const prepared = await prepareImage(source);
      image = {
        image_key: `gta/${gameSlug}/${collectionSlug}/${itemSlug}-${prepared.hash.slice(0, 16)}.${extensionForMime(prepared.mime)}`,
        image_mime: prepared.mime,
        image_width: prepared.width,
        image_height: prepared.height,
        image_bytes: prepared.bytes.byteLength,
        image_sha256: prepared.hash,
        prepared_image: prepared.bytes
      };
    }
    const { name: _name, ...fieldsJson } = item;
    items.push({
      item_slug: itemSlug,
      item_name: itemName,
      section,
      sort_order: Number.isInteger(system.sortOrder) ? Number(system.sortOrder) : index + 1,
      fields_json: fieldsJson,
      ...image
    });
  }
  const metaJson = {
    ...document.meta,
    runtime: {
      gameName: manifest.game.name.trim(),
      label: manifest.collection.label.trim(),
      pageType,
      source: "gta_wiki_collection_datasets"
    }
  };
  const hashDocument = {
    meta: metaJson,
    items: items.map(({ prepared_image: _bytes, ...item }) => item)
  };
  let finalJson: Record<string, unknown> | null = null;
  try {
    finalJson = JSON.parse(await fs.readFile(finalPath, "utf8")) as Record<string, unknown>;
  } catch (error) {
    if (publish || (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return { manifest, manifestPath, code, pageType, datasetPath, contentHash: sha256(JSON.stringify(stableValue(hashDocument))), metaJson, items, finalJson };
}

function resolveCountTokens<T>(value: T, count: number): T {
  if (typeof value === "string") return value.replaceAll("{count}", count.toLocaleString("en-US")) as T;
  if (Array.isArray(value)) return value.map((entry) => resolveCountTokens(entry, count)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, resolveCountTokens(entry, count)])) as T;
  }
  return value;
}

function pageCopy(plan: Plan) {
  if (!plan.finalJson) return null;
  const final = resolveCountTokens(plan.finalJson, plan.items.length);
  if (final.wiki_slug !== plan.manifest.game.slug || final.collection_slug !== plan.manifest.collection.slug || final.code !== plan.code) {
    throw new Error(`${plan.code} final.json identity does not match its manifest.`);
  }
  for (const key of ["title", "display_name", "seo_title", "meta_description"] as const) {
    if (typeof final[key] !== "string" || !final[key].trim()) throw new Error(`${plan.code} final.json is missing ${key}.`);
  }
  if (!final.description_json || typeof final.description_json !== "object" || Array.isArray(final.description_json)) throw new Error(`${plan.code} final.json needs description_json.`);
  if (!Array.isArray(final.faq_json)) throw new Error(`${plan.code} final.json needs faq_json.`);
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
    wiki_sort_order: Number.isFinite(final.wiki_sort_order) ? Number(final.wiki_sort_order) : plan.manifest.collection.sortOrder ?? 0
  };
}

async function uploadImages(plan: Plan, r2: R2Client) {
  await mapConcurrent(plan.items, 12, async (item) => {
    if (!item.image_key || !item.image_mime || !item.image_sha256 || !item.prepared_image) return;
    if (await r2.hasObject(item.image_key)) return;
    await r2.putObject({
      key: item.image_key,
      body: item.prepared_image,
      contentType: item.image_mime,
      metadata: { width: item.image_width ?? 0, height: item.image_height ?? 0, sha256: item.image_sha256 }
    });
  });
}

async function verifyImages(plan: Plan, r2: R2Client) {
  await mapConcurrent(plan.items, 12, async (item) => {
    if (item.image_key && !(await r2.hasObject(item.image_key))) throw new Error(`Missing R2 image for ${plan.code}/${item.item_slug}.`);
  });
}

async function publishPlan(plan: Plan, r2: R2Client | null) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      if (uploadMedia && r2) await uploadImages(plan, r2);
      if (publish && r2) await verifyImages(plan, r2);
      await applyPlan(plan);
      return;
    } catch (error) {
      if (attempt === 5 || !transientFailure(error)) throw error;
      const delayMs = 2_000 * 2 ** (attempt - 1);
      console.warn(`${plan.code} hit a transient production failure; retrying attempt ${attempt + 1}/5 in ${delayMs / 1000}s.`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function applyPlan(plan: Plan) {
  const sb = supabaseAdmin();
  const game = await sb.from("gta_games").select("id, slug").eq("slug", plan.manifest.game.slug).eq("is_published", true).maybeSingle();
  if (game.error) throw game.error;
  if (!game.data) throw new Error(`Publish the ${plan.manifest.game.slug} GTA game row before its collection.`);
  const wiki = await sb.from("gta_wiki_pages").select("id, game_id, slug").eq("slug", plan.manifest.game.slug).eq("is_published", true).maybeSingle();
  if (wiki.error) throw wiki.error;
  if (!wiki.data || wiki.data.game_id !== game.data.id) throw new Error(`Publish the ${plan.manifest.game.slug} GTA wiki row before its collection.`);
  const copy = pageCopy(plan);
  let pageQuery = await sb
    .from("gta_wiki_collection_pages")
    .select("id, game_id, wiki_page_id, wiki_slug, collection_slug, code, page_type, is_published, published_dataset_id")
    .eq("wiki_slug", plan.manifest.game.slug)
    .eq("collection_slug", plan.manifest.collection.slug)
    .maybeSingle();
  if (pageQuery.error) throw pageQuery.error;
  let page = pageQuery.data;
  if (!page) {
    if (!copy) throw new Error(`${plan.code} needs final.json before its page can be created.`);
    const inserted = await sb.from("gta_wiki_collection_pages").insert({
      ...copy,
      wiki_page_id: wiki.data.id,
      game_id: game.data.id,
      wiki_slug: plan.manifest.game.slug,
      collection_slug: plan.manifest.collection.slug,
      code: plan.code,
      page_type: plan.pageType,
      item_count: plan.items.length,
      is_published: false
    }).select("id, game_id, wiki_page_id, wiki_slug, collection_slug, code, page_type, is_published, published_dataset_id").single();
    if (inserted.error) throw inserted.error;
    page = inserted.data;
  }
  if (page.game_id !== game.data.id || page.wiki_page_id !== wiki.data.id || page.code !== plan.code) throw new Error(`${plan.code} page identity mismatch.`);
  let dataset = await sb.from("gta_wiki_collection_datasets").select("id, item_count").eq("collection_page_id", page.id).eq("content_hash", plan.contentHash).maybeSingle();
  if (dataset.error) throw dataset.error;
  if (!dataset.data) {
    const inserted = await sb.from("gta_wiki_collection_datasets").insert({
      collection_page_id: page.id,
      schema_version: 2,
      content_hash: plan.contentHash,
      item_count: plan.items.length,
      meta_json: plan.metaJson,
      validation_json: {
        checkedAt: new Date().toISOString(),
        schemaVersion: 2,
        rowCount: plan.items.length,
        imageCount: plan.items.filter((item) => item.image_key).length,
        missingImageCount: plan.items.filter((item) => !item.image_key).length
      },
      source_manifest_json: {
        runtimeManifestSchemaVersion: plan.manifest.schemaVersion,
        datasetFile: path.basename(plan.datasetPath),
        mediaPrefix: `gta/${plan.manifest.game.slug}/${plan.manifest.collection.slug}/`,
        sourceUrls: plan.manifest.sourceUrls
      }
    }).select("id, item_count").single();
    if (inserted.error) throw inserted.error;
    dataset = inserted;
    try {
      for (let start = 0; start < plan.items.length; start += 500) {
        const rows = plan.items.slice(start, start + 500).map(({ prepared_image: _bytes, ...item }) => ({ dataset_id: inserted.data.id, ...item }));
        const insertedItems = await sb.from("gta_wiki_collection_items").insert(rows);
        if (insertedItems.error) throw insertedItems.error;
      }
    } catch (error) {
      await sb.from("gta_wiki_collection_datasets").delete().eq("id", inserted.data.id);
      throw error;
    }
  }
  const count = await sb.from("gta_wiki_collection_items").select("id", { count: "exact", head: true }).eq("dataset_id", dataset.data.id);
  if (count.error) throw count.error;
  if (count.count !== plan.items.length || Number(dataset.data.item_count) !== plan.items.length) throw new Error(`${plan.code} dataset count mismatch.`);
  if (publish) {
    if (!copy) throw new Error(`${plan.code} cannot publish without final.json.`);
    const updated = await sb.from("gta_wiki_collection_pages").update({
      ...copy,
      page_type: plan.pageType,
      item_count: plan.items.length,
      published_dataset_id: dataset.data.id,
      is_published: true
    }).eq("id", page.id).select("published_dataset_id, item_count").single();
    if (updated.error) throw updated.error;
    if (updated.data.published_dataset_id !== dataset.data.id || updated.data.item_count !== plan.items.length) throw new Error(`${plan.code} published pointer mismatch.`);
  }
}

async function main() {
  if (!manifestPaths.length) throw new Error("At least one --manifest is required.");
  if (publish && !apply) throw new Error("--publish requires --apply.");
  if (uploadMedia && !apply) throw new Error("--upload-media requires --apply.");
  const managed = isManagedDevelopmentSupabaseUrl(process.env.SUPABASE_URL);
  const production = isProductionSupabaseUrl(process.env.SUPABASE_URL);
  if (apply && !managed && !allowProd) throw new Error("GTA collection writes default to managed development; production requires --allow-prod.");
  if (allowProd && (!apply || !production)) throw new Error("--allow-prod requires --apply and the recognized production target.");
  const plans: Plan[] = [];
  for (const manifestPath of manifestPaths) plans.push(await planManifest(manifestPath));
  console.table(plans.map((plan) => ({ code: plan.code, items: plan.items.length, images: plan.items.filter((item) => item.image_key).length, contentHash: plan.contentHash })));
  if (!apply) return;
  const r2Config = uploadMedia || publish ? loadR2ClientConfig(process.env) : null;
  if (r2Config && r2Config.bucket !== "bloxodes-wiki") throw new Error(`Expected shared R2 bucket bloxodes-wiki, received ${r2Config.bucket}.`);
  const r2 = r2Config ? new R2Client(r2Config) : null;
  for (const plan of plans) {
    await publishPlan(plan, r2);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
