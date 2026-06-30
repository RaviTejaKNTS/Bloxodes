import fs from "node:fs/promises";
import path from "node:path";

import { GAME_COLLECTIONS } from "@/lib/game-collections";
import { repoPath } from "@/lib/paths";

type Options = {
  json: boolean;
  requireNoLegacyOverrides: boolean;
  game: string | null;
  collection: string | null;
};

type DatasetDocument = {
  meta?: Record<string, unknown> | null;
  items?: Record<string, unknown>[] | null;
  data?: Record<string, unknown>[] | null;
};

type Issue = {
  code: string;
  datasetPath: string;
  level: "error" | "warning";
  message: string;
};

const SYSTEM_KEYS = new Set(["slug", "section", "sortOrder", "image"]);
const FORBIDDEN_ITEM_KEYS = new Set([
  "id",
  "slug",
  "image",
  "collectionSection",
  "collectionGroup",
  "sortOrder",
  "sort_order",
  "_sortOrder",
  "__sortOrder",
  "imageStatus",
  "imageMissingReason",
  "imageSource",
  "wikiImageUrl",
  "imageCandidate",
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
  "sourceTables",
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
  "wikiSourceStatus",
  "verification",
  "verificationNote",
  "confidence",
  "blocker",
  "wikiUrl",
  "fields",
  "sections",
  "raw",
  "rawText",
  "rawHtml",
  "rawWikitext",
  "rawWikiText",
  "rawInfobox",
  "updatedAt"
]);

const FORBIDDEN_RENDER_LABELS = [
  "Sort Order",
  "Source Page",
  "Source Url",
  "Source URLs",
  "Source Image Url",
  "Verification Note",
  "Image Status",
  "Raw Text",
  "Raw Html",
  "Raw Wikitext",
  "Confidence"
];

function usage() {
  console.log(`Usage:
  npm run audit:game-collection-datasets:v2

Options:
  --game <game-slug>       Limit to one registered game.
  --collection <slug>      Limit to one collection slug. Requires --game.
  --allow-legacy-overrides Do not fail when the old generic override map is still present.
  --json                   Print machine-readable output.
  -h, --help               Show this help.
`);
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    json: false,
    requireNoLegacyOverrides: true,
    game: null,
    collection: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "-h":
      case "--help":
        usage();
        process.exit(0);
      case "--json":
        options.json = true;
        break;
      case "--allow-legacy-overrides":
        options.requireNoLegacyOverrides = false;
        break;
      case "--game":
      case "--game-slug":
        options.game = requireValue(argv, ++i, arg).toLowerCase();
        break;
      case "--collection":
      case "--collection-slug":
        options.collection = requireValue(argv, ++i, arg).toLowerCase();
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

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0) : [];
}

