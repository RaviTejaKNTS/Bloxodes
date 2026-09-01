import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { readBloxodesEnvFile } from "../shared/env-files";
import {
  assertManagedDevelopmentSupabaseUrl,
  isProductionSupabaseUrl
} from "../shared/supabase-target";

type Row = Record<string, unknown>;

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const requestedCodes = collectValues("--code");
const PAGE_SIZE = 1000;
const INSERT_BATCH_SIZE = 500;

function collectValues(name: string): Set<string> {
  const values = new Set<string>();
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === name && argv[index + 1]) values.add(argv[++index].trim().toLowerCase());
    else if (value.startsWith(`${name}=`)) values.add(value.slice(name.length + 1).trim().toLowerCase());
  }
  return values;
}

function required(env: Record<string, string>, key: string, file: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Missing ${key} in ${file}.`);
  return value;
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function fetchAll(
  client: SupabaseClient,
  table: string,
  select: string,
  configure?: (query: any) => any
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = client.from(table).select(select).range(from, from + PAGE_SIZE - 1);
    if (configure) query = configure(query);
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

function pageCopy(
  source: Row,
  wikiPageId: string | null,
  universeId: string | number | null
): Row {
  return {
    wiki_page_id: wikiPageId,
    universe_id: universeId,
    wiki_slug: source.wiki_slug,
    collection_slug: source.collection_slug,
    code: source.code,
    title: source.title,
    display_name: source.display_name,
    item_count: source.item_count,
    seo_title: source.seo_title ?? null,
    meta_description: source.meta_description ?? null,
    intro_md: source.intro_md ?? null,
    how_it_works_md: source.how_it_works_md ?? null,
    description_md: source.description_md ?? null,
    description_json: source.description_json ?? {},
    faq_json: source.faq_json ?? [],
    schema_ld_json: source.schema_ld_json ?? null,
    thumb_url: source.thumb_url ?? null,
    wiki_md: source.wiki_md ?? null,
    wiki_sort_order: source.wiki_sort_order ?? 0,
    is_published: true,
    published_at: source.published_at ?? null
  };
}

function datasetCopy(source: Row, targetPageId: string): Row {
  return {
    collection_page_id: targetPageId,
    schema_version: source.schema_version,
    content_hash: source.content_hash,
    item_count: source.item_count,
    meta_json: source.meta_json ?? {},
    validation_json: source.validation_json ?? {},
    source_manifest_json: source.source_manifest_json ?? {}
  };
}

function itemCopy(source: Row, targetDatasetId: string): Row {
  return {
    dataset_id: targetDatasetId,
    item_slug: source.item_slug,
    item_name: source.item_name,
    section: source.section,
    sort_order: source.sort_order,
    image_key: source.image_key ?? null,
    image_mime: source.image_mime ?? null,
    image_width: source.image_width ?? null,
    image_height: source.image_height ?? null,
    image_bytes: source.image_bytes ?? null,
    image_sha256: source.image_sha256 ?? null,
    fields_json: source.fields_json ?? {}
  };
}

async function countItems(client: SupabaseClient, datasetId: string): Promise<number> {
  const { count, error } = await client
    .from("wiki_collection_items")
    .select("id", { count: "exact", head: true })
    .eq("dataset_id", datasetId);
  if (error) throw new Error(`wiki_collection_items count: ${error.message}`);
  return count ?? 0;
}

async function main() {
  const productionEnv = readBloxodesEnvFile("targets/production.env");
  const managedDevEnv = readBloxodesEnvFile("targets/managed-dev.env");
  const productionUrl = required(productionEnv, "SUPABASE_URL", ".envs/targets/production.env");
  const productionKey = required(productionEnv, "SUPABASE_SERVICE_ROLE", ".envs/targets/production.env");
  const managedDevUrl = required(managedDevEnv, "SUPABASE_URL", ".envs/targets/managed-dev.env");
  const managedDevKey = required(managedDevEnv, "SUPABASE_SERVICE_ROLE", ".envs/targets/managed-dev.env");

  if (!isProductionSupabaseUrl(productionUrl)) throw new Error("Source is not the production Supabase target.");
  assertManagedDevelopmentSupabaseUrl(managedDevUrl, "wiki collection runtime convergence");

  const source = createClient(productionUrl, productionKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const target = createClient(managedDevUrl, managedDevKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const [sourcePages, targetPages, targetWikiPages, sourceDatasets, targetDatasets] = await Promise.all([
    fetchAll(
      source,
      "wiki_collection_pages",
      "id, wiki_page_id, universe_id, wiki_slug, collection_slug, code, title, display_name, item_count, seo_title, meta_description, intro_md, how_it_works_md, description_md, description_json, faq_json, schema_ld_json, thumb_url, wiki_md, wiki_sort_order, is_published, published_at, published_dataset_id",
      (query) => query.eq("is_published", true).not("published_dataset_id", "is", null).order("code")
    ),
    fetchAll(target, "wiki_collection_pages", "id, code, wiki_page_id, universe_id, published_dataset_id"),
    fetchAll(target, "wiki_pages", "id, slug, universe_id"),
    fetchAll(
      source,
      "wiki_collection_datasets",
      "id, collection_page_id, schema_version, content_hash, item_count, meta_json, validation_json, source_manifest_json"
    ),
    fetchAll(target, "wiki_collection_datasets", "id, collection_page_id, content_hash, item_count")
  ]);

  const filteredPages = sourcePages.filter((page) => {
    const code = String(page.code).toLowerCase();
    return requestedCodes.size === 0 || requestedCodes.has(code);
  });
  const targetByCode = new Map(targetPages.map((page) => [String(page.code), page]));
  const targetWikiBySlug = new Map(targetWikiPages.map((page) => [String(page.slug), page]));
  const sourceDatasetById = new Map(sourceDatasets.map((dataset) => [String(dataset.id), dataset]));
  const targetDatasetByOwnerAndHash = new Map(
    targetDatasets.map((dataset) => [
      `${String(dataset.collection_page_id)}\u0000${String(dataset.content_hash)}`,
      dataset
    ])
  );

  let reused = 0;
  let inserted = 0;
  let createdPages = 0;
  let copiedItems = 0;

  console.log(`Mode: ${apply ? "write managed development" : "dry run"}`);
  console.log(`Published production revisions selected: ${filteredPages.length}`);

  for (let index = 0; index < filteredPages.length; index += 1) {
    const sourcePage = filteredPages[index];
    const code = String(sourcePage.code);
    const sourceDatasetId = String(sourcePage.published_dataset_id);
    const sourceDataset = sourceDatasetById.get(sourceDatasetId);
    if (!sourceDataset) throw new Error(`${code}: production dataset ${sourceDatasetId} is missing.`);

    let targetPage = targetByCode.get(code);
    if (!targetPage) {
      const targetWikiPage = targetWikiBySlug.get(String(sourcePage.wiki_slug));
      const wikiPageId = targetWikiPage ? String(targetWikiPage.id) : null;
      const universeId = targetWikiPage?.universe_id == null ? null : String(targetWikiPage.universe_id);
      if (!apply) {
        targetPage = { id: `dry-run-page:${code}`, code, published_dataset_id: null };
      } else {
        const { data, error } = await target
          .from("wiki_collection_pages")
          .insert(pageCopy(sourcePage, wikiPageId, universeId))
          .select("id, code, wiki_page_id, universe_id, published_dataset_id")
          .single();
        if (error || !data) throw new Error(`${code}: target page insert failed: ${error?.message ?? "missing"}`);
        targetPage = data as Row;
        targetByCode.set(code, targetPage);
      }
      createdPages += 1;
    }

    const targetPageId = String(targetPage.id);
    const existingDataset = targetDatasetByOwnerAndHash.get(
      `${targetPageId}\u0000${String(sourceDataset.content_hash)}`
    );

    let targetDatasetId: string;
    if (existingDataset) {
      targetDatasetId = String(existingDataset.id);
      if (Number(existingDataset.item_count) !== Number(sourceDataset.item_count)) {
        throw new Error(`${code}: existing target revision declares ${existingDataset.item_count} rows, expected ${sourceDataset.item_count}.`);
      }
      reused += 1;
    } else if (!apply) {
      targetDatasetId = `dry-run-dataset:${code}`;
      inserted += 1;
      copiedItems += Number(sourceDataset.item_count);
    } else {
      const { data, error } = await target
        .from("wiki_collection_datasets")
        .insert(datasetCopy(sourceDataset as Row, targetPageId))
        .select("id")
        .single();
      if (error || !data) throw new Error(`${code}: target dataset insert failed: ${error?.message ?? "missing"}`);
      targetDatasetId = String(data.id);

      const sourceItems = await fetchAll(
        source,
        "wiki_collection_items",
        "item_slug, item_name, section, sort_order, image_key, image_mime, image_width, image_height, image_bytes, image_sha256, fields_json",
        (query) => query.eq("dataset_id", sourceDatasetId).order("sort_order").order("item_slug")
      );
      if (sourceItems.length !== Number(sourceDataset.item_count)) {
        throw new Error(`${code}: production item read returned ${sourceItems.length}, expected ${sourceDataset.item_count}.`);
      }
      for (const part of chunk(sourceItems.map((row) => itemCopy(row, targetDatasetId)), INSERT_BATCH_SIZE)) {
        const { error: itemError } = await target.from("wiki_collection_items").insert(part);
        if (itemError) throw new Error(`${code}: target item insert failed: ${itemError.message}`);
      }
      const actualCount = await countItems(target, targetDatasetId);
      if (actualCount !== sourceItems.length) {
        throw new Error(`${code}: target verification found ${actualCount} rows, expected ${sourceItems.length}.`);
      }
      inserted += 1;
      copiedItems += sourceItems.length;
    }

    if (apply) {
      const targetWikiPage = targetWikiBySlug.get(String(sourcePage.wiki_slug));
      const wikiPageId = targetWikiPage ? String(targetWikiPage.id) : null;
      const { error } = await target
        .from("wiki_collection_pages")
        .update({
          ...pageCopy(
            sourcePage,
            wikiPageId,
            targetPage.universe_id == null
              ? (targetWikiPage?.universe_id == null ? null : String(targetWikiPage.universe_id))
              : String(targetPage.universe_id)
          ),
          published_dataset_id: targetDatasetId,
          item_count: Number(sourceDataset.item_count)
        })
        .eq("id", targetPageId);
      if (error) throw new Error(`${code}: target pointer update failed: ${error.message}`);
    }

    if ((index + 1) % 25 === 0 || index + 1 === filteredPages.length) {
      console.log(`[${index + 1}/${filteredPages.length}] ${code}`);
    }
  }

  console.log(JSON.stringify({
    selected: filteredPages.length,
    reused,
    inserted,
    createdPages,
    copiedItems
  }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
