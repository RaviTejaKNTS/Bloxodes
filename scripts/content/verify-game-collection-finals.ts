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

type CollectionFinal = {
  code?: string;
  display_name?: string;
  title?: string;
  universe_id?: number | null;
  wiki_slug?: string;
  collection_slug?: string;
};

function printUsage() {
  console.log(
    "Usage: npm run verify:game-collection-finals -- --base-url http://localhost:3000 --game <game-slug> --final-json-root <collections-root> [--collection <slug> ...]"
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
  throw new Error(`Missing collection final.json for ${collection}. Checked: ${candidates.join(", ")}`);
}

async function findRuntimeManifest(root: string, collection: string) {
  const candidate = path.join(root, collection, "runtime-manifest.json");
  return (await pathExists(candidate)) ? candidate : null;
}

async function inputsFromRuntimeManifest(manifestPath: string) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { dataset?: string; mediaRoot?: string };
  if (!manifest.dataset || !manifest.mediaRoot) throw new Error(`${manifestPath} is missing dataset or mediaRoot.`);
  return {
    dataset: path.resolve(path.dirname(manifestPath), manifest.dataset),
    mediaRoot: path.resolve(path.dirname(manifestPath), manifest.mediaRoot)
  };
}

async function readFinal(file: string): Promise<CollectionFinal> {
  const parsed = JSON.parse(await readFile(file, "utf8")) as CollectionFinal;
  if (typeof parsed.display_name !== "string" || !parsed.display_name.trim()) {
    throw new Error(`${file} must include display_name, the short reusable collection name such as "Units".`);
  }
  return parsed;
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
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function verifyReadback(game: string, collection: string, finalJson: CollectionFinal, runtimeExpected: boolean) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("wiki_collection_pages")
    .select("wiki_slug,collection_slug,code,title,display_name,universe_id,item_count,is_published,meta_description,published_dataset_id")
    .eq("wiki_slug", game)
    .eq("collection_slug", collection)
    .maybeSingle();

  if (error) throw new Error(`Failed to read collection ${game}/${collection}: ${error.message}`);
  if (!data) throw new Error(`No wiki_collection_pages row found for ${game}/${collection}`);
  const row = data as {
    code?: string | null;
    title?: string | null;
    display_name?: string | null;
    universe_id?: number | null;
    item_count?: number | null;
    is_published?: boolean;
    published_dataset_id?: string | null;
  };
  if (!row.is_published) throw new Error(`Collection ${game}/${collection} is not published`);
  if (!row.item_count || row.item_count < 1) throw new Error(`Collection ${game}/${collection} has no item_count`);
  const expectedTitle = finalJson.title ? resolveItemCountToken(finalJson.title, row.item_count) : null;
  const expectedDisplayName = finalJson.display_name?.trim();
  if (expectedTitle && row.title !== expectedTitle) throw new Error(`Collection title mismatch for ${game}/${collection}`);
  if (!expectedDisplayName || row.display_name !== expectedDisplayName) throw new Error(`Collection display_name mismatch for ${game}/${collection}`);
  if (finalJson.code && row.code !== finalJson.code) throw new Error(`Collection code mismatch for ${game}/${collection}`);
  if (typeof finalJson.universe_id === "number" && row.universe_id !== finalJson.universe_id) {
    throw new Error(`Collection universe_id mismatch for ${game}/${collection}`);
  }
  if (runtimeExpected && !row.published_dataset_id) {
    throw new Error(`Collection ${game}/${collection} has no published runtime revision`);
  }
  if (row.published_dataset_id) {
    const { data: dataset, error: datasetError } = await sb
      .from("wiki_collection_datasets")
      .select("id,item_count,content_hash")
      .eq("id", row.published_dataset_id)
      .maybeSingle();
    if (datasetError) throw new Error(`Failed to read runtime revision for ${game}/${collection}: ${datasetError.message}`);
    if (!dataset || dataset.item_count !== row.item_count) {
      throw new Error(`Runtime revision count mismatch for ${game}/${collection}`);
    }
  }
  return { title: expectedTitle ?? row.title ?? undefined };
}

function resolveItemCountToken(value: string, itemCount: number): string {
  const countLabel = itemCount.toLocaleString("en-US");
  return value.replace(/\{\{\s*(?:count|item_count)\s*\}\}|\{\s*(?:count|item_count)\s*\}/gi, countLabel);
}

async function verifyRoute(url: string, title?: string) {
  const response = await fetch(url, { redirect: "follow" });
  const body = await response.text();
  if (response.status !== 200) throw new Error(`${url} returned HTTP ${response.status}`);
  if (title && !body.includes(title) && !body.includes(title.replace(/&/g, "&amp;"))) {
    throw new Error(`${url} returned 200 but did not include the collection title`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const root = path.isAbsolute(options.finalJsonRoot)
    ? options.finalJsonRoot
    : path.resolve(process.cwd(), options.finalJsonRoot);
  const collections = options.collections.length ? options.collections : await discoverCollections(root);
  if (!collections.length) throw new Error(`No collection final.json files found under ${root}`);

  const finalFiles = await Promise.all(collections.map((collection) => findFinalFile(root, collection, options.game)));
  const runtimeManifests = await Promise.all(collections.map((collection) => findRuntimeManifest(root, collection)));
  const finals = await Promise.all(finalFiles.map(readFinal));

  await runCommand("npm", ["run", "content:check-copy", "--", ...finalFiles]);
  for (let index = 0; index < collections.length; index += 1) {
    const manifest = runtimeManifests[index];
    const runtimeInputs = manifest ? await inputsFromRuntimeManifest(manifest) : null;
    const dataArgs = runtimeInputs
      ? [
          "--game", options.game,
          "--collection", collections[index],
          "--file", runtimeInputs.dataset,
          "--media-root", runtimeInputs.mediaRoot,
          "--final-json", finalFiles[index]
        ]
      : ["--game", options.game, "--collection", collections[index], "--final-json", finalFiles[index]];
    await runCommand("npm", [
      "run",
      "check:game-collection-data",
      "--",
      ...dataArgs,
    ]);
    if (manifest) {
      await runCommand("npm", ["run", "sync:game-collection-runtime", "--", "--manifest", manifest]);
    }
  }
  const legacyCollections = collections.filter((_, index) => !runtimeManifests[index]);
  if (legacyCollections.length) {
    await runCommand("npm", [
      "run",
      "seed:game-collection-pages",
      "--",
      "--game",
      options.game,
      ...legacyCollections.flatMap((collection) => ["--collection", collection]),
      "--final-json-root",
      options.finalJsonRoot,
    ]);
  }

  const urls: string[] = [];
  for (let index = 0; index < collections.length; index += 1) {
    const collection = collections[index];
    const finalJson = finals[index];
    const readback = await verifyReadback(options.game, collection, finalJson, Boolean(runtimeManifests[index]));
    const url = `${options.baseUrl}/wiki/${options.game}/${collection}`;
    await verifyRoute(url, readback.title);
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
