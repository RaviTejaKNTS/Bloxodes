import "server-only";

import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import { publicContentCache } from "@/lib/public-content-cache";
import { getGameCollectionConfigByCode } from "@/lib/game-collections";
import { unwrapDatasetItems } from "@/lib/local-datasets";
import { repoPath } from "@/lib/paths";

type DatasetRow = Record<string, unknown>;

type DatasetFile = {
  meta?: { schemaVersion?: number | null } | null;
  items?: DatasetRow[] | null;
  data?: DatasetRow[] | null;
};

type DatasetLocation = {
  dataDir: string;
  file: string;
};

const IMAGE_FIELD_KEYS = ["image", "wikiImageUrl", "imageCandidate", "sourceImageUrl"];
const COLLECTION_IMAGES_REVALIDATE_SECONDS = 86400;

function normalizeCollectionCode(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\/+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function slugifyDataDir(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeCollectionImage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("data:image")) return null;
  return trimmed;
}

function getRecord(value: unknown): DatasetRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as DatasetRow;
}

function imageFromRow(row: DatasetRow): string | null {
  const records = [row, getRecord(row.fields)].filter((record): record is DatasetRow => Boolean(record));

  for (const record of records) {
    for (const key of IMAGE_FIELD_KEYS) {
      const image = normalizeCollectionImage(record[key]);
      if (image) return image;
    }
  }

  return null;
}

async function resolveLocalDatasetLocation(code: string): Promise<DatasetLocation | null> {
  const dataRoot = repoPath("data");
  let entries: Dirent[];

  try {
    entries = await fs.readdir(dataRoot, { withFileTypes: true });
  } catch {
    return null;
  }

  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ dataDir: entry.name, slug: slugifyDataDir(entry.name) }))
    .filter((entry) => Boolean(entry.slug))
    .sort((a, b) => b.slug.length - a.slug.length);

  for (const directory of directories) {
    const prefix = `${directory.slug}-`;
    if (!code.startsWith(prefix)) continue;

    const collectionSlug = code.slice(prefix.length);
    if (!collectionSlug) continue;

    const file = `${collectionSlug}.json`;
    try {
      await fs.access(repoPath("data", directory.dataDir, file));
      return { dataDir: directory.dataDir, file };
    } catch {
      continue;
    }
  }

  return null;
}

async function resolveDatasetLocation(code: string): Promise<DatasetLocation | null> {
  const config = getGameCollectionConfigByCode(code);
  if (config) {
    return { dataDir: config.dataDir, file: config.file };
  }

  return resolveLocalDatasetLocation(code);
}

async function readCollectionImageUrls(code: string, limit: number): Promise<string[]> {
  const location = await resolveDatasetLocation(code);
  if (!location) return [];

  try {
    const datasetPath = repoPath("data", location.dataDir, location.file);
    const raw = await fs.readFile(datasetPath, "utf8");
    const parsed = JSON.parse(raw) as DatasetFile | DatasetRow[];
    const rows = unwrapDatasetItems<DatasetRow>(parsed);
    const images = new Set<string>();

    for (const row of rows) {
      const image = imageFromRow(row);
      if (!image) continue;
      images.add(image);
      if (images.size >= limit) break;
    }

    return Array.from(images);
  } catch (error) {
    console.error(`Error reading dataset collection images for ${code}`, error);
    return [];
  }
}

export async function listGameCollectionImageUrls(code: string, limit = 6): Promise<string[]> {
  const normalizedCode = normalizeCollectionCode(code);
  if (!normalizedCode) return [];

  const requestedLimit = Number.isFinite(limit) ? Math.floor(limit) : 6;
  const safeLimit = Math.max(1, Math.min(12, requestedLimit));
  const cached = publicContentCache(
    () => readCollectionImageUrls(normalizedCode, safeLimit),
    ["game-collection-images-v2", normalizedCode, String(safeLimit)],
    {
      revalidate: COLLECTION_IMAGES_REVALIDATE_SECONDS,
      tags: ["collection-index", `collection:${normalizedCode}`]
    }
  );

  return cached();
}
