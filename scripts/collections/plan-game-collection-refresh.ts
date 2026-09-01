import fs from "node:fs/promises";
import path from "node:path";

import {
  GAME_COLLECTION_GROUPS,
  GAME_COLLECTIONS,
  type GameCollectionConfig
} from "@/lib/game-collections";
import type { GameCollectionGroup } from "@/lib/game-collections/types";
import { repoPath } from "@/lib/paths";

const REGISTERED_GROUPS: readonly GameCollectionGroup[] = GAME_COLLECTION_GROUPS;

type CliOptions = {
  game: string | null;
  collection: string | null;
  output: string | null;
  json: boolean;
};

type CollectionRecord = {
  key: string;
  gameSlug: string;
  gameName: string;
  universeId: number | null;
  collectionSlug: string;
  code: string;
  datasetPath: string;
  pagePath: string;
  registered: boolean;
  exists: boolean;
  collectionShaped: boolean;
  itemCount: number | null;
  sections: string[];
  blocker: string | null;
  gates: {
    research: "pending";
    data: "pending";
    images: "pending";
    page: "pending";
    verification: "pending";
  };
  changedFiles: string[];
  notes: string[];
};

type GamePlan = {
  gameSlug: string;
  gameName: string;
  universeId: number | null;
  dataDir: string;
  collections: CollectionRecord[];
  suggestions: "pending" | "not-applicable";
  status: "pending";
};

type RefreshManifest = {
  schemaVersion: 1;
  createdAt: string;
  mode: "collection" | "game" | "all";
  selectors: {
    game: string | null;
    collection: string | null;
  };
  summary: {
    games: number;
    collections: number;
    registeredCollections: number;
    unregisteredCandidates: number;
    blockedCollections: number;
  };
  games: GamePlan[];
};

type DatasetInspection = {
  exists: boolean;
  collectionShaped: boolean;
  itemCount: number | null;
  sections: string[];
  blocker: string | null;
};

