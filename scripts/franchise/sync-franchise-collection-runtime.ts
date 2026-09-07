import "../shared/load-env";

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { loadR2ClientConfig, R2Client } from "../shared/r2-client";
import { isManagedDevelopmentSupabaseUrl, isProductionSupabaseUrl } from "../shared/supabase-target";

type Namespace = "gta" | "red-dead";

type FranchiseConfig = {
  label: string;
  routePrefix: string;
  tablePrefix: string;
  mediaPrefix: string;
};

const FRANCHISES: Record<Namespace, FranchiseConfig> = {
  gta: { label: "GTA", routePrefix: "/gta/wiki", tablePrefix: "gta", mediaPrefix: "gta" },
  "red-dead": { label: "Red Dead", routePrefix: "/red-dead/wiki", tablePrefix: "red_dead", mediaPrefix: "red-dead" }
};

type Manifest = {
  schemaVersion: 1;
  namespace?: Namespace;
  game: { slug: string; name: string };
  collection: { slug: string; label: string; sortOrder?: number; pageType?: "database" | "collectible" };
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
  config: FranchiseConfig;
  namespace: Namespace;
  manifest: Manifest;
  manifestPath: string;
  code: string;
  pageType: "database" | "collectible";
  datasetPath: string;
  contentHash: string;
  metaJson: Record<string, unknown>;
  items: PlannedItem[];
  finalJson: Record<string, unknown> | null;
};

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const publish = argv.includes("--publish");
const uploadMedia = argv.includes("--upload-media");
const allowProd = argv.includes("--allow-prod");
const namespace = value("--namespace") as Namespace | "";
const manifestPaths = collectValues("--manifest").map((entry) => path.resolve(entry));
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ALLOWED_SYSTEM_FIELDS = new Set(["slug", "section", "sortOrder", "image"]);
const FORBIDDEN_PUBLIC_FIELDS = new Set([
  "slug", "section", "sortOrder", "image", "sourceUrl", "source_url", "sourcePage", "source_page",
  "sourceImageUrl", "source_image_url", "verificationNote", "rawText", "fields"
]);

function usage(): never {
  console.log(
    "Usage: npm run sync:franchise-collection-runtime -- --namespace <gta|red-dead> --manifest <runtime-manifest.json> [--apply] [--upload-media] [--publish] [--allow-prod]"
  );
  process.exit(0);
}

function value(flag: string): string {
  const index = argv.indexOf(flag);
  return index === -1 ? "" : (argv[index + 1] ?? "").trim();
}

function collectValues(flag: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === flag && argv[index + 1]) values.push(argv[++index]!);
    else if (argv[index]?.startsWith(`${flag}=`)) values.push(argv[index]!.slice(flag.length + 1));
  }
  return [...new Set(values.map((entry) => entry.trim()).filter(Boolean))];
}

if (argv.includes("--help") || argv.includes("-h")) usage();
if (!(namespace in FRANCHISES)) throw new Error("--namespace must be gta or red-dead.");
if (!manifestPaths.length) throw new Error("At least one --manifest is required.");
if (publish && !apply) throw new Error("--publish requires --apply.");
if (uploadMedia && !apply) throw new Error("--upload-media requires --apply.");

function sha256(value: string | Uint8Array): string {
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

function slugFromName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

async function prepareImage(file: string) {
  const original = await fs.readFile(file);
  const metadata = await sharp(original, { animated: true }).metadata();
  const originalMime = mimeForFormat(metadata.format);
  const withinPolicy = Boolean(originalMime) && original.byteLength <= 1_000_000 && (metadata.width ?? 0) <= 960 && (metadata.height ?? 0) <= 960;
  const bytes = withinPolicy
    ? original
    : await sharp(original, { animated: true })
        .rotate()
        .resize({ width: 960, height: 960, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 86 })
        .toBuffer();
  const outputMetadata = await sharp(bytes, { animated: true }).metadata();
  const mime = mimeForFormat(outputMetadata.format);
  if (!mime || !outputMetadata.width || !outputMetadata.height) throw new Error(`Unsupported collection image: ${file}`);
  return { bytes, mime, width: outputMetadata.width, height: outputMetadata.height, hash: sha256(bytes) };
}

function resolveInside(root: string, valueToResolve: string, label: string): string {
  const resolved = path.resolve(root, valueToResolve);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`${label} must stay inside ${root}.`);
  return resolved;
}

