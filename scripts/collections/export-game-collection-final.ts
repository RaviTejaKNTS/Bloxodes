import "../shared/load-env";

import fs from "node:fs/promises";
import path from "node:path";

import { getGameCollectionConfigByWikiPath } from "@/lib/game-collections";
import { repoPath } from "@/lib/paths";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isManagedDevelopmentSupabaseUrl } from "../shared/supabase-target";

type CliOptions = {
  game: string | null;
  collection: string | null;
  outputRoot: string | null;
  allowRemoteRead: boolean;
  force: boolean;
  dryRun: boolean;
  workspace: boolean;
};

type CollectionPageRow = {
  universe_id?: number | null;
  wiki_slug: string;
  collection_slug: string;
  code: string;
  display_name?: string | null;
  title?: string | null;
  seo_title?: string | null;
  meta_description?: string | null;
  intro_md?: string | null;
  description_md?: string | null;
  how_it_works_md?: string | null;
  description_json?: Record<string, string> | null;
  faq_json?: Array<{ q: string; a: string }> | null;
  wiki_md?: string | null;
  is_published?: boolean | null;
  item_count?: number | null;
  published_dataset_id?: string | null;
  schema_ld_json?: Record<string, unknown> | null;
  thumb_url?: string | null;
  wiki_sort_order?: number | null;
};

type CollectionDatasetRow = {
  id: string;
  schema_version?: number | null;
  item_count?: number | null;
  meta_json?: Record<string, unknown> | null;
  source_manifest_json?: Record<string, unknown> | null;
};

type CollectionItemRow = {
  item_slug: string;
  item_name: string;
  section: string;
  sort_order: number;
  image_key?: string | null;
  fields_json?: Record<string, unknown> | null;
};

function printUsage() {
  console.log(`Usage:
  npm run export:game-collection-final -- --game <game-slug> --collection <collection-slug> --output-root <directory> [options]

Options:
  --allow-remote-read   Allow an intentional read-only export outside managed development.
  --workspace           Export dataset.json, media/, final.json, and runtime-manifest.json.
  --force               Replace an existing final.json.
  --dry-run             Print the final JSON without writing a file.
  -h, --help            Show this help.

This helper reads one wiki_collection_pages row and writes no database data.
`);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    game: null,
    collection: null,
    outputRoot: null,
    allowRemoteRead: false,
    force: false,
    dryRun: false,
    workspace: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "-h":
      case "--help":
        printUsage();
        process.exit(0);
      case "--game":
      case "--game-slug":
        options.game = requireValue(argv, ++index, arg).toLowerCase();
        break;
      case "--collection":
      case "--collection-slug":
        options.collection = requireValue(argv, ++index, arg).toLowerCase();
        break;
      case "--output-root":
      case "--final-json-root":
        options.outputRoot = requireValue(argv, ++index, arg);
        break;
      case "--allow-remote-read":
        options.allowRemoteRead = true;
        break;
      case "--force":
        options.force = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--workspace":
        options.workspace = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (!options.game) throw new Error("--game is required");
  if (!options.collection) throw new Error("--collection is required");
  if (!options.dryRun && !options.outputRoot) throw new Error("--output-root is required unless --dry-run is used");
  return options;
}

function requireValue(argv: string[], index: number, option: string): string {
  const value = argv[index]?.trim();
  if (!value) throw new Error(`Missing value for ${option}`);
  return value;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function restoreCountToken(value: string | null | undefined, itemCount: number | null | undefined): string {
  const text = value?.trim() ?? "";
  if (!text || /\{\s*(?:count|item_count)\s*\}/i.test(text) || !itemCount) return text;
  const labels = Array.from(new Set([itemCount.toLocaleString("en-US"), String(itemCount)]));
  for (const label of labels) {
    const pattern = new RegExp(`\\bAll\\s+${escapeRegExp(label)}(?=\\D|$)`, "i");
    if (pattern.test(text)) {
      return text.replace(pattern, (match) => match.replace(label, "{count}"));
    }
  }
  return text;
}

async function pathExists(target: string) {
  try {
    return (await fs.stat(target)).isFile();
  } catch {
    return false;
  }
}

function sourceUrlsFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.flatMap((entry) => {
    const candidate = typeof entry === "string"
      ? entry
      : entry && typeof entry === "object" && typeof (entry as { url?: unknown }).url === "string"
        ? String((entry as { url: string }).url)
        : "";
    try {
      const url = new URL(candidate);
      return url.protocol === "https:" ? [url.toString()] : [];
    } catch {
      return [];
    }
  })));
}

