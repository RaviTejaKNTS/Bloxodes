import "../shared/load-env";

import { spawn } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { supabaseAdmin } from "@/lib/supabase-admin";

type CliOptions = {
  baseUrl: string;
  game: string;
  collections: string[];
  finalJsonRoot: string;
};

type CatalogFinal = {
  code?: string;
  title?: string;
  universe_id?: number | null;
  wiki_slug?: string;
  collection_slug?: string;
};

function printUsage() {
  console.log(
    "Usage: npm run verify:game-catalog-finals -- --base-url http://localhost:3000 --game <game-slug> --final-json-root <catalogs-root> [--collection <slug> ...]"
  );
}

function parseArgs(argv: string[]): CliOptions {
  let baseUrl: string | null = null;
  let game: string | null = null;
  let finalJsonRoot: string | null = null;
  const collections: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "-h":
      case "--help":
        printUsage();
        process.exit(0);
      case "--base-url":
        baseUrl = argv[++i] ?? null;
        break;
      case "--game":
      case "--game-slug":
      case "--wiki-slug":
        game = argv[++i] ?? null;
        break;
      case "--collection":
      case "--collection-slug":
        collections.push((argv[++i] ?? "").trim().toLowerCase());
        break;
      case "--final-json-root":
      case "--final-json-dir":
        finalJsonRoot = argv[++i] ?? null;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!baseUrl) throw new Error("--base-url is required");
  if (!game) throw new Error("--game is required");
  if (!finalJsonRoot) throw new Error("--final-json-root is required");

  return {
    baseUrl: new URL(baseUrl).toString().replace(/\/$/, ""),
    game: game.trim().toLowerCase(),
    collections: Array.from(new Set(collections.filter(Boolean))),
    finalJsonRoot,
  };
}

async function pathExists(file: string) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

async function discoverCollections(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const collections: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const finalPath = path.join(root, entry.name, "final.json");
    if (await pathExists(finalPath)) collections.push(entry.name);
  }
  return collections.sort();
}

async function findFinalFile(root: string, collection: string, game: string) {
  const candidates = [
    path.join(root, collection, "final.json"),
    path.join(root, `${game}-${collection}`, "final.json"),
  ];
  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate;
  }
  throw new Error(`Missing catalog final.json for ${collection}. Checked: ${candidates.join(", ")}`);
}

async function readFinal(file: string): Promise<CatalogFinal> {
  return JSON.parse(await readFile(file, "utf8")) as CatalogFinal;
}

function runCommand(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      shell: false,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function verifyReadback(game: string, collection: string, finalJson: CatalogFinal) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("wiki_catalog_pages")
    .select("wiki_slug,collection_slug,code,title,universe_id,item_count,is_published,meta_description")
    .eq("wiki_slug", game)
    .eq("collection_slug", collection)
    .maybeSingle();

  if (error) throw new Error(`Failed to read catalog ${game}/${collection}: ${error.message}`);
  if (!data) throw new Error(`No wiki_catalog_pages row found for ${game}/${collection}`);
  const row = data as {
    code?: string | null;
    title?: string | null;
    universe_id?: number | null;
    item_count?: number | null;
    is_published?: boolean;
  };
  if (!row.is_published) throw new Error(`Catalog ${game}/${collection} is not published`);
  if (!row.item_count || row.item_count < 1) throw new Error(`Catalog ${game}/${collection} has no item_count`);
  if (finalJson.title && row.title !== finalJson.title) throw new Error(`Catalog title mismatch for ${game}/${collection}`);
  if (finalJson.code && row.code !== finalJson.code) throw new Error(`Catalog code mismatch for ${game}/${collection}`);
  if (typeof finalJson.universe_id === "number" && row.universe_id !== finalJson.universe_id) {
    throw new Error(`Catalog universe_id mismatch for ${game}/${collection}`);
  }
}

async function verifyRoute(url: string, title?: string) {
  const response = await fetch(url, { redirect: "follow" });
  const body = await response.text();
  if (response.status !== 200) throw new Error(`${url} returned HTTP ${response.status}`);
  if (title && !body.includes(title) && !body.includes(title.replace(/&/g, "&amp;"))) {
    throw new Error(`${url} returned 200 but did not include the catalog title`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const root = path.isAbsolute(options.finalJsonRoot)
    ? options.finalJsonRoot
    : path.resolve(process.cwd(), options.finalJsonRoot);
  const collections = options.collections.length ? options.collections : await discoverCollections(root);
  if (!collections.length) throw new Error(`No catalog final.json files found under ${root}`);

  const finalFiles = await Promise.all(collections.map((collection) => findFinalFile(root, collection, options.game)));
  const finals = await Promise.all(finalFiles.map(readFinal));

  await runCommand("npm", ["run", "content:check-copy", "--", ...finalFiles]);
  for (let index = 0; index < collections.length; index += 1) {
    await runCommand("npm", [
      "run",
      "check:game-catalog-data",
      "--",
      "--game",
      options.game,
      "--collection",
      collections[index],
      "--final-json",
      finalFiles[index],
    ]);
  }
  await runCommand("npm", [
    "run",
    "seed:game-catalog-pages",
    "--",
    "--game",
    options.game,
    ...collections.flatMap((collection) => ["--collection", collection]),
    "--final-json-root",
    options.finalJsonRoot,
  ]);

  const urls: string[] = [];
  for (let index = 0; index < collections.length; index += 1) {
    const collection = collections[index];
    const finalJson = finals[index];
    await verifyReadback(options.game, collection, finalJson);
    const url = `${options.baseUrl}/wiki/${options.game}/${collection}`;
    await verifyRoute(url, finalJson.title);
    console.log(`Route passed: ${url}`);
    urls.push(url);
  }

  console.log("\nVerified localhost links:");
  urls.forEach((url) => console.log(`- ${url}`));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
