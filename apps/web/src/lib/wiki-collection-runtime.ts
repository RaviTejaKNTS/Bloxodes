import "server-only";

import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase";
import { getWikiCollectionPageByCode, type WikiCollectionPageContent } from "@/lib/wiki-collections";
import { resolveWikiMediaUrl } from "@/lib/wiki-media";
import type { GameCollectionRenderConfig } from "@/lib/game-collections/types";

const ITEM_PAGE_SIZE = 1000;

type RuntimeMode = "database-first" | "database-only" | "local-only";

type DatasetRow = {
  id: string;
  collection_page_id: string;
  schema_version: number;
  content_hash: string;
  item_count: number;
  meta_json: Record<string, unknown> | null;
  validation_json: Record<string, unknown> | null;
  source_manifest_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type ItemRow = {
  item_slug: string;
  item_name: string;
  section: string;
  sort_order: number;
  image_key: string | null;
  fields_json: Record<string, unknown> | null;
};

export type WikiCollectionDatasetDocument = {
  meta: Record<string, unknown>;
  items: Array<{
    item: Record<string, unknown>;
    system: {
      slug: string;
      section: string;
      sortOrder: number;
      image: string | null;
    };
  }>;
};

export type PublishedWikiCollectionRuntime = {
  datasetId: string;
  contentHash: string;
  config: GameCollectionRenderConfig;
  document: WikiCollectionDatasetDocument;
  itemCount: number;
  meta: Record<string, unknown>;
  validation: Record<string, unknown>;
  sourceManifest: Record<string, unknown>;
};

export type PublishedWikiCollectionRuntimeHeader = Omit<PublishedWikiCollectionRuntime, "document">;

type SupabaseErrorLike = { code?: string; message?: string };

function isMissingRuntimeRelation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as SupabaseErrorLike;
  return value.code === "42P01" || value.code === "42703" || value.code === "PGRST204" || value.code === "PGRST205";
}

export function wikiCollectionRuntimeMode(): RuntimeMode {
  const value = process.env.WIKI_COLLECTION_DATA_SOURCE?.trim().toLowerCase();
  if (value === "database-only" || value === "local-only") return value;
  return "database-first";
}

export function shouldReadWikiCollectionDatabase(): boolean {
  return wikiCollectionRuntimeMode() !== "local-only";
}