function printUsage() {
  console.log(`Usage:
  npm run plan:game-collection-refresh -- [options]

Options:
  --game <name|slug|universe-id>    Limit the plan to one registered game.
  --collection <slug|file|path>     Limit the plan to exactly one collection dataset.
  --dataset <slug|file|path>        Alias for --collection.
  --output <manifest.json>          Write the resumable manifest to an ignored path.
  --json                            Print the manifest as JSON.
  -h, --help                        Show this help.

With no selectors, plans every registered game collection. The planner reads collection
datasets and may write only the requested manifest; it never changes datasets or databases.
`);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { game: null, collection: null, output: null, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "-h":
      case "--help":
        printUsage();
        process.exit(0);
      case "--game":
      case "--game-slug":
        options.game = requireValue(argv, ++index, arg);
        break;
      case "--collection":
      case "--collection-slug":
      case "--dataset":
        options.collection = requireValue(argv, ++index, arg);
        break;
      case "--output":
      case "--manifest":
        options.output = requireValue(argv, ++index, arg);
        break;
      case "--json":
        options.json = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

function requireValue(argv: string[], index: number, option: string): string {
  const value = argv[index]?.trim();
  if (!value) throw new Error(`Missing value for ${option}`);
  return value;
}

function normalizeIdentity(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
}

function resolveGame(selector: string): GameCollectionGroup {
  const identity = normalizeIdentity(selector);
  const matches = REGISTERED_GROUPS.filter((group) => {
    const values = [group.gameSlug, group.gameName, group.dataDir, String(group.universeId ?? "")];
    return values.some((value) => normalizeIdentity(value) === identity);
  });
  if (matches.length === 0) throw new Error(`No registered game matched: ${selector}`);
  if (matches.length > 1) {
    throw new Error(`Game selector is ambiguous: ${selector}. Matches: ${matches.map((group) => group.gameSlug).join(", ")}`);
  }
  return matches[0];
}

async function inspectDataset(datasetPath: string): Promise<DatasetInspection> {
  let raw: string;
  try {
    raw = await fs.readFile(repoPath(datasetPath), "utf8");
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "ENOENT") {
      return {
        exists: false,
        collectionShaped: false,
        itemCount: null,
        sections: [],
        blocker: "Registered dataset file is missing."
      };
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      exists: true,
      collectionShaped: false,
      itemCount: null,
      sections: [],
      blocker: "Dataset is not valid JSON."
    };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { exists: true, collectionShaped: false, itemCount: null, sections: [], blocker: "Dataset is not a v2 collection document." };
  }

  const document = parsed as {
    meta?: { schemaVersion?: unknown };
    items?: Array<{ item?: unknown; system?: { section?: unknown } }>;
  };
  const items = Array.isArray(document.items) ? document.items : null;
  const collectionShaped = document.meta?.schemaVersion === 2 && Boolean(items);
  if (!collectionShaped || !items) {
    return { exists: true, collectionShaped: false, itemCount: null, sections: [], blocker: "Dataset is not a v2 collection document." };
  }

  const invalidRow = items.find(
    (row) => !row || typeof row !== "object" || !row.item || typeof row.item !== "object" || !row.system || typeof row.system !== "object"
  );
  if (invalidRow) {
    return { exists: true, collectionShaped: false, itemCount: items.length, sections: [], blocker: "Dataset has rows outside the v2 item/system contract." };
  }

  const sections = Array.from(
    new Set(
      items
        .map((row) => row.system?.section)
        .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
        .map((value) => value.trim())
    )
  );
  return { exists: true, collectionShaped: true, itemCount: items.length, sections, blocker: null };
}

function registeredRecord(group: GameCollectionGroup, config: GameCollectionConfig, inspection: DatasetInspection): CollectionRecord {
  const datasetPath = path.posix.join("data", group.dataDir, config.file);
  return buildRecord(group, config.slug, config.code, datasetPath, true, inspection);
}

function candidateRecord(group: GameCollectionGroup, file: string, inspection: DatasetInspection): CollectionRecord {
  const collectionSlug = file.replace(/\.json$/i, "");
  const datasetPath = path.posix.join("data", group.dataDir, file);
  return buildRecord(group, collectionSlug, `${group.gameSlug}-${collectionSlug}`, datasetPath, false, inspection);
}

function buildRecord(
  group: GameCollectionGroup,
  collectionSlug: string,
  code: string,
  datasetPath: string,
  registered: boolean,
  inspection: DatasetInspection
): CollectionRecord {
  return {
    key: `${group.gameSlug}/${collectionSlug}`,
    gameSlug: group.gameSlug,
    gameName: group.gameName,
    universeId: group.universeId ?? null,
    collectionSlug,
    code,
    datasetPath,
    pagePath: `/wiki/${group.gameSlug}/${collectionSlug}`,
    registered,
    ...inspection,
    gates: {
      research: "pending",
      data: "pending",
      images: "pending",
      page: "pending",
      verification: "pending"
    },
    changedFiles: [],
    notes: []
  };
}

async function collectGameRecords(group: GameCollectionGroup): Promise<CollectionRecord[]> {
  const configs = GAME_COLLECTIONS.filter((config) => config.gameSlug === group.gameSlug);
  const registeredFiles = new Set(configs.map((config) => config.file.toLowerCase()));
  const registered = await Promise.all(
    configs.map(async (config) => {
      const datasetPath = path.posix.join("data", group.dataDir, config.file);
      return registeredRecord(group, config, await inspectDataset(datasetPath));
    })
  );

  let files: string[] = [];
  try {
    files = (await fs.readdir(repoPath("data", group.dataDir)))
      .filter((file) => file.toLowerCase().endsWith(".json"))
      .sort();
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code !== "ENOENT") throw error;
  }

  const candidates: CollectionRecord[] = [];
  for (const file of files) {
    if (registeredFiles.has(file.toLowerCase())) continue;
    const datasetPath = path.posix.join("data", group.dataDir, file);
    const inspection = await inspectDataset(datasetPath);
    if (inspection.collectionShaped) candidates.push(candidateRecord(group, file, inspection));
  }

  return [...registered, ...candidates].sort((left, right) => left.collectionSlug.localeCompare(right.collectionSlug));
}

