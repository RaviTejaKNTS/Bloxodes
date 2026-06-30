import "../shared/load-env";

import fs from "node:fs/promises";
import path from "node:path";

import {
  getGameCollectionConfigByWikiPath,
  type GameCollectionConfig
} from "@/lib/game-collections";
import { repoPath } from "@/lib/paths";

type DatasetDocument = {
  meta?: Record<string, unknown> | null;
  items?: Record<string, unknown>[] | null;
  data?: Record<string, unknown>[] | null;
};

type CliOptions = {
  game: string | null;
  collection: string | null;
  file: string | null;
  finalJson: string | null;
  sectionField: string | null;
  requireImages: boolean;
  requireCardSummary: boolean;
  json: boolean;
};

type CheckIssue = {
  level: "error" | "warning";
  message: string;
};

const HIDDEN_FIELD_KEYS = new Set([
  "id",
  "slug",
  "name",
  "image",
  "imageStatus",
  "imageMissingReason",
  "imageSource",
  "sourceImageUrl",
  "sourceImage",
  "sourcePage",
  "secondarySourcePage",
  "sourceUrl",
  "sourceUrls",
  "sourceFile",
  "sourceTables",
  "sourceStatus",
  "sourceConfidence",
  "sourceCheckedAt",
  "sourceGeneratedAt",
  "sourceNote",
  "sourceNotes",
  "sourceEvidence",
  "wikiSourceStatus",
  "verification",
  "verificationNote",
  "confidence",
  "blocker",
  "wikiUrl",
  "imageCandidate",
  "fields",
  "raw",
  "rawText",
  "sections",
  "updatedAt"
]);

const SECTION_FIELD_PRIORITY = [
  "collectionSection",
  "category",
  "type",
  "rarity",
  "tier",
  "status",
  "sea",
  "location",
  "biome",
  "stage",
  "slot"
];

function printUsage() {
  console.log(`Usage:
  npm run check:game-collection-data -- --game <game-slug> --collection <collection-slug> [options]

Options:
  --file <dataset.json>       Check a dataset file that is not registered yet.
  --final-json <final.json>   Also check description_json keys against dataset sections.
  --section-field <field>     Force the field used for rendered sections.
  --require-images            Fail when items are missing images.
  --require-card-summary      Fail when items are missing cardSummary.
  --json                      Print machine-readable summary.
  -h, --help                  Show this help.
`);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    game: null,
    collection: null,
    file: null,
    finalJson: null,
    sectionField: null,
    requireImages: false,
    requireCardSummary: false,
    json: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "-h":
      case "--help":
        printUsage();
        process.exit(0);
      case "--game":
      case "--game-slug":
      case "--wiki-slug":
        options.game = requireValue(argv, ++i, arg).toLowerCase();
        break;
      case "--collection":
      case "--collection-slug":
        options.collection = requireValue(argv, ++i, arg).toLowerCase();
        break;
      case "--file":
      case "--dataset":
        options.file = requireValue(argv, ++i, arg);
        break;
      case "--final-json":
      case "--final":
        options.finalJson = requireValue(argv, ++i, arg);
        break;
      case "--section-field":
      case "--group-by":
        options.sectionField = requireValue(argv, ++i, arg);
        break;
      case "--require-images":
        options.requireImages = true;
        break;
      case "--require-card-summary":
        options.requireCardSummary = true;
        break;
      case "--json":
        options.json = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!options.game) throw new Error("--game is required");
  if (!options.collection) throw new Error("--collection is required");
  return options;
}

function requireValue(argv: string[], index: number, option: string): string {
  const value = argv[index];
  if (!value) throw new Error(`Missing value for ${option}`);
  return value;
}

