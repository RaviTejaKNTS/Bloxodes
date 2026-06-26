import fs from "node:fs/promises";
import path from "node:path";

import { getGameCollectionConfigByWikiPath } from "@/lib/game-collections";
import { repoPath } from "@/lib/paths";

type CliOptions = {
  game: string | null;
  collection: string | null;
  dryRun: boolean;
};

const CONFIG_PATH = repoPath("apps", "web", "src", "lib", "game-collections.ts");

function printUsage() {
  console.log(`Usage:
  npm run register:game-collection -- --game <game-slug> --collection <collection-slug> [--dry-run]

Adds a collection slug to an existing GAME_COLLECTION_GROUPS game entry.
If the game group does not exist, the script prints the manual block needed and exits without editing.
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

function manualGroupSnippet(gameSlug: string, collection: string): string {
  return `{
    gameSlug: "${gameSlug}",
    gameName: "TODO Game Name",
    universeId: 0,
    dataDir: "TODO Game Name",
    universeNames: ["TODO Game Name"],
    collections: ["${collection}"]
  }`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (getGameCollectionConfigByWikiPath(options.game!, options.collection!)) {
    console.log(`${options.game}/${options.collection} is already registered.`);
    return;
  }

  const source = await fs.readFile(CONFIG_PATH, "utf8");
  const bounds = findObjectBounds(source, options.game!);
  if (!bounds) {
    console.log(`No GAME_COLLECTION_GROUPS entry found for ${options.game}. Add a group like:\n`);
    console.log(manualGroupSnippet(options.game!, options.collection!));
    process.exitCode = 1;
    return;
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
    console.log(`Would add ${options.collection} to ${options.game} collections in ${path.relative(process.cwd(), CONFIG_PATH)}.`);
    return;
  }

  await fs.writeFile(CONFIG_PATH, nextSource);
  console.log(`Registered ${options.game}/${options.collection}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
