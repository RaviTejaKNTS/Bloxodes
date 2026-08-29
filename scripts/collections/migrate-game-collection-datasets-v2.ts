import fs from "node:fs/promises";
import path from "node:path";

import {
  GAME_COLLECTIONS,
  getFieldLabel,
  type GameCollectionConfig
} from "@/lib/game-collections";
import { repoPath } from "@/lib/paths";
import { isDatabaseOnlyGameCollectionGame } from "@/lib/game-collections/database-only";

type Options = {
  apply: boolean;
  game: string | null;
  collection: string | null;
  json: boolean;
};

type DatasetDocument = {
  meta?: Record<string, unknown> | null;
  items?: Record<string, unknown>[] | null;
  data?: Record<string, unknown>[] | null;
};

type MigratedItem = {
  item: Record<string, unknown>;
  system: {
    slug: string;
    section: string | null;
    sortOrder: number;
    image: string | null;
  };
};

type Result = {
  code: string;
  datasetPath: string;
  itemCount: number;
  changed: boolean;
  publicFields: string[];
  tableFields: string[];
  cardFields: string[];
  issues: string[];
};

type DatasetIssue = {
  message: string;
  blocking: boolean;
};

const SYSTEM_SORT_KEYS = new Set(["sortOrder", "sort_order", "_sortOrder"]);
const SYSTEM_FIELD_KEYS = new Set([
  "id",
  "slug",
  "image",
  "imageCandidate",
  "collectionGroup",
  "collectionSection",
  "fields",
  "sections",
  "updatedAt"
]);