function imageFilename(key: string) {
  const filename = key.split("/").pop()?.trim();
  if (!filename || filename === "." || filename === "..") throw new Error(`Invalid database image key: ${key}`);
  return filename;
}

async function mapWithConcurrency<T>(values: T[], concurrency: number, work: (value: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= values.length) return;
      await work(values[index]);
    }
  }));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = getGameCollectionConfigByWikiPath(options.game!, options.collection!);
  if (!config) throw new Error(`No registered collection config for ${options.game}/${options.collection}`);

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE;
  if (!supabaseUrl || !serviceRole) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE");
  if (!isManagedDevelopmentSupabaseUrl(supabaseUrl) && !options.allowRemoteRead) {
    throw new Error("Refusing a read outside managed development. Pass --allow-remote-read for an intentional remote export.");
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("wiki_collection_pages")
    .select(
      "universe_id,wiki_slug,collection_slug,code,display_name,title,seo_title,meta_description,intro_md,description_md,how_it_works_md,description_json,faq_json,wiki_md,is_published,item_count,published_dataset_id,schema_ld_json,thumb_url,wiki_sort_order"
    )
    .eq("wiki_slug", options.game!)
    .eq("collection_slug", options.collection!)
    .maybeSingle();
  if (error) throw new Error(`Failed to read collection page: ${error.message}`);
  if (!data) throw new Error(`No wiki_collection_pages row found for ${options.game}/${options.collection}`);

  const row = data as CollectionPageRow;
  const finalJson = {
    universe_id: row.universe_id ?? 0,
    wiki_slug: row.wiki_slug,
    collection_slug: row.collection_slug,
    code: row.code,
    display_name: row.display_name ?? config.label,
    title: restoreCountToken(row.title, row.item_count),
    seo_title: restoreCountToken(row.seo_title, row.item_count),
    meta_description: row.meta_description ?? "",
    intro_md: row.intro_md ?? "",
    description_md: row.description_md ?? "",
    how_it_works_md: row.how_it_works_md ?? "",
    description_json: row.description_json ?? {},
    faq_json: row.faq_json ?? [],
    wiki_md: row.wiki_md ?? "",
    wiki_sort_order: row.wiki_sort_order ?? config.sortOrder,
    schema_ld_json: row.schema_ld_json ?? null,
    thumb_url: row.thumb_url ?? null,
    is_published: row.is_published ?? true
  };
  const serialized = `${JSON.stringify(finalJson, null, 2)}\n`;

  if (options.dryRun && !options.workspace) {
    process.stdout.write(serialized);
    return;
  }

  const root = path.isAbsolute(options.outputRoot!) ? options.outputRoot! : repoPath(options.outputRoot!);
  const workspace = path.join(root, options.collection!);
  const target = path.join(workspace, "final.json");
  if (!options.workspace) {
    if ((await pathExists(target)) && !options.force) {
      throw new Error(`Refusing to overwrite existing file: ${target}. Pass --force only after reviewing it.`);
    }
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, serialized);
    console.log(`Exported read-only page snapshot: ${target}`);
    if (row.item_count && !finalJson.title.includes("{count}")) {
      console.log("Warning: title did not contain the stored item count; review the title token before verification.");
    }
    return;
  }

  if (!row.published_dataset_id) throw new Error(`${row.code} has no published dataset pointer.`);
  const universeId = Number(row.universe_id);
  if (!Number.isSafeInteger(universeId) || universeId <= 0) {
    throw new Error(`${row.code} has an invalid universe_id.`);
  }
  const { data: datasetData, error: datasetError } = await sb
    .from("wiki_collection_datasets")
    .select("id,schema_version,item_count,meta_json,source_manifest_json")
    .eq("id", row.published_dataset_id)
    .maybeSingle();
  if (datasetError) throw new Error(`Failed to read collection dataset: ${datasetError.message}`);
  if (!datasetData) throw new Error(`Published dataset ${row.published_dataset_id} is missing.`);
  const dataset = datasetData as CollectionDatasetRow;
  const { data: itemData, error: itemError } = await sb
    .from("wiki_collection_items")
    .select("item_slug,item_name,section,sort_order,image_key,fields_json")
    .eq("dataset_id", dataset.id)
    .order("sort_order")
    .order("item_slug");
  if (itemError) throw new Error(`Failed to read collection items: ${itemError.message}`);
  const items = (itemData ?? []) as CollectionItemRow[];
  if (items.length !== Number(dataset.item_count) || items.length !== Number(row.item_count)) {
    throw new Error(`${row.code} item count mismatch: page=${row.item_count} dataset=${dataset.item_count} rows=${items.length}.`);
  }

  const sourceManifest = dataset.source_manifest_json ?? {};
  const meta = dataset.meta_json ?? {};
  const sourceUrls = Array.from(new Set([
    ...sourceUrlsFrom(sourceManifest.sourceUrls),
    ...sourceUrlsFrom(meta.sources),
    ...sourceUrlsFrom(meta.sourceUrls)
  ]));
  if (!sourceUrls.length) {
    console.error(`Warning: ${row.code} has no HTTPS source URLs in its published revision. Add verified sourceUrls to runtime-manifest.json before publishing a refresh.`);
  }

  const filenameOwners = new Map<string, string>();
  const imageKeys = Array.from(new Set(items.flatMap((item) => item.image_key ? [item.image_key] : [])));
  for (const key of imageKeys) {
    const filename = imageFilename(key);
    const owner = filenameOwners.get(filename);
    if (owner && owner !== key) throw new Error(`Image filename collision in ${row.code}: ${owner} and ${key}`);
    filenameOwners.set(filename, key);
  }
  const datasetDocument = {
    meta: {
      ...meta,
      schemaVersion: dataset.schema_version ?? 2,
      sources: sourceUrls
    },
    items: items.map((item) => ({
      item: { name: item.item_name, ...(item.fields_json ?? {}) },
      system: {
        slug: item.item_slug,
        section: item.section,
        sortOrder: item.sort_order,
        image: item.image_key ? imageFilename(item.image_key) : null
      }
    }))
  };
  const manifest = {
    schemaVersion: 1,
    game: { slug: row.wiki_slug, name: config.gameName, universeId },
    collection: { slug: row.collection_slug, label: row.display_name ?? config.label, sortOrder: row.wiki_sort_order ?? config.sortOrder },
    dataset: "dataset.json",
    finalJson: "final.json",
    mediaRoot: "media",
    sourceUrls
  };
  const outputs = [target, path.join(workspace, "dataset.json"), path.join(workspace, "runtime-manifest.json")];
  if (!options.force) {
    const existing = [] as string[];
    for (const output of outputs) if (await pathExists(output)) existing.push(output);
    if (existing.length) throw new Error(`Refusing to overwrite existing workspace files: ${existing.join(", ")}. Pass --force after review.`);
  }
  if (options.dryRun) {
    console.log(JSON.stringify({ code: row.code, itemCount: items.length, imageCount: imageKeys.length, sourceUrls, output: workspace }, null, 2));
    return;
  }

  const mediaRoot = path.join(workspace, "media");
  await fs.mkdir(mediaRoot, { recursive: true });
  await mapWithConcurrency(imageKeys, 16, async (key) => {
    const response = await fetch(`https://media.bloxodes.com/wiki/${key}`, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`Failed to export ${key}: HTTP ${response.status}`);
    await fs.writeFile(path.join(mediaRoot, imageFilename(key)), Buffer.from(await response.arrayBuffer()));
  });
  await Promise.all([
    fs.writeFile(target, serialized),
    fs.writeFile(path.join(workspace, "dataset.json"), `${JSON.stringify(datasetDocument, null, 2)}\n`),
    fs.writeFile(path.join(workspace, "runtime-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)
  ]);
  console.log(`Exported database-backed authoring workspace: ${workspace}`);
  console.log(`Rows: ${items.length}; media: ${imageKeys.length}; sources: ${sourceUrls.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