export function wikiCollectionDatabaseRequiredCodes(): Set<string> {
  return new Set(
    (process.env.WIKI_COLLECTION_DATABASE_REQUIRED_CODES ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function requiresWikiCollectionDatabase(code: string): boolean {
  return wikiCollectionRuntimeMode() === "database-only" ||
    wikiCollectionDatabaseRequiredCodes().has(code.trim().toLowerCase());
}

export function shouldFallbackToLocalWikiCollectionData(code?: string): boolean {
  return wikiCollectionRuntimeMode() !== "database-only" &&
    (!code || !requiresWikiCollectionDatabase(code));
}

function requiredRuntimeError(code: string, reason: string): Error {
  return new Error(`Required database runtime for ${code} is unavailable: ${reason}. Local fallback is disabled.`);
}

function normalizeRuntimeMeta(value: Record<string, unknown> | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function humanizeSlug(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function runtimeConfig(page: WikiCollectionPageContent, meta: Record<string, unknown>): GameCollectionRenderConfig {
  const runtime = meta.runtime;
  const runtimeObject = runtime && typeof runtime === "object" && !Array.isArray(runtime)
    ? runtime as Record<string, unknown>
    : {};
  const gameName = typeof runtimeObject.gameName === "string" && runtimeObject.gameName.trim()
    ? runtimeObject.gameName.trim()
    : humanizeSlug(page.wiki_slug);
  const label = page.display_name?.trim() ||
    (typeof runtimeObject.label === "string" && runtimeObject.label.trim()
      ? runtimeObject.label.trim()
      : humanizeSlug(page.collection_slug));

  return {
    code: page.code,
    gameSlug: page.wiki_slug,
    gameName,
    slug: page.collection_slug,
    label,
    sortOrder: page.wiki_sort_order ?? 0
  };
}

async function loadItemRows(datasetId: string): Promise<ItemRow[]> {
  const rows: ItemRow[] = [];
  const supabase = supabaseAdmin();

  for (let from = 0; ; from += ITEM_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("wiki_collection_items")
      .select("item_slug, item_name, section, sort_order, image_key, fields_json")
      .eq("dataset_id", datasetId)
      .order("sort_order", { ascending: true })
      .order("item_slug", { ascending: true })
      .range(from, from + ITEM_PAGE_SIZE - 1);

    if (error) throw error;
    const chunk = (data ?? []) as ItemRow[];
    rows.push(...chunk);
    if (chunk.length < ITEM_PAGE_SIZE) break;
  }

  return rows;
}

async function loadPublishedRuntimeHeader(
  page: WikiCollectionPageContent
): Promise<PublishedWikiCollectionRuntimeHeader | null> {
  if (!shouldReadWikiCollectionDatabase() || !page.id || !page.published_dataset_id) return null;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("wiki_collection_datasets")
    .select(
      "id, collection_page_id, schema_version, content_hash, item_count, meta_json, validation_json, source_manifest_json, created_at, updated_at"
    )
    .eq("id", page.published_dataset_id)
    .eq("collection_page_id", page.id)
    .maybeSingle();

  if (error) {
    if (isMissingRuntimeRelation(error)) {
      if (requiresWikiCollectionDatabase(page.code)) throw requiredRuntimeError(page.code, "runtime schema is missing");
      return null;
    }
    console.error("Error fetching published wiki collection dataset", error);
    if (requiresWikiCollectionDatabase(page.code)) throw requiredRuntimeError(page.code, error.message || "dataset query failed");
    return null;
  }
  if (!data) {
    if (requiresWikiCollectionDatabase(page.code)) throw requiredRuntimeError(page.code, "published dataset pointer is invalid");
    return null;
  }

  const dataset = data as DatasetRow;
  const meta = {
    ...normalizeRuntimeMeta(dataset.meta_json),
    schemaVersion: dataset.schema_version
  };
  return {
    datasetId: dataset.id,
    contentHash: dataset.content_hash,
    config: runtimeConfig(page, meta),
    itemCount: dataset.item_count,
    meta,
    validation: normalizeRuntimeMeta(dataset.validation_json),
    sourceManifest: normalizeRuntimeMeta(dataset.source_manifest_json)
  };
}

export const getPublishedWikiCollectionRuntimeHeader = cache(loadPublishedRuntimeHeader);

async function loadPublishedRuntime(page: WikiCollectionPageContent): Promise<PublishedWikiCollectionRuntime | null> {
  const header = await getPublishedWikiCollectionRuntimeHeader(page);
  if (!header) return null;

  try {
    const itemRows = await loadItemRows(header.datasetId);
    if (itemRows.length !== header.itemCount) {
      const message = `published dataset ${header.datasetId} expected ${header.itemCount} items and loaded ${itemRows.length}`;
      console.error(message);
      if (requiresWikiCollectionDatabase(page.code)) throw requiredRuntimeError(page.code, message);
      return null;
    }

    const document: WikiCollectionDatasetDocument = {
      meta: header.meta,
      items: itemRows.map((row) => ({
        item: {
          ...(row.fields_json ?? {}),
          name: row.item_name
        },
        system: {
          slug: row.item_slug,
          section: row.section,
          sortOrder: row.sort_order,
          image: resolveWikiMediaUrl(row.image_key)
        }
      }))
    };

    return {
      ...header,
      document,
    };
  } catch (runtimeError) {
    if (requiresWikiCollectionDatabase(page.code)) throw runtimeError;
    if (!isMissingRuntimeRelation(runtimeError)) {
      console.error("Error loading published wiki collection items", runtimeError);
    }
    return null;
  }
}

export const getPublishedWikiCollectionRuntime = cache(loadPublishedRuntime);

export async function getPublishedWikiCollectionRuntimeByCode(
  code: string
): Promise<PublishedWikiCollectionRuntime | null> {
  const normalizedCode = code.trim().toLowerCase();
  const page = await getWikiCollectionPageByCode(normalizedCode);
  if (!page) {
    if (requiresWikiCollectionDatabase(normalizedCode)) {
      throw requiredRuntimeError(normalizedCode, "published collection page is missing");
    }
    return null;
  }
  const runtime = await getPublishedWikiCollectionRuntime(page);
  if (!runtime && requiresWikiCollectionDatabase(normalizedCode)) {
    throw requiredRuntimeError(normalizedCode, "published dataset is missing");
  }
  return runtime;
}

export async function listPublishedWikiCollectionRuntimeImages(
  page: WikiCollectionPageContent,
  limit = 6
): Promise<string[] | null> {
  if (!shouldReadWikiCollectionDatabase() || !page.published_dataset_id) return null;

  const safeLimit = Math.max(1, Math.min(12, Number.isFinite(limit) ? Math.floor(limit) : 6));
  const { data, error } = await supabaseAdmin()
    .from("wiki_collection_items")
    .select("image_key")
    .eq("dataset_id", page.published_dataset_id)
    .not("image_key", "is", null)
    .order("sort_order", { ascending: true })
    .order("item_slug", { ascending: true })
    .limit(safeLimit);

  if (error) {
    if (requiresWikiCollectionDatabase(page.code)) {
      throw requiredRuntimeError(page.code, error.message || "preview image query failed");
    }
    if (!isMissingRuntimeRelation(error)) {
      console.error("Error loading published wiki collection preview images", error);
    }
    return null;
  }

  return Array.from(
    new Set(
      (data ?? [])
        .map((row) => resolveWikiMediaUrl((row as { image_key?: string | null }).image_key))
        .filter((value): value is string => Boolean(value))
    )
  ).slice(0, safeLimit);
}
