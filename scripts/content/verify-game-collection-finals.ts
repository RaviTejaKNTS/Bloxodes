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

type RuntimeManifest = {
  schemaVersion?: number;
  game?: { slug?: string };
  collection?: { slug?: string; pageType?: "database" | "checklist" };
  dataset?: string;
  finalJson?: string;
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
    const manifestPath = path.join(root, entry.name, "runtime-manifest.json");
    if (await pathExists(manifestPath)) collections.push(entry.name);
  }
  return collections.sort();
}

async function findManifestFile(root: string, collection: string, game: string) {
  const candidates = [
    path.join(root, collection, "runtime-manifest.json"),
    path.join(root, `${game}-${collection}`, "runtime-manifest.json"),
  ];
  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate;
  }
  throw new Error(`Missing runtime-manifest.json for ${collection}. Checked: ${candidates.join(", ")}`);
}

async function readManifest(file: string, game: string, collection: string) {
  const parsed = JSON.parse(await readFile(file, "utf8")) as RuntimeManifest;
  if (parsed.schemaVersion !== 1 || parsed.game?.slug !== game || parsed.collection?.slug !== collection) {
    throw new Error(`${file} does not match ${game}/${collection}.`);
  }
  if (!parsed.dataset || !parsed.finalJson) throw new Error(`${file} must include dataset and finalJson.`);
  const root = path.dirname(file);
  const resolveInside = (value: string) => {
    const resolved = path.resolve(root, value);
    const relative = path.relative(root, resolved);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`${file} contains a path outside its workspace.`);
    }
    return resolved;
  };
  const datasetFile = resolveInside(parsed.dataset);
  const finalFile = resolveInside(parsed.finalJson);
  if (!(await pathExists(datasetFile)) || !(await pathExists(finalFile))) {
    throw new Error(`${file} references a missing dataset or final JSON file.`);
  }
  const pageType = parsed.collection?.pageType === "checklist" ? "checklist" : "database";
  return { datasetFile, finalFile, pageType };
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
      code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function verifyReadback(game: string, collection: string, finalJson: CollectionFinal, pageType: "database" | "checklist") {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("wiki_collection_pages")
    .select("wiki_slug,collection_slug,code,page_type,title,display_name,universe_id,item_count,is_published,meta_description,published_dataset_id")
    .eq("wiki_slug", game)
    .eq("collection_slug", collection)
    .maybeSingle();

  if (error) throw new Error(`Failed to read collection ${game}/${collection}: ${error.message}`);
  if (!data) throw new Error(`No wiki_collection_pages row found for ${game}/${collection}`);
  const row = data as {
    code?: string | null;
    page_type?: string | null;
    title?: string | null;
    display_name?: string | null;
    universe_id?: number | null;
    item_count?: number | null;
    is_published?: boolean;
    published_dataset_id?: string | null;
  };
  if (!row.is_published) throw new Error(`Collection ${game}/${collection} is not published`);
  if (row.page_type !== pageType) throw new Error(`Collection ${game}/${collection} page type mismatch: ${row.page_type ?? "missing"} != ${pageType}`);
  if (!row.item_count || row.item_count < 1) throw new Error(`Collection ${game}/${collection} has no item_count`);
  if (!row.published_dataset_id) throw new Error(`Collection ${game}/${collection} has no published dataset pointer`);
  const { data: dataset, error: datasetError } = await sb
    .from("wiki_collection_datasets")
    .select("item_count")
    .eq("id", row.published_dataset_id)
    .maybeSingle();
  if (datasetError) throw new Error(`Failed to read collection dataset ${game}/${collection}: ${datasetError.message}`);
  if (!dataset) throw new Error(`Published dataset is missing for ${game}/${collection}`);
  const { count: actualItemCount, error: countError } = await sb
    .from("wiki_collection_items")
    .select("id", { count: "exact", head: true })
    .eq("dataset_id", row.published_dataset_id);
  if (countError) throw new Error(`Failed to count collection items ${game}/${collection}: ${countError.message}`);
  if (Number(dataset.item_count) !== row.item_count || actualItemCount !== row.item_count) {
    throw new Error(`Published dataset item count mismatch for ${game}/${collection}`);
  }
  const expectedTitle = finalJson.title ? resolveItemCountToken(finalJson.title, row.item_count) : null;
  const expectedDisplayName = finalJson.display_name?.trim();
  if (expectedTitle && row.title !== expectedTitle) throw new Error(`Collection title mismatch for ${game}/${collection}`);
  if (!expectedDisplayName || row.display_name !== expectedDisplayName) throw new Error(`Collection display_name mismatch for ${game}/${collection}`);
  if (finalJson.code && row.code !== finalJson.code) throw new Error(`Collection code mismatch for ${game}/${collection}`);
  if (typeof finalJson.universe_id === "number" && row.universe_id !== finalJson.universe_id) {
    throw new Error(`Collection universe_id mismatch for ${game}/${collection}`);
  }
  return { title: expectedTitle ?? row.title ?? undefined, pageType };
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

async function verifyChecklistPagination(url: string) {
  const response = await fetch(`${url}/page/2`, { redirect: "manual" });
  if (response.status !== 404) throw new Error(`${url}/page/2 should return 404 for a checklist, received ${response.status}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const root = path.isAbsolute(options.finalJsonRoot)
    ? options.finalJsonRoot
    : path.resolve(process.cwd(), options.finalJsonRoot);
  const collections = options.collections.length ? options.collections : await discoverCollections(root);
  if (!collections.length) throw new Error(`No collection runtime manifests found under ${root}`);

  const manifestFiles = await Promise.all(collections.map((collection) => findManifestFile(root, collection, options.game)));
  const workspaces = await Promise.all(manifestFiles.map((file, index) => readManifest(file, options.game, collections[index])));
  const finalFiles = workspaces.map((workspace) => workspace.finalFile);
  const finals = await Promise.all(finalFiles.map(readFinal));

  await runCommand("npm", ["run", "content:check-copy", "--", ...finalFiles]);
  for (let index = 0; index < collections.length; index += 1) {
    await runCommand("npm", [
      "run",
      "audit:game-collection-datasets:v2",
      "--",
      "--game",
      options.game,
      "--collection",
      collections[index],
      "--file",
      workspaces[index].datasetFile,
    ]);
    await runCommand("npm", [
      "run",
      "check:game-collection-data",
      "--",
      "--game",
      options.game,
      "--collection",
      collections[index],
      "--file",
      workspaces[index].datasetFile,
      "--final-json",
      finalFiles[index],
    ]);
  }
  await runCommand("env", [
    "BLOXODES_ENV_OVERLAYS=cloudflare",
    "npm",
    "run",
    "sync:game-collection-runtime",
    "--",
    ...manifestFiles.flatMap((manifest) => ["--manifest", manifest]),
    "--normalize-legacy-media",
    "--upload-media",
    "--apply",
    "--publish",
  ]);

  const urls: string[] = [];
  for (let index = 0; index < collections.length; index += 1) {
    const collection = collections[index];
    const finalJson = finals[index];
    const readback = await verifyReadback(options.game, collection, finalJson, workspaces[index].pageType);
    const url = `${options.baseUrl}/wiki/${options.game}/${collection}`;
    await verifyRoute(url, readback.title);
    if (readback.pageType === "checklist") await verifyChecklistPagination(url);
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