function resolvePath(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

async function pathExists(file: string): Promise<boolean> {
  try {
    return (await fs.stat(file)).isFile();
  } catch {
    return false;
  }
}

async function readJsonFile<T>(file: string): Promise<T> {
  return JSON.parse(await fs.readFile(file, "utf8")) as T;
}

function getRows(document: DatasetDocument | Record<string, unknown>[]): {
  meta: Record<string, unknown> | null;
  rows: Record<string, unknown>[];
} {
  if (Array.isArray(document)) {
    return { meta: null, rows: document };
  }
  const meta = document.meta ?? null;
  if (meta?.schemaVersion === 2) {
    return {
      meta,
      rows: (document.items ?? []).map((row) => {
        const item = row.item && typeof row.item === "object" && !Array.isArray(row.item)
          ? (row.item as Record<string, unknown>)
          : {};
        const system = row.system && typeof row.system === "object" && !Array.isArray(row.system)
          ? (row.system as Record<string, unknown>)
          : {};
        return {
          ...item,
          slug: system.slug,
          collectionSection: system.section,
          sortOrder: system.sortOrder,
          image: system.image
        };
      })
    };
  }
  return {
    meta,
    rows: document.items ?? document.data ?? []
  };
}

function inferColumns(meta: Record<string, unknown> | null, rows: Record<string, unknown>[]): string[] {
  const columns = Array.isArray(meta?.columns) ? meta.columns.filter((value): value is string => typeof value === "string") : [];
  const seen = new Set(columns);
  for (const row of rows.slice(0, 30)) {
    Object.keys(row).forEach((key) => seen.add(key));
    const fields = row.fields;
    if (fields && typeof fields === "object" && !Array.isArray(fields)) {
      Object.keys(fields as Record<string, unknown>).forEach((key) => seen.add(key));
    }
  }
  return Array.from(seen);
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function itemSlug(row: Record<string, unknown>): string {
  return stringValue(row.slug) ?? normalizeSlug(stringValue(row.name) ?? stringValue(row.title) ?? "item");
}

function pickSectionField(
  options: CliOptions,
  meta: Record<string, unknown> | null,
  columns: string[],
  rows: Record<string, unknown>[]
): string | null {
  if (meta?.schemaVersion === 2) return "collectionSection";
  if (options.sectionField) return options.sectionField;
  return SECTION_FIELD_PRIORITY.find((key) => columns.includes(key) && usefulValues(rows, key).size > 1) ?? null;
}

function usefulValues(rows: Record<string, unknown>[], key: string): Set<string> {
  const values = new Set<string>();
  for (const row of rows) {
    const value = stringValue(row[key]);
    if (value) values.add(value);
  }
  return values;
}

function getCardFields(meta: Record<string, unknown> | null, columns: string[], sectionField: string | null): string[] {
  if (meta?.schemaVersion === 2 && meta.display && typeof meta.display === "object" && !Array.isArray(meta.display)) {
    const display = meta.display as Record<string, unknown>;
    const tableFields = Array.isArray(display.tableFields)
      ? display.tableFields.filter((value): value is string => typeof value === "string")
      : [];
    if (tableFields.length) return tableFields;
  }

  const defaultCardFields = Array.isArray(meta?.defaultCardFields)
    ? meta.defaultCardFields.filter((value): value is string => typeof value === "string")
    : [];
  if (defaultCardFields.length) return defaultCardFields;

  return columns.filter((key) => {
    if (HIDDEN_FIELD_KEYS.has(key)) return false;
    if (key === sectionField) return false;
    if (key === "cardSummary") return false;
    return true;
  });
}

function imageLocalPath(value: string): string | null {
  if (/^https?:\/\//i.test(value)) return null;
  const withoutQuery = value.split("?")[0] ?? value;
  const decoded = decodeURIComponent(withoutQuery.replace(/^\/+/, ""));
  return repoPath("apps", "web", "public", decoded);
}

async function checkImages(rows: Record<string, unknown>[]) {
  let present = 0;
  let missingLocal = 0;
  let remote = 0;

  for (const row of rows) {
    const image = stringValue(row.image);
    if (!image) continue;
    present += 1;
    const localPath = imageLocalPath(image);
    if (!localPath) {
      remote += 1;
      continue;
    }
    if (!(await pathExists(localPath))) missingLocal += 1;
  }

  return {
    present,
    missing: rows.length - present,
    missingLocal,
    remote
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const issues: CheckIssue[] = [];
  const config = getGameCollectionConfigByWikiPath(options.game!, options.collection!);
  if (!config && !options.file) {
    throw new Error(
      `No registered collection config for ${options.game}/${options.collection}. Run register:game-collection or pass --file.`
    );
  }

  const datasetPath = options.file
    ? resolvePath(options.file)
    : repoPath("data", (config as GameCollectionConfig).dataDir, (config as GameCollectionConfig).file);

  if (!(await pathExists(datasetPath))) {
    throw new Error(`Dataset file not found: ${datasetPath}`);
  }

  const document = await readJsonFile<DatasetDocument | Record<string, unknown>[]>(datasetPath);
  const { meta, rows } = getRows(document);
  const columns = inferColumns(meta, rows);
  const sectionField = pickSectionField(options, meta, columns, rows);
  const cardFields = getCardFields(meta, columns, sectionField);

  if (!rows.length) issues.push({ level: "error", message: "Dataset has no items." });
  if (!columns.length) issues.push({ level: "error", message: "Dataset has no usable columns." });

  const missingNames = rows.filter((row) => !stringValue(row.name) && !stringValue(row.title) && !stringValue(row.item));
  if (missingNames.length) issues.push({ level: "error", message: `${missingNames.length} item(s) are missing a name/title.` });

  const slugs = new Map<string, number>();
  for (const row of rows) {
    const slug = itemSlug(row);
    slugs.set(slug, (slugs.get(slug) ?? 0) + 1);
  }
  const duplicateSlugs = Array.from(slugs.entries()).filter(([, count]) => count > 1);
  if (duplicateSlugs.length) {
    issues.push({ level: "warning", message: `Duplicate item slugs: ${duplicateSlugs.map(([slug]) => slug).join(", ")}` });
  }

  if (!sectionField) {
    issues.push({ level: "warning", message: "No useful section field found. The renderer will use a single Items group." });
  } else if (!columns.includes(sectionField)) {
    issues.push({ level: "error", message: `Section field "${sectionField}" is not listed in dataset columns.` });
  }

  const sectionValues = sectionField ? usefulValues(rows, sectionField) : new Set<string>();
  const missingSectionRows = sectionField ? rows.filter((row) => !stringValue(row[sectionField])) : [];
  const sectionOrder = Array.isArray(meta?.sectionOrder)
    ? meta.sectionOrder.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  if (missingSectionRows.length) {
    issues.push({ level: "error", message: `${missingSectionRows.length} item(s) are missing section field "${sectionField}".` });
  }
  if (sectionField && sectionValues.size <= 1) {
    issues.push({ level: "warning", message: `Section field "${sectionField}" has only ${sectionValues.size} section value(s).` });
  }
  if (!meta || typeof meta !== "object") {
    issues.push({ level: "error", message: "Dataset must use the wrapped shape: { meta: {...}, items: [...] }." });
  }
  if (meta?.schemaVersion !== 2) {
    issues.push({ level: "error", message: "Dataset must use schemaVersion 2 with item/system rows and meta.display." });
  }
  const v2SectionOrder = meta?.schemaVersion === 2 && meta.display && typeof meta.display === "object" && !Array.isArray(meta.display)
    ? (meta.display as Record<string, unknown>).sectionOrder
    : null;
  const effectiveSectionOrder = Array.isArray(v2SectionOrder)
    ? v2SectionOrder.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : sectionOrder;
  if (sectionField && !effectiveSectionOrder.length) {
    issues.push({ level: "error", message: "meta.display.sectionOrder is required so section ordering is stable." });
  } else if (sectionField) {
    const missingOrderLabels = Array.from(sectionValues).filter((section) => !effectiveSectionOrder.includes(section));
    if (missingOrderLabels.length) {
      issues.push({
        level: "error",
        message: `meta.sectionOrder is missing rendered section label(s): ${missingOrderLabels.join(", ")}`
      });
    }
  }

  if (!cardFields.length) {
    issues.push({ level: "error", message: "No useful card fields found. Add meta.defaultCardFields or useful item fields." });
  }
  for (const field of cardFields) {
    const populated = rows.filter((row) => stringValue(row[field])).length;
    if (populated === 0) issues.push({ level: "error", message: `Card field "${field}" has no values.` });
  }

  const cardSummaryMissing = rows.filter((row) => !stringValue(row.cardSummary)).length;
  if (options.requireCardSummary && cardSummaryMissing) {
    issues.push({ level: "error", message: `${cardSummaryMissing} item(s) are missing cardSummary.` });
  } else if (cardSummaryMissing && cardSummaryMissing < rows.length) {
    issues.push({ level: "warning", message: `${cardSummaryMissing} item(s) are missing cardSummary.` });
  }

  const imageStats = await checkImages(rows);
  if (options.requireImages && imageStats.missing) {
    issues.push({ level: "error", message: `${imageStats.missing} item(s) are missing images.` });
  } else if (imageStats.missing === rows.length) {
    issues.push({ level: "warning", message: "No item images are present." });
  }
  if (imageStats.missingLocal) {
    issues.push({ level: "error", message: `${imageStats.missingLocal} local image path(s) do not exist under apps/web/public.` });
  }

  let descriptionJsonKeys: string[] = [];
  if (options.finalJson) {
    const finalJson = await readJsonFile<Record<string, unknown>>(resolvePath(options.finalJson));
    const descriptionJson = finalJson.description_json;
    if (descriptionJson && typeof descriptionJson === "object" && !Array.isArray(descriptionJson)) {
      descriptionJsonKeys = Object.keys(descriptionJson);
      const sectionKeySet = new Set(sectionValues);
      const missing = descriptionJsonKeys.filter((key) => !sectionKeySet.has(key));
      if (missing.length) {
        issues.push({
          level: "error",
          message: `description_json key(s) do not match rendered sections: ${missing.join(", ")}`
        });
      }
    }
  }

  const sectionCounts = sectionField
    ? Array.from(sectionValues)
        .sort((a, b) => a.localeCompare(b))
        .map((section) => ({
          section,
          count: rows.filter((row) => stringValue(row[sectionField]) === section).length
        }))
    : [];

  const summary = {
    game: options.game,
    collection: options.collection,
    registered: Boolean(config),
    datasetPath,
    itemCount: rows.length,
    sectionField,
    sectionCounts,
    cardFields,
    cardSummaryCoverage: `${rows.length - cardSummaryMissing}/${rows.length}`,
    imageCoverage: `${imageStats.present}/${rows.length}`,
    missingLocalImages: imageStats.missingLocal,
    descriptionJsonKeys,
    issues
  };

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`Game collection data check: ${options.game}/${options.collection}`);
    console.log(`- Dataset: ${datasetPath}`);
    console.log(`- Registered: ${config ? "yes" : "no"}`);
    console.log(`- Items: ${rows.length}`);
    console.log(`- Section field: ${sectionField ?? "(missing)"}`);
    sectionCounts.forEach((entry) => console.log(`  - ${entry.section}: ${entry.count}`));
    console.log(`- Card fields: ${cardFields.join(", ") || "(missing)"}`);
    console.log(`- Card summaries: ${rows.length - cardSummaryMissing}/${rows.length}`);
    console.log(`- Images: ${imageStats.present}/${rows.length}${imageStats.missingLocal ? ` (${imageStats.missingLocal} missing local files)` : ""}`);
    if (descriptionJsonKeys.length) console.log(`- description_json keys: ${descriptionJsonKeys.join(", ")}`);
    for (const issue of issues) {
      console.log(`${issue.level === "error" ? "ERROR" : "WARN"}: ${issue.message}`);
    }
  }

  if (issues.some((issue) => issue.level === "error")) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