async function planManifest(namespaceValue: Namespace, manifestPath: string): Promise<Plan> {
  const config = FRANCHISES[namespaceValue];
  const root = path.dirname(manifestPath);
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as Manifest;
  if (manifest.schemaVersion !== 1) throw new Error(`${manifestPath} must use schemaVersion 1.`);
  if (manifest.namespace && manifest.namespace !== namespaceValue) throw new Error(`${manifestPath} namespace does not match --namespace.`);
  const gameSlug = manifest.game?.slug?.trim().toLowerCase();
  const collectionSlug = manifest.collection?.slug?.trim().toLowerCase();
  if (!SAFE_SLUG.test(gameSlug) || !SAFE_SLUG.test(collectionSlug)) throw new Error(`${manifestPath} has invalid slugs.`);
  if (!manifest.game.name?.trim() || !manifest.collection.label?.trim()) throw new Error(`${manifestPath} needs game and collection labels.`);
  const pageType = String(manifest.collection.pageType) === "checklist" ? "collectible" : manifest.collection.pageType ?? "database";
  if (pageType !== "database" && pageType !== "collectible") throw new Error(`${manifestPath} has an invalid collection.pageType.`);
  const expectedRoute = `${config.routePrefix}/${gameSlug}/${collectionSlug}`;
  if (manifest.route && manifest.route !== expectedRoute) throw new Error(`${manifestPath} route does not match its slugs.`);
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

  const seen = new Set<string>();
  const items: PlannedItem[] = [];
  for (let index = 0; index < document.items.length; index += 1) {
    const row = document.items[index];
    const item = row.item ?? {};
    const system = row.system ?? {};
    const unexpectedSystem = Object.keys(system).filter((key) => !ALLOWED_SYSTEM_FIELDS.has(key));
    if (unexpectedSystem.length) throw new Error(`${gameSlug}-${collectionSlug} row ${index + 1} has invalid system fields: ${unexpectedSystem.join(", ")}`);
    const forbiddenItem = Object.keys(item).filter((key) => FORBIDDEN_PUBLIC_FIELDS.has(key));
    if (forbiddenItem.length) throw new Error(`${gameSlug}-${collectionSlug} row ${index + 1} exposes source/system fields: ${forbiddenItem.join(", ")}`);
    const itemName = typeof item.name === "string" ? item.name.trim() : "";
    if (!itemName) throw new Error(`${gameSlug}-${collectionSlug} row ${index + 1} is missing name.`);
    const itemSlug = typeof system.slug === "string" && SAFE_SLUG.test(system.slug) ? system.slug : slugFromName(itemName);
    if (!itemSlug || seen.has(itemSlug)) throw new Error(`${gameSlug}-${collectionSlug} has an invalid or duplicate item slug: ${itemSlug}.`);
    seen.add(itemSlug);
    const section = typeof system.section === "string" ? system.section.trim() : "";
    if (!section) throw new Error(`${gameSlug}-${collectionSlug} row ${index + 1} is missing section.`);

    let image = {
      image_key: null as string | null,
      image_mime: null as string | null,
      image_width: null as number | null,
      image_height: null as number | null,
      image_bytes: null as number | null,
      image_sha256: null as string | null,
      prepared_image: null as Buffer | null
    };
    if (typeof system.image === "string" && system.image.trim()) {
      const relativeImage = system.image.replace(/^media\//, "");
      const source = resolveInside(mediaRoot, relativeImage, `image for ${itemSlug}`);
      const prepared = await prepareImage(source);
      image = {
        image_key: `${config.mediaPrefix}/${gameSlug}/${collectionSlug}/${itemSlug}-${prepared.hash.slice(0, 16)}.${extensionForMime(prepared.mime)}`,
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
      namespace: namespaceValue,
      source: `${config.tablePrefix}_wiki_collection_datasets`
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

  return {
    config,
    namespace: namespaceValue,
    manifest,
    manifestPath,
    code: `${gameSlug}-${collectionSlug}`,
    pageType,
    datasetPath,
    contentHash: sha256(JSON.stringify(stableValue(hashDocument))),
    metaJson,
    items,
    finalJson
  };
}

function resolveCountTokens<T>(valueToResolve: T, count: number): T {
  if (typeof valueToResolve === "string") return valueToResolve.replaceAll("{count}", count.toLocaleString("en-US")) as T;
  if (Array.isArray(valueToResolve)) return valueToResolve.map((entry) => resolveCountTokens(entry, count)) as T;
  if (valueToResolve && typeof valueToResolve === "object") {
    return Object.fromEntries(Object.entries(valueToResolve as Record<string, unknown>).map(([key, entry]) => [key, resolveCountTokens(entry, count)])) as T;
  }
  return valueToResolve;
}

function pageCopy(plan: Plan): Record<string, unknown> | null {
  if (!plan.finalJson) return null;
  const final = resolveCountTokens(plan.finalJson, plan.items.length);
  const gameSlug = plan.manifest.game.slug;
  const collectionSlug = plan.manifest.collection.slug;
  if (final.wiki_slug !== gameSlug || final.collection_slug !== collectionSlug || final.code !== plan.code) {
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
  for (const item of plan.items) {
    if (!item.image_key || !item.image_mime || !item.image_sha256 || !item.prepared_image) continue;
    if (await r2.hasObject(item.image_key)) continue;
    await r2.putObject({
      key: item.image_key,
      body: item.prepared_image,
      contentType: item.image_mime,
      metadata: { width: item.image_width ?? 0, height: item.image_height ?? 0, sha256: item.image_sha256 }
    });
  }
}

async function verifyImages(plan: Plan, r2: R2Client) {
  for (const item of plan.items) {
    if (item.image_key && !(await r2.hasObject(item.image_key))) throw new Error(`Missing R2 image for ${plan.code}/${item.item_slug}.`);
  }
}

function tableName(config: FranchiseConfig, suffix: string): string {
  return `${config.tablePrefix}_${suffix}`;
}

async function applyPlan(plan: Plan) {
  const sb = supabaseAdmin();
  const gameTable = tableName(plan.config, "games");
  const wikiTable = tableName(plan.config, "wiki_pages");
  const pagesTable = tableName(plan.config, "wiki_collection_pages");
  const datasetsTable = tableName(plan.config, "wiki_collection_datasets");
  const itemsTable = tableName(plan.config, "wiki_collection_items");
  const game = await sb.from(gameTable).select("id, slug").eq("slug", plan.manifest.game.slug).eq("is_published", true).maybeSingle();
  if (game.error) throw game.error;
  if (!game.data) throw new Error(`Publish the ${plan.manifest.game.slug} ${plan.config.label} game row before its collection.`);
  const wiki = await sb.from(wikiTable).select("id, game_id, slug").eq("slug", plan.manifest.game.slug).eq("is_published", true).maybeSingle();
  if (wiki.error) throw wiki.error;
  if (!wiki.data || wiki.data.game_id !== game.data.id) throw new Error(`Publish the ${plan.manifest.game.slug} ${plan.config.label} wiki row before its collection.`);
  const copy = pageCopy(plan);
  let pageQuery = await sb
    .from(pagesTable)
    .select("id, game_id, wiki_page_id, wiki_slug, collection_slug, code, page_type, is_published, published_dataset_id")
    .eq("wiki_slug", plan.manifest.game.slug)
    .eq("collection_slug", plan.manifest.collection.slug)
    .maybeSingle();
  if (pageQuery.error) throw pageQuery.error;
  let page = pageQuery.data;
  if (!page) {
    if (!copy) throw new Error(`${plan.code} needs final.json before its page can be created.`);
    const inserted = await sb.from(pagesTable).insert({
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

  let dataset = await sb.from(datasetsTable).select("id, item_count").eq("collection_page_id", page.id).eq("content_hash", plan.contentHash).maybeSingle();
  if (dataset.error) throw dataset.error;
  if (!dataset.data) {
    const inserted = await sb.from(datasetsTable).insert({
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
        namespace: plan.namespace,
        datasetFile: path.basename(plan.datasetPath),
        mediaPrefix: `${plan.config.mediaPrefix}/${plan.manifest.game.slug}/${plan.manifest.collection.slug}/`,
        sourceUrls: plan.manifest.sourceUrls
      }
    }).select("id, item_count").single();
    if (inserted.error) throw inserted.error;
    dataset = inserted;
    try {
      for (let start = 0; start < plan.items.length; start += 500) {
        const rows = plan.items.slice(start, start + 500).map(({ prepared_image: _bytes, ...item }) => ({ dataset_id: inserted.data.id, ...item }));
        const insertedItems = await sb.from(itemsTable).insert(rows);
        if (insertedItems.error) throw insertedItems.error;
      }
    } catch (error) {
      await sb.from(datasetsTable).delete().eq("id", inserted.data.id);
      throw error;
    }
  }
  const count = await sb.from(itemsTable).select("id", { count: "exact", head: true }).eq("dataset_id", dataset.data.id);
  if (count.error) throw count.error;
  if (count.count !== plan.items.length || Number(dataset.data.item_count) !== plan.items.length) throw new Error(`${plan.code} dataset count mismatch.`);
  if (publish) {
    if (!copy) throw new Error(`${plan.code} cannot publish without final.json.`);
    const updated = await sb.from(pagesTable).update({
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
  const namespaceValue = namespace as Namespace;
  const config = FRANCHISES[namespaceValue];
  const managed = isManagedDevelopmentSupabaseUrl(process.env.SUPABASE_URL);
  const production = isProductionSupabaseUrl(process.env.SUPABASE_URL);
  if (apply && !managed && !allowProd) throw new Error(`${config.label} collection writes default to managed development; production requires --allow-prod.`);
  if (allowProd && (!apply || !production)) throw new Error("--allow-prod requires --apply and the recognized production target.");

  const plans: Plan[] = [];
  for (const manifestPath of manifestPaths) plans.push(await planManifest(namespaceValue, manifestPath));
  console.table(plans.map((plan) => ({ namespace: plan.namespace, code: plan.code, pageType: plan.pageType, items: plan.items.length, images: plan.items.filter((item) => item.image_key).length, contentHash: plan.contentHash })));
  if (!apply) return;

  const needsR2 = plans.some((plan) => plan.items.some((item) => item.image_key));
  const r2Config = needsR2 && (uploadMedia || publish) ? loadR2ClientConfig(process.env) : null;
  if (r2Config && r2Config.bucket !== "bloxodes-wiki") throw new Error(`Expected shared R2 bucket bloxodes-wiki, received ${r2Config.bucket}.`);
  const r2 = r2Config ? new R2Client(r2Config) : null;
  for (const plan of plans) {
    if (uploadMedia && r2) await uploadImages(plan, r2);
    if (publish && r2) await verifyImages(plan, r2);
    await applyPlan(plan);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
