import fs from "node:fs/promises";
import path from "node:path";

import { repoPath } from "@/lib/paths";

type ManifestEntry = {
  name: string;
  url: string;
  fileName?: string;
  image?: string;
};

type Manifest = ManifestEntry[] | { entries?: ManifestEntry[] };

type CliOptions = {
  manifest: string | null;
  dataset: string | null;
  gameName: string | null;
  collectionName: string | null;
  outDir: string | null;
  dryRun: boolean;
  noUpdateDataset: boolean;
};

function printUsage() {
  console.log(`Usage:
  npm run collect:collection-images -- --manifest <images.json> --dataset <dataset.json> [options]

Manifest shape:
  [{ "name": "Item Name", "url": "https://...", "fileName": "item-name.png" }]

Options:
  --game-name <name>          Used for default output folder when --out-dir is omitted.
  --collection-name <name>    Used for default output folder when --out-dir is omitted.
  --out-dir <dir>             Defaults to apps/web/public/<Game>/<Collection>.
  --dry-run                   Print planned downloads without writing.
  --no-update-dataset         Download images but do not update dataset image fields.
`);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    manifest: null,
    dataset: null,
    gameName: null,
    collectionName: null,
    outDir: null,
    dryRun: false,
    noUpdateDataset: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "-h":
      case "--help":
        printUsage();
        process.exit(0);
      case "--manifest":
        options.manifest = requireValue(argv, ++i, arg);
        break;
      case "--dataset":
        options.dataset = requireValue(argv, ++i, arg);
        break;
      case "--game-name":
        options.gameName = requireValue(argv, ++i, arg);
        break;
      case "--collection-name":
        options.collectionName = requireValue(argv, ++i, arg);
        break;
      case "--out-dir":
        options.outDir = requireValue(argv, ++i, arg);
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--no-update-dataset":
        options.noUpdateDataset = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!options.manifest) throw new Error("--manifest is required");
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

async function readJsonFile<T>(file: string): Promise<T> {
  return JSON.parse(await fs.readFile(resolvePath(file), "utf8")) as T;
}

function manifestEntries(manifest: Manifest): ManifestEntry[] {
  return Array.isArray(manifest) ? manifest : manifest.entries ?? [];
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extensionFromUrl(url: string): string {
  const pathname = new URL(url).pathname.toLowerCase();
  const ext = path.extname(pathname);
  return [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext) ? ext : ".png";
}

function publicImagePath(outDir: string, fileName: string): string {
  const publicRoot = repoPath("apps", "web", "public");
  const relative = path.relative(publicRoot, path.join(outDir, fileName));
  if (relative.startsWith("..")) {
    throw new Error("--out-dir must be inside apps/web/public");
  }
  return `/${relative.split(path.sep).map(encodeURIComponent).join("/")}`;
}

function defaultOutDir(options: CliOptions): string {
  if (options.outDir) return resolvePath(options.outDir);
  if (!options.gameName || !options.collectionName) {
    throw new Error("Pass --out-dir or both --game-name and --collection-name");
  }
  return repoPath("apps", "web", "public", options.gameName, options.collectionName);
}

async function download(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 Bloxodes collection image collector"
    }
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function getDatasetRows(document: unknown): Record<string, unknown>[] {
  if (Array.isArray(document)) return document as Record<string, unknown>[];
  if (!document || typeof document !== "object") return [];
  const record = document as { items?: Record<string, unknown>[]; data?: Record<string, unknown>[] };
  return record.items ?? record.data ?? [];
}

function isV2Dataset(document: unknown): boolean {
  if (!document || typeof document !== "object" || Array.isArray(document)) return false;
  const meta = (document as { meta?: unknown }).meta;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return false;
  return (meta as { schemaVersion?: unknown }).schemaVersion === 2;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

async function updateDatasetImages(datasetPath: string, updates: Map<string, string>, dryRun: boolean) {
  const resolved = resolvePath(datasetPath);
  const document = await readJsonFile<unknown>(resolved);
  const rows = getDatasetRows(document);
  const v2 = isV2Dataset(document);
  let changed = 0;

  for (const row of rows) {
    const item = v2 ? asRecord(row.item) : row;
    const system = v2 ? asRecord(row.system) : null;
    const name = item && typeof item.name === "string" ? item.name : null;
    if (!name) continue;
    const nextImage = updates.get(name) ?? updates.get(slugify(name));
    if (!nextImage) continue;

    if (v2) {
      if (!system || system.image === nextImage) continue;
      system.image = nextImage;
    } else if (row.image !== nextImage) {
      row.image = nextImage;
    } else {
      continue;
    }

    if (v2 || row.image === nextImage) {
      changed += 1;
    }
  }

  if (!dryRun && changed) {
    await fs.writeFile(resolved, `${JSON.stringify(document, null, 2)}\n`);
  }

  return changed;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifest = await readJsonFile<Manifest>(options.manifest!);
  const entries = manifestEntries(manifest);
  if (!entries.length) throw new Error("Manifest has no entries");

  const outDir = defaultOutDir(options);
  const updates = new Map<string, string>();
  if (!options.dryRun) await fs.mkdir(outDir, { recursive: true });

  for (const entry of entries) {
    if (!entry.name || !entry.url) throw new Error("Each manifest entry needs name and url");
    const fileName = entry.fileName ?? `${slugify(entry.name)}${extensionFromUrl(entry.url)}`;
    const target = path.join(outDir, fileName);
    const publicPath = publicImagePath(outDir, fileName);
    console.log(`${options.dryRun ? "Would download" : "Downloading"} ${entry.name} -> ${publicPath}`);
    if (!options.dryRun) {
      const bytes = await download(entry.url);
      await fs.writeFile(target, bytes);
    }
    updates.set(entry.name, publicPath);
    updates.set(slugify(entry.name), publicPath);
  }

  if (options.dataset && !options.noUpdateDataset) {
    const changed = await updateDatasetImages(options.dataset, updates, options.dryRun);
    console.log(`${options.dryRun ? "Would update" : "Updated"} ${changed} dataset image field(s).`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