const DEV_FIELD_KEYS = new Set([
  "imageStatus",
  "imageMissingReason",
  "imageSource",
  "wikiImageUrl",
  "imageFile",
  "sourceImageUrl",
  "sourceImage",
  "sourceImageFile",
  "sourceImageAlt",
  "sourceImageMime",
  "sourceImagePage",
  "sourcePage",
  "secondarySourcePage",
  "sourceUrl",
  "sourceUrls",
  "sourceFile",
  "sourceStatus",
  "sourceConfidence",
  "sourceCheckedAt",
  "sourceGeneratedAt",
  "sourceNote",
  "sourceNotes",
  "sourceEvidence",
  "sourceGroup",
  "sourceGroups",
  "sourceTable",
  "sourceTables",
  "wikiSourceStatus",
  "verification",
  "verificationNote",
  "confidence",
  "blocker",
  "wikiUrl",
  "raw",
  "rawText",
  "rawHtml",
  "rawWikitext",
  "rawWikiText",
  "rawInfobox"
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

const BADGE_FIELD_PRIORITY = [
  "rarity",
  "tier",
  "type",
  "category",
  "status",
  "availability",
  "available",
  "cost",
  "price",
  "role",
  "source"
];

const DESCRIPTION_FIELD_PRIORITY = [
  "cardSummary",
  "summary",
  "description",
  "overview",
  "effect",
  "purpose",
  "bestFor",
  "notes"
];

const SUBTITLE_FIELD_PRIORITY = [
  "role",
  "type",
  "category",
  "rarity",
  "tier",
  "source",
  "location",
  "availability",
  "status"
];

function usage() {
  console.log(`Usage:
  npm run migrate:game-collection-datasets:v2
  npm run migrate:game-collection-datasets:v2 -- --apply

Options:
  --apply                  Write migrated dataset JSON. Without this, dry-run only.
  --game <game-slug>       Limit to one registered game.
  --collection <slug>      Limit to one collection slug. Requires --game.
  --json                   Print machine-readable results.
  -h, --help               Show this help.
`);
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    apply: false,
    game: null,
    collection: null,
    json: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "-h":
      case "--help":
        usage();
        process.exit(0);
      case "--apply":
        options.apply = true;
        break;
      case "--game":
      case "--game-slug":
        options.game = requireValue(argv, ++i, arg).toLowerCase();
        break;
      case "--collection":
      case "--collection-slug":
        options.collection = requireValue(argv, ++i, arg).toLowerCase();
        break;
      case "--json":
        options.json = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (options.collection && !options.game) {
    throw new Error("--collection requires --game.");
  }

  return options;
}

function requireValue(argv: string[], index: number, option: string): string {
  const value = argv[index];
  if (!value) throw new Error(`Missing value for ${option}`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return !value.trim();
  if (Array.isArray(value)) return value.length === 0;
  if (isRecord(value)) return Object.keys(value).length === 0;
  return false;
}

function isUsefulValue(value: unknown): boolean {
  if (isEmptyValue(value)) return false;
  if (typeof value === "string" && ["none", "n/a", "na", "null"].includes(value.trim().toLowerCase())) return false;
  return true;
}

function isDevFieldKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (DEV_FIELD_KEYS.has(key)) return true;
  if (!/^[a-z][A-Za-z0-9_]*$/.test(key)) return true;
  if (/\s/.test(key)) return true;
  if (/^raw[A-Z_ -]/.test(key)) return true;
  if (/^verification[A-Z_ -]?/.test(key)) return true;
  if (/^source(Image|Page|Url|Urls|File|Tables|Status|Confidence|Checked|Generated|Note|Notes|Evidence)/.test(key)) return true;
  if (
    lower.includes("source") &&
    (lower.includes("image") ||
      lower.includes("url") ||
      lower.includes("page") ||
      lower.includes("table") ||
      lower.includes("confidence") ||
      lower.includes("checked") ||
      lower.includes("generated") ||
      lower.includes("note") ||
      lower.includes("evidence") ||
      lower.includes("status") ||
      lower.includes("revision") ||
      lower.includes("order") ||
      lower.includes("timestamp") ||
      lower.includes("modified") ||
      lower.includes("template") ||
      lower.includes("section") ||
      lower.includes("unitkey"))
  ) {
    return true;
  }
  if (lower.endsWith("source") && lower !== "source") return true;
  if (lower.includes("imageurl") || lower.includes("imagefile") || lower.includes("imagepath")) return true;
  if (lower.includes("imagecandidate")) return true;
  if (["wikilink", "wikipage", "article", "datastatus", "normalizationnotes"].includes(lower)) return true;
  if (["gamepassid", "productid", "iconassetid", "robloxgamepassid", "robloxproductid", "robloxiconassetid"].includes(lower)) {
    return true;
  }
  return false;
}

function sortByConfiguredOrder(keys: string[], order: string[]) {
  const index = new Map(order.map((key, position) => [key, position]));
  return [...keys].sort((left, right) => {
    const leftIndex = index.get(left);
    const rightIndex = index.get(right);
    if (leftIndex !== undefined && rightIndex !== undefined) return leftIndex - rightIndex;
    if (leftIndex !== undefined) return -1;
    if (rightIndex !== undefined) return 1;
    return left.localeCompare(right);
  });
}

function getRows(document: DatasetDocument | Record<string, unknown>[]) {
  if (Array.isArray(document)) return document;
  return document.items ?? document.data ?? [];
}

function inferColumns(meta: Record<string, unknown> | null, rows: Record<string, unknown>[]) {
  const columns = Array.isArray(meta?.columns)
    ? meta.columns.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  const seen = new Set(columns);
  for (const row of rows) {
    if (isRecord(row.item)) {
      Object.keys(row.item).forEach((key) => seen.add(key));
    } else {
      Object.keys(row).forEach((key) => seen.add(key));
      if (isRecord(row.fields)) Object.keys(row.fields).forEach((key) => seen.add(key));
    }
  }
  return Array.from(seen);
}

function usefulValues(rows: Record<string, unknown>[], key: string) {
  const values = new Set<string>();
  for (const row of rows) {
    const source = isRecord(row.item) ? row.item : row;
    const value = stringValue(source[key] ?? row[key]);
    if (value) values.add(value);
  }
  return Array.from(values);
}

function pickGroupKey(meta: Record<string, unknown> | null, rows: Record<string, unknown>[], columns: string[]) {
  const existing = stringValue(meta?.groupBy);
  if (existing && columns.includes(existing) && usefulValues(rows, existing).length > 1) return existing;
  return SECTION_FIELD_PRIORITY.find((key) => columns.includes(key) && usefulValues(rows, key).length > 1) ?? null;
}

function getRowValue(row: Record<string, unknown>, key: string) {
  if (isRecord(row.item) && key in row.item) return row.item[key];
  if (isRecord(row.fields) && key in row.fields) return row.fields[key];
  return row[key];
}

function filterPublicFieldKeys(keys: string[], groupKey: string) {
  return keys.filter((key) => {
    if (key === "name") return false;
    if (SYSTEM_FIELD_KEYS.has(key)) return false;
    if (SYSTEM_SORT_KEYS.has(key)) return false;
    if (key === groupKey && (groupKey === "collectionGroup" || groupKey === "collectionSection")) return false;
    if (isDevFieldKey(key)) return false;
    return true;
  });
}

function usefulPublicKeys(rows: Record<string, unknown>[], keys: string[]) {
  return keys.filter((key) => rows.some((row) => isUsefulValue(getRowValue(row, key))));
}

function getSectionOrder(items: Array<Record<string, unknown>>, groupKey: string) {
  const labels = new Set<string>();
  for (const item of items) {
    const label = stringValue(getRowValue(item, groupKey));
    if (label) labels.add(label);
  }
  return Array.from(labels);
}

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanPublicItem(item: Record<string, unknown>, publicKeys: string[], fallbackName: string) {
  const next: Record<string, unknown> = {};
  const source = isRecord(item.item) ? item.item : item;
  const name = stringValue(source.name) ?? stringValue(source.title) ?? stringValue(source.item) ?? fallbackName;
  if (name) next.name = name;
  for (const key of publicKeys) {
    const value = getRowValue(item, key);
    if (!isEmptyValue(value)) next[key] = value;
  }
  return next;
}

function fallbackSlug(name: string, index: number) {
  return toSlug(name) || `item-${index + 1}`;
}

function filterPresentation(
  presentation: unknown,
  publicFields: Set<string>
): Record<string, unknown> | null {
  if (!isRecord(presentation)) return null;
  const entries = Object.entries(presentation).filter(([key]) => publicFields.has(key));
  return entries.length ? Object.fromEntries(entries) : null;
}

function preferredCardFields(
  previousMeta: Record<string, unknown> | null,
  previousDisplay: Record<string, unknown> | null,
  tableFields: string[],
  displayFields: Set<string>
) {
  const fromDisplay = Array.isArray(previousDisplay?.cardFields)
    ? previousDisplay.cardFields.filter((value): value is string => typeof value === "string" && displayFields.has(value))
    : [];
  if (fromDisplay.length) return fromDisplay;
  const fromMeta = Array.isArray(previousMeta?.defaultCardFields)
    ? previousMeta.defaultCardFields.filter((value): value is string => typeof value === "string" && displayFields.has(value))
    : [];
  if (fromMeta.length) return fromMeta;
  return tableFields.slice(0, 6);
}

function firstUsefulField(rows: Record<string, unknown>[], fields: string[], exclude = new Set<string>()) {
  return fields.find((key) => !exclude.has(key) && rows.some((row) => isUsefulValue(getRowValue(row, key)))) ?? null;
}

function usefulFieldList(rows: Record<string, unknown>[], fields: string[], exclude = new Set<string>(), limit?: number) {
  const result = fields.filter((key) => !exclude.has(key) && rows.some((row) => isUsefulValue(getRowValue(row, key))));
  return typeof limit === "number" ? result.slice(0, limit) : result;
}

function countPublicValues(rows: Record<string, unknown>[], keys: string[]) {
  let count = 0;
  for (const row of rows) {
    for (const key of keys) {
      if (isUsefulValue(getRowValue(row, key))) count += 1;
    }
  }
  return count;
}

function countMigratedPublicValues(items: MigratedItem[], keys: string[]) {
  let count = 0;
  for (const row of items) {
    for (const key of keys) {
      if (isUsefulValue(row.item[key])) count += 1;
    }
  }
  return count;
}

async function migrateConfig(config: GameCollectionConfig, options: Options): Promise<Result> {
  const datasetPath = repoPath("data", config.dataDir, config.file);
  const raw = await fs.readFile(datasetPath, "utf8");
  const previousDocument = JSON.parse(raw) as DatasetDocument | Record<string, unknown>[];
  const rows = getRows(previousDocument);
  const previousMeta = Array.isArray(previousDocument) ? null : previousDocument.meta ?? null;
  const columns = inferColumns(previousMeta, rows);
  const groupKey = pickGroupKey(previousMeta, rows, columns) ?? "collectionGroup";
  const existingColumnOrder = [
    ...(Array.isArray(previousMeta?.columns) ? previousMeta.columns.filter((value): value is string => typeof value === "string") : []),
    ...columns
  ];
  const allKeys = Array.from(new Set(columns));
  const publicFields = usefulPublicKeys(rows, sortByConfiguredOrder(filterPublicFieldKeys(allKeys, groupKey), existingColumnOrder));
  const publicFieldSet = new Set(publicFields);
  const previousDisplay = isRecord(previousMeta?.display) ? previousMeta.display : null;
  const explicitTableFields = Array.isArray(previousDisplay?.tableFields)
    ? previousDisplay.tableFields.filter((value): value is string => typeof value === "string" && publicFieldSet.has(value))
    : [];
  const displayTableFields = explicitTableFields.length ? explicitTableFields : publicFields.slice(0, 8);
  const displayFieldSet = new Set(displayTableFields);
  const cardFields = preferredCardFields(previousMeta, previousDisplay, displayTableFields, displayFieldSet);
  const existingSectionOrder = Array.isArray(previousDisplay?.sectionOrder)
    ? previousDisplay.sectionOrder.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : Array.isArray(previousMeta?.sectionOrder)
      ? previousMeta.sectionOrder.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];
  const sectionOrder = existingSectionOrder.length
    ? existingSectionOrder
    : groupKey === "collectionGroup"
      ? ["Items"]
      : getSectionOrder(rows, groupKey);
  const displayExclude = new Set<string>([
    ...cardFields,
    firstUsefulField(rows, DESCRIPTION_FIELD_PRIORITY, new Set()) ?? ""
  ].filter(Boolean));
  const existingSubtitleFields = Array.isArray(previousDisplay?.subtitleFields)
    ? previousDisplay.subtitleFields.filter((value): value is string => typeof value === "string" && publicFieldSet.has(value))
    : [];
  const subtitleFields = existingSubtitleFields.length
    ? existingSubtitleFields
    : usefulFieldList(rows, SUBTITLE_FIELD_PRIORITY.filter((key) => publicFieldSet.has(key)), displayExclude, 2);
  const existingDescriptionField =
    typeof previousDisplay?.descriptionField === "string" && publicFieldSet.has(previousDisplay.descriptionField)
      ? previousDisplay.descriptionField
      : null;
  const descriptionField = existingDescriptionField ?? firstUsefulField(rows, DESCRIPTION_FIELD_PRIORITY.filter((key) => publicFieldSet.has(key)));
  const existingBadgeField =
    typeof previousDisplay?.badgeField === "string" && publicFieldSet.has(previousDisplay.badgeField) ? previousDisplay.badgeField : null;
  const badgeField =
    existingBadgeField ??
    firstUsefulField(
      rows,
      BADGE_FIELD_PRIORITY.filter((key) => publicFieldSet.has(key)),
      new Set(descriptionField ? [descriptionField] : [])
    );
  const cardDescriptionField =
    typeof previousDisplay?.cardDescriptionField === "string" && publicFieldSet.has(previousDisplay.cardDescriptionField)
      ? previousDisplay.cardDescriptionField
      : descriptionField;

  const migratedItems: MigratedItem[] = rows.map((row, index) => {
    const source = isRecord(row.item) ? row.item : row;
    const system = isRecord(row.system) ? row.system : {};
    const levelLabel = stringValue(source.level);
    const fallbackName = levelLabel
      ? config.slug === "rebirths"
        ? `Rebirth ${levelLabel}`
        : `Level ${levelLabel}`
      : `${config.label} ${index + 1}`;
    const name = stringValue(source.name) ?? stringValue(source.title) ?? stringValue(source.item) ?? fallbackName;
    const sortOrder =
      numberValue(system.sortOrder) ??
      numberValue(row.sortOrder) ??
      numberValue(row.sort_order) ??
      index + 1;
    return {
      item: cleanPublicItem(row, publicFields, name),
      system: {
        slug: stringValue(system.slug) ?? stringValue(row.slug) ?? fallbackSlug(name, index),
        section:
          stringValue(system.section) ??
          (groupKey === "collectionGroup" ? "Items" : stringValue(getRowValue(row, groupKey))) ??
          "Items",
        sortOrder,
        image: stringValue(system.image) ?? stringValue(row.image)
      }
    };
  });
  const effectiveSectionOrder = [...sectionOrder];
  for (const entry of migratedItems) {
    if (!effectiveSectionOrder.includes(entry.system.section)) effectiveSectionOrder.push(entry.system.section);
  }

  const nextMeta = {
    schemaVersion: 2,
    game: config.gameName,
    gameSlug: config.gameSlug,
    collection: config.slug,
    route: `/wiki/${config.gameSlug}/${config.slug}`,
    catalogCode: config.code,
    itemFields: publicFields,
    columns: publicFields,
    display: {
      groupLabel: stringValue(previousDisplay?.groupLabel) ?? stringValue(previousMeta?.groupLabel) ?? (groupKey === "collectionGroup" ? "Group" : getFieldLabel(groupKey)),
      sectionOrder: effectiveSectionOrder,
      badgeField,
      subtitleFields,
      descriptionField,
      cardDescriptionField,
      cardFields,
      tableFields: displayTableFields,
      fieldPresentation: filterPresentation(previousDisplay?.fieldPresentation ?? previousMeta?.fieldPresentation, publicFieldSet)
    }
  };

  const nextDocument = {
    meta: nextMeta,
    items: migratedItems
  };
  const checks: DatasetIssue[] = [];
  if (!publicFields.length) checks.push({ message: "no public item fields after migration", blocking: true });
  if (!displayTableFields.length) checks.push({ message: "no display.tableFields after migration", blocking: true });
  if (!cardFields.length) checks.push({ message: "no display.cardFields after migration", blocking: true });
  if (!sectionOrder.length) checks.push({ message: "no display.sectionOrder after migration", blocking: true });
  if (migratedItems.some((entry) => !entry.item.name)) {
    checks.push({ message: "one or more migrated items are missing item.name", blocking: true });
  }

  const sourcePublicValueCount = countPublicValues(rows, publicFields);
  const migratedPublicValueCount = countMigratedPublicValues(migratedItems, publicFields);
  if (migratedPublicValueCount < sourcePublicValueCount) {
    checks.push({
      message: `migration would drop public item values (${migratedPublicValueCount} after, ${sourcePublicValueCount} before)`,
      blocking: true
    });
  }

  const issues = checks.map((check) => check.message);
  const hasBlockingIssue = checks.some((check) => check.blocking);
  const nextRaw = `${JSON.stringify(nextDocument, null, 2)}\n`;
  const changed = nextRaw !== raw;

  if (options.apply && changed && !hasBlockingIssue) {
    await fs.writeFile(datasetPath, nextRaw);
  }

  return {
    code: config.code,
    datasetPath,
    itemCount: migratedItems.length,
    changed,
    publicFields,
    tableFields: displayTableFields,
    cardFields,
    issues
  };
}

function filterConfigs(options: Options) {
  return GAME_COLLECTIONS.filter((config) => {
    if (isDatabaseOnlyGameCollectionGame(config.gameSlug)) return false;
    if (options.game && config.gameSlug !== options.game) return false;
    if (options.collection && config.slug !== options.collection) return false;
    return true;
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.game && isDatabaseOnlyGameCollectionGame(options.game)) {
    throw new Error(`${options.game} is database-only and has no compatibility dataset to migrate.`);
  }
  const configs = filterConfigs(options);
  if (!configs.length) throw new Error("No registered game collections matched the filters.");

  const results: Result[] = [];
  for (const config of configs) {
    try {
      results.push(await migrateConfig(config, options));
    } catch (error) {
      results.push({
        code: config.code,
        datasetPath: repoPath("data", config.dataDir, config.file),
        itemCount: 0,
        changed: false,
        publicFields: [],
        tableFields: [],
        cardFields: [],
        issues: [error instanceof Error ? error.message : String(error)]
      });
    }
  }

  if (options.json) {
    console.log(JSON.stringify({ apply: options.apply, results }, null, 2));
  } else {
    console.log(`Game collection dataset v2 migration ${options.apply ? "apply" : "dry-run"}`);
    console.log(`Checked ${results.length} registered collection dataset(s).`);
    console.log(`Would change: ${results.filter((result) => result.changed).length}`);
    console.log(`Issues: ${results.filter((result) => result.issues.length).length}`);
    for (const result of results) {
      if (!result.changed && !result.issues.length) continue;
      console.log("");
      console.log(`${result.code} (${path.relative(process.cwd(), result.datasetPath)})`);
      console.log(`  items: ${result.itemCount}`);
      console.log(`  public fields: ${result.publicFields.join(", ") || "(none)"}`);
      console.log(`  table fields: ${result.tableFields.join(", ") || "(none)"}`);
      console.log(`  card fields: ${result.cardFields.join(", ") || "(none)"}`);
      for (const issue of result.issues) console.log(`  issue: ${issue}`);
    }
  }

  if (results.some((result) => result.issues.length)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