function isForbiddenItemKey(key: string) {
  const lower = key.toLowerCase();
  if (FORBIDDEN_ITEM_KEYS.has(key)) return true;
  if (!/^[a-z][A-Za-z0-9_]*$/.test(key)) return true;
  if (/\s/.test(key)) return true;
  if (key.startsWith("__")) return true;
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

async function readDataset(file: string): Promise<DatasetDocument | Record<string, unknown>[]> {
  return JSON.parse(await fs.readFile(file, "utf8")) as DatasetDocument | Record<string, unknown>[];
}

function addIssue(issues: Issue[], code: string, datasetPath: string, message: string, level: Issue["level"] = "error") {
  issues.push({ code, datasetPath, level, message });
}

async function auditLegacyOverrideMap(issues: Issue[], options: Options) {
  if (!options.requireNoLegacyOverrides) return;
  const file = repoPath("apps", "web", "src", "app", "(site)", "wiki", "collections", "games", "generic.tsx");
  const source = await fs.readFile(file, "utf8");
  if (/const CATALOG_SECTION_OVERRIDES[\s\S]*?=\s*\{[\s\S]*?\n\};/.test(source)) {
    addIssue(issues, "renderer", file, "CATALOG_SECTION_OVERRIDES is still present in the generic renderer.");
  }
  if (/CARD_STAT_OVERRIDES/.test(await fs.readFile(repoPath("apps", "web", "src", "components", "game-collections", "GameCollectionView.tsx"), "utf8"))) {
    addIssue(issues, "renderer", file, "CARD_STAT_OVERRIDES is still present in GameCollectionView.");
  }
}

function auditDataset(code: string, datasetPath: string, document: DatasetDocument | Record<string, unknown>[], issues: Issue[]) {
  if (Array.isArray(document)) {
    addIssue(issues, code, datasetPath, "Dataset still uses bare array shape.");
    return;
  }

  const meta = isRecord(document.meta) ? document.meta : null;
  const items = document.items ?? document.data ?? [];
  if (!meta) addIssue(issues, code, datasetPath, "Dataset is missing meta.");
  if (meta?.schemaVersion !== 2) addIssue(issues, code, datasetPath, "Dataset meta.schemaVersion must be 2.");
  if (!Array.isArray(document.items)) addIssue(issues, code, datasetPath, "Dataset must use items, not data.");
  if (!items.length) addIssue(issues, code, datasetPath, "Dataset has no items.");

  const itemFields = stringArray(meta?.itemFields);
  const columns = stringArray(meta?.columns);
  const display = isRecord(meta?.display) ? meta.display : null;
  const tableFields = stringArray(display?.tableFields);
  const cardFields = stringArray(display?.cardFields);
  const sectionOrder = stringArray(display?.sectionOrder);
  const allDisplayFields = [
    ...tableFields,
    ...cardFields,
    ...stringArray(display?.subtitleFields),
    ...(typeof display?.badgeField === "string" ? [display.badgeField] : []),
    ...(typeof display?.descriptionField === "string" ? [display.descriptionField] : []),
    ...(typeof display?.cardDescriptionField === "string" ? [display.cardDescriptionField] : [])
  ].filter(Boolean);

  if (!itemFields.length) addIssue(issues, code, datasetPath, "meta.itemFields is required.");
  if (!columns.length) addIssue(issues, code, datasetPath, "meta.columns is required.");
  if (!display) addIssue(issues, code, datasetPath, "meta.display is required.");
  if (!tableFields.length) addIssue(issues, code, datasetPath, "meta.display.tableFields is required.");
  if (!cardFields.length) addIssue(issues, code, datasetPath, "meta.display.cardFields is required.");
  if (!sectionOrder.length) addIssue(issues, code, datasetPath, "meta.display.sectionOrder is required.");

  for (const field of allDisplayFields) {
    if (!itemFields.includes(field)) {
      addIssue(issues, code, datasetPath, `Display field "${field}" is not listed in meta.itemFields.`);
    }
    if (isForbiddenItemKey(field)) {
      addIssue(issues, code, datasetPath, `Forbidden field "${field}" is listed for display.`);
    }
  }

  for (const label of FORBIDDEN_RENDER_LABELS) {
    const normalizedLabel = label.toLowerCase();
    if (allDisplayFields.some((field) => field.replace(/[_-]/g, " ").toLowerCase() === normalizedLabel)) {
      addIssue(issues, code, datasetPath, `Forbidden public label "${label}" can render from display fields.`);
    }
  }

  const sectionValues = new Set<string>();
  items.forEach((row, index) => {
    if (!isRecord(row)) {
      addIssue(issues, code, datasetPath, `Item ${index + 1} is not an object.`);
      return;
    }

    const rootKeys = Object.keys(row).filter((key) => !["item", "system"].includes(key));
    if (rootKeys.length) {
      addIssue(issues, code, datasetPath, `Item ${index + 1} has root key(s) outside item/system: ${rootKeys.join(", ")}.`);
    }

    const item = isRecord(row.item) ? row.item : null;
    const system = isRecord(row.system) ? row.system : null;
    if (!item) addIssue(issues, code, datasetPath, `Item ${index + 1} is missing item object.`);
    if (!system) addIssue(issues, code, datasetPath, `Item ${index + 1} is missing system object.`);

    if (item) {
      if (typeof item.name !== "string" || !item.name.trim()) {
        addIssue(issues, code, datasetPath, `Item ${index + 1} is missing item.name.`);
      }
      for (const key of Object.keys(item)) {
        if (isForbiddenItemKey(key)) {
          addIssue(issues, code, datasetPath, `Item ${index + 1} has forbidden public item key "${key}".`);
        }
      }
    }

    if (system) {
      for (const key of Object.keys(system)) {
        if (!SYSTEM_KEYS.has(key)) {
          addIssue(issues, code, datasetPath, `Item ${index + 1} has unsupported system key "${key}".`);
        }
      }
      if (typeof system.slug !== "string" || !system.slug.trim()) addIssue(issues, code, datasetPath, `Item ${index + 1} missing system.slug.`);
      if (typeof system.section !== "string" || !system.section.trim()) addIssue(issues, code, datasetPath, `Item ${index + 1} missing system.section.`);
      if (typeof system.sortOrder !== "number" || !Number.isFinite(system.sortOrder)) {
        addIssue(issues, code, datasetPath, `Item ${index + 1} missing numeric system.sortOrder.`);
      }
      if (typeof system.section === "string" && system.section.trim()) sectionValues.add(system.section);
    }
  });

  for (const section of sectionValues) {
    if (!sectionOrder.includes(section)) {
      addIssue(issues, code, datasetPath, `meta.display.sectionOrder is missing section "${section}".`);
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const issues: Issue[] = [];
  const configs = GAME_COLLECTIONS.filter((config) => {
    if (options.game && config.gameSlug !== options.game) return false;
    if (options.collection && config.slug !== options.collection) return false;
    return true;
  });

  if (!configs.length) throw new Error("No registered game collections matched the filters.");

  for (const config of configs) {
    const datasetPath = repoPath("data", config.dataDir, config.file);
    try {
      const document = await readDataset(datasetPath);
      auditDataset(config.code, datasetPath, document, issues);
    } catch (error) {
      addIssue(issues, config.code, datasetPath, error instanceof Error ? error.message : String(error));
    }
  }

  await auditLegacyOverrideMap(issues, options);

  if (options.json) {
    console.log(JSON.stringify({ checked: configs.length, issues }, null, 2));
  } else {
    console.log("Game collection v2 audit");
    console.log(`Checked ${configs.length} registered collection dataset(s).`);
    console.log(`Issues: ${issues.length}`);
    for (const issue of issues) {
      console.log(`${issue.level === "error" ? "ERROR" : "WARN"} ${issue.code} (${path.relative(process.cwd(), issue.datasetPath)}): ${issue.message}`);
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
