import fs from "node:fs/promises";
import path from "node:path";

import { getGameCollectionConfigByWikiPath } from "@/lib/game-collections";
import { repoPath } from "@/lib/paths";

type CliOptions = {
  game: string | null;
  collection: string | null;
  dryRun: boolean;
};

const GAMES_DIR = repoPath("apps", "web", "src", "lib", "game-collections", "games");
const GAMES_INDEX_PATH = path.join(GAMES_DIR, "index.ts");

function printUsage() {
  console.log(`Usage:
  npm run register:game-collection -- --game <game-slug> --collection <collection-slug> [--dry-run]

Registers a collection slug for a game group under apps/web/src/lib/game-collections/games.
If games/<game-slug>.ts exists, the collection slug is added to its collections array.
If it does not exist, a new games/<game-slug>.ts is created (with TODO fields to fill in)
and its export is wired into games/index.ts.
`);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { game: null, collection: null, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "-h":
      case "--help":
        printUsage();
        process.exit(0);
      case "--game":
      case "--game-slug":
        options.game = requireValue(argv, ++i, arg).toLowerCase();
        break;
      case "--collection":
      case "--collection-slug":
        options.collection = requireValue(argv, ++i, arg).toLowerCase();
        break;
      case "--dry-run":
        options.dryRun = true;
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

function gameFilePath(gameSlug: string): string {
  return path.join(GAMES_DIR, `${gameSlug}.ts`);
}

// Derives the exported group identifier from a game slug, matching the existing
// convention: camelCase + "CollectionGroup". Leading purely-numeric segments are
// dropped because JS identifiers cannot start with a digit
// (e.g. "99-nights-in-the-forest" -> "nightsInTheForestCollectionGroup").
function groupExportName(gameSlug: string): string {
  const segments = gameSlug.split("-").filter(Boolean);
  while (segments.length > 1 && /^\d+$/.test(segments[0])) segments.shift();
  const camel = segments
    .map((segment, index) =>
      index === 0 ? segment : segment.charAt(0).toUpperCase() + segment.slice(1)
    )
    .join("");
  return `${camel}CollectionGroup`;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function findObjectBounds(source: string, gameSlug: string): { start: number; end: number } | null {
  const gameMatch = new RegExp(`gameSlug:\\s*["']${escapeRegExp(gameSlug)}["']`).exec(source);
  if (!gameMatch?.index) return null;

  let start = gameMatch.index;
  while (start >= 0 && source[start] !== "{") start -= 1;
  if (start < 0) return null;

  let depth = 0;
  let quote: string | null = null;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return { start, end: index + 1 };
    }
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractCollections(block: string): { start: number; end: number; values: string[] } | null {
  const propMatch = /collections:\s*\[/.exec(block);
  if (!propMatch?.index) return null;
  const start = propMatch.index;
  const arrayStart = start + propMatch[0].length - 1;
  let depth = 0;
  let quote: string | null = null;
  let escaped = false;
  for (let index = arrayStart; index < block.length; index += 1) {
    const char = block[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }
    if (char === "[") depth += 1;
    if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        const end = index + 1;
        const arrayText = block.slice(arrayStart, end);
        const values = Array.from(arrayText.matchAll(/["']([^"']+)["']/g)).map((match) => match[1]);
        return { start, end, values };
      }
    }
  }
  return null;
}

function formatCollections(values: string[], baseIndent: string): string {
  const itemIndent = `${baseIndent}  `;
  return `collections: [\n${values.map((value) => `${itemIndent}"${value}"`).join(",\n")}\n${baseIndent}]`;
}

function gameFileTemplate(gameSlug: string, exportName: string, collection: string): string {
  return `import type { GameCollectionGroup } from "../types";

export const ${exportName} = {
    gameSlug: "${gameSlug}",
    gameName: "TODO Game Name",
    universeId: 0,
    universeNames: ["TODO Game Name"],
    collections: ["${collection}"]
  } satisfies GameCollectionGroup;
`;
}

// Wires a newly created group file into games/index.ts: adds the import (just
// before the shared type import) and appends the group to GAME_COLLECTION_GROUPS.
function addGroupToIndex(source: string, gameSlug: string, exportName: string): string {
  const importLine = `import { ${exportName} } from "./${gameSlug}";`;
  if (source.includes(importLine)) return source;

  const typesImport = 'import type { GameCollectionGroup } from "../types";';
  if (!source.includes(typesImport)) {
    throw new Error("Could not find the GameCollectionGroup type import in games/index.ts.");
  }
  let next = source.replace(typesImport, `${importLine}\n${typesImport}`);

  const arrayCloseRe = /\n\] satisfies GameCollectionGroup\[\];/;
  const closeMatch = arrayCloseRe.exec(next);
  if (!closeMatch) {
    throw new Error("Could not find the GAME_COLLECTION_GROUPS array in games/index.ts.");
  }
  const before = next.slice(0, closeMatch.index).replace(/,?\s*$/, "");
  next = `${before},\n  ${exportName}${next.slice(closeMatch.index)}`;
  return next;
}

async function registerExistingGame(filePath: string, options: CliOptions): Promise<void> {
  const source = await fs.readFile(filePath, "utf8");
  const bounds = findObjectBounds(source, options.game!);
  if (!bounds) {
    throw new Error(`Could not find a group object for ${options.game} in ${path.relative(process.cwd(), filePath)}.`);
  }

  const block = source.slice(bounds.start, bounds.end);
  const collections = extractCollections(block);
  if (!collections) {
    throw new Error(`Could not find collections array for ${options.game}.`);
  }

  const nextValues = Array.from(new Set([...collections.values, options.collection!]));
  if (nextValues.length === collections.values.length) {
    console.log(`${options.game}/${options.collection} is already listed in collections.`);
    return;
  }

  const lineStart = block.lastIndexOf("\n", collections.start) + 1;
  const baseIndent = block.slice(lineStart, collections.start).match(/^\s*/)?.[0] ?? "    ";
  const nextBlock =
    block.slice(0, collections.start) +
    formatCollections(nextValues, baseIndent) +
    block.slice(collections.end);
  const nextSource = source.slice(0, bounds.start) + nextBlock + source.slice(bounds.end);

  if (options.dryRun) {
    console.log(`Would add ${options.collection} to ${options.game} collections in ${path.relative(process.cwd(), filePath)}.`);
    return;
  }

  await fs.writeFile(filePath, nextSource);
  console.log(`Registered ${options.game}/${options.collection}.`);
}

async function registerNewGame(filePath: string, options: CliOptions): Promise<void> {
  const exportName = groupExportName(options.game!);
  const relFile = path.relative(process.cwd(), filePath);
  const relIndex = path.relative(process.cwd(), GAMES_INDEX_PATH);

  if (options.dryRun) {
    console.log(`Would create ${relFile} (export ${exportName}) and wire it into ${relIndex}.`);
    return;
  }

  await fs.writeFile(filePath, gameFileTemplate(options.game!, exportName, options.collection!));

  const indexSource = await fs.readFile(GAMES_INDEX_PATH, "utf8");
  await fs.writeFile(GAMES_INDEX_PATH, addGroupToIndex(indexSource, options.game!, exportName));

  console.log(`Created ${relFile} and registered ${exportName} in ${relIndex}.`);
  console.log(`Fill in the TODO fields in ${relFile}: gameName, universeId, universeNames.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (getGameCollectionConfigByWikiPath(options.game!, options.collection!)) {
    console.log(`${options.game}/${options.collection} is already registered.`);
    return;
  }

  const filePath = gameFilePath(options.game!);
  if (await pathExists(filePath)) {
    await registerExistingGame(filePath, options);
    return;
  }
  await registerNewGame(filePath, options);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