function matchesCollection(record: CollectionRecord, selector: string): boolean {
  const normalizedSelector = normalizePath(selector);
  const absoluteSelector = normalizePath(path.resolve(selector));
  const absoluteDataset = normalizePath(repoPath(record.datasetPath));
  const values = [
    record.collectionSlug,
    `${record.collectionSlug}.json`,
    record.code,
    record.datasetPath,
    absoluteDataset
  ].map(normalizePath);
  return values.includes(normalizedSelector) || absoluteDataset === absoluteSelector;
}

async function buildManifest(options: CliOptions): Promise<RefreshManifest> {
  const selectedGroups = options.game ? [resolveGame(options.game)] : [...REGISTERED_GROUPS];
  const gameRecords = await Promise.all(
    selectedGroups.map(async (group) => ({ group, records: await collectGameRecords(group) }))
  );

  let filtered = gameRecords;
  if (options.collection) {
    const matches = gameRecords.flatMap(({ group, records }) =>
      records.filter((record) => matchesCollection(record, options.collection!)).map((record) => ({ group, record }))
    );
    if (matches.length === 0) throw new Error(`No collection dataset matched: ${options.collection}`);
    if (matches.length > 1) {
      throw new Error(
        `Collection selector is ambiguous: ${options.collection}. Add --game. Matches: ${matches.map(({ record }) => record.key).join(", ")}`
      );
    }
    filtered = [{ group: matches[0].group, records: [matches[0].record] }];
  }

  const mode: RefreshManifest["mode"] = options.collection ? "collection" : options.game ? "game" : "all";
  const games: GamePlan[] = filtered.map(({ group, records }) => ({
    gameSlug: group.gameSlug,
    gameName: group.gameName,
    universeId: group.universeId ?? null,
    dataDir: group.dataDir,
    collections: records,
    suggestions: mode === "collection" ? "not-applicable" : "pending",
    status: "pending"
  }));
  const collections = games.flatMap((game) => game.collections);

  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    mode,
    selectors: { game: options.game, collection: options.collection },
    summary: {
      games: games.length,
      collections: collections.length,
      registeredCollections: collections.filter((record) => record.registered).length,
      unregisteredCandidates: collections.filter((record) => !record.registered).length,
      blockedCollections: collections.filter((record) => Boolean(record.blocker)).length
    },
    games
  };
}

async function writeManifest(output: string, manifest: RefreshManifest) {
  const target = path.isAbsolute(output) ? output : repoPath(output);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`);
  return target;
}

function printSummary(manifest: RefreshManifest, outputPath: string | null) {
  console.log(`Game collection refresh plan (${manifest.mode})`);
  console.log(`Games: ${manifest.summary.games}`);
  console.log(`Collections: ${manifest.summary.collections}`);
  console.log(`Registered: ${manifest.summary.registeredCollections}`);
  console.log(`Unregistered v2 candidates: ${manifest.summary.unregisteredCandidates}`);
  console.log(`Blocked at intake: ${manifest.summary.blockedCollections}`);
  for (const game of manifest.games) {
    console.log(`${game.gameSlug}: ${game.collections.length} collection(s), suggestions=${game.suggestions}`);
    for (const collection of game.collections.filter((record) => record.blocker)) {
      console.log(`  BLOCKED ${collection.collectionSlug}: ${collection.blocker}`);
    }
  }
  if (outputPath) console.log(`Manifest: ${outputPath}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifest = await buildManifest(options);
  const outputPath = options.output ? await writeManifest(options.output, manifest) : null;
  if (options.json) {
    console.log(JSON.stringify(manifest, null, 2));
  } else {
    printSummary(manifest, outputPath);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
