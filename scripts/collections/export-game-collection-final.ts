import "../shared/load-env";

import fs from "node:fs/promises";
import path from "node:path";

import { getGameCollectionConfigByWikiPath } from "@/lib/game-collections";
import { repoPath } from "@/lib/paths";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isManagedDevelopmentSupabaseUrl } from "../shared/supabase-target";

type CliOptions = {
  game: string | null;
  collection: string | null;
  outputRoot: string | null;
  allowRemoteRead: boolean;
  force: boolean;
  dryRun: boolean;
};

type CollectionPageRow = {
  universe_id?: number | null;
  wiki_slug: string;
  collection_slug: string;
  code: string;
  display_name?: string | null;
  title?: string | null;
  seo_title?: string | null;
  meta_description?: string | null;
  intro_md?: string | null;
  description_md?: string | null;
  how_it_works_md?: string | null;
  description_json?: Record<string, string> | null;
  faq_json?: Array<{ q: string; a: string }> | null;
  wiki_md?: string | null;
  is_published?: boolean | null;
  item_count?: number | null;
};

function printUsage() {
  console.log(`Usage:
  npm run export:game-collection-final -- --game <game-slug> --collection <collection-slug> --output-root <directory> [options]

Options:
  --allow-remote-read   Allow an intentional read-only export outside managed development.
  --force               Replace an existing final.json.
  --dry-run             Print the final JSON without writing a file.
  -h, --help            Show this help.

This helper reads one wiki_collection_pages row and writes no database data.
`);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    game: null,
    collection: null,
    outputRoot: null,
    allowRemoteRead: false,
    force: false,
    dryRun: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "-h":
      case "--help":
        printUsage();
        process.exit(0);
      case "--game":
      case "--game-slug":
        options.game = requireValue(argv, ++index, arg).toLowerCase();
        break;
      case "--collection":
      case "--collection-slug":
        options.collection = requireValue(argv, ++index, arg).toLowerCase();
        break;
      case "--output-root":
      case "--final-json-root":
        options.outputRoot = requireValue(argv, ++index, arg);
        break;
      case "--allow-remote-read":
        options.allowRemoteRead = true;
        break;
      case "--force":
        options.force = true;
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
  if (!options.dryRun && !options.outputRoot) throw new Error("--output-root is required unless --dry-run is used");
  return options;
}

function requireValue(argv: string[], index: number, option: string): string {
  const value = argv[index]?.trim();
  if (!value) throw new Error(`Missing value for ${option}`);
  return value;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function restoreCountToken(value: string | null | undefined, itemCount: number | null | undefined): string {
  const text = value?.trim() ?? "";
  if (!text || /\{\s*(?:count|item_count)\s*\}/i.test(text) || !itemCount) return text;
  const labels = Array.from(new Set([itemCount.toLocaleString("en-US"), String(itemCount)]));
  for (const label of labels) {
    const pattern = new RegExp(`\\bAll\\s+${escapeRegExp(label)}(?=\\D|$)`, "i");
    if (pattern.test(text)) {
      return text.replace(pattern, (match) => match.replace(label, "{count}"));
    }
  }
  return text;
}

async function pathExists(target: string) {
  try {
    return (await fs.stat(target)).isFile();
  } catch {
    return false;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = getGameCollectionConfigByWikiPath(options.game!, options.collection!);
  if (!config) throw new Error(`No registered collection config for ${options.game}/${options.collection}`);

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE;
  if (!supabaseUrl || !serviceRole) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE");
  if (!isManagedDevelopmentSupabaseUrl(supabaseUrl) && !options.allowRemoteRead) {
    throw new Error("Refusing a read outside managed development. Pass --allow-remote-read for an intentional remote export.");
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("wiki_collection_pages")
    .select(
      "universe_id,wiki_slug,collection_slug,code,display_name,title,seo_title,meta_description,intro_md,description_md,how_it_works_md,description_json,faq_json,wiki_md,is_published,item_count"
    )
    .eq("wiki_slug", options.game!)
    .eq("collection_slug", options.collection!)
    .maybeSingle();
  if (error) throw new Error(`Failed to read collection page: ${error.message}`);
  if (!data) throw new Error(`No wiki_collection_pages row found for ${options.game}/${options.collection}`);

  const row = data as CollectionPageRow;
  const finalJson = {
    universe_id: row.universe_id ?? 0,
    wiki_slug: row.wiki_slug,
    collection_slug: row.collection_slug,
    code: row.code,
    display_name: row.display_name ?? config.label,
    title: restoreCountToken(row.title, row.item_count),
    seo_title: restoreCountToken(row.seo_title, row.item_count),
    meta_description: row.meta_description ?? "",
    intro_md: row.intro_md ?? "",
    description_md: row.description_md ?? "",
    how_it_works_md: row.how_it_works_md ?? "",
    description_json: row.description_json ?? {},
    faq_json: row.faq_json ?? [],
    wiki_md: row.wiki_md ?? "",
    is_published: row.is_published ?? true
  };
  const serialized = `${JSON.stringify(finalJson, null, 2)}\n`;

  if (options.dryRun) {
    process.stdout.write(serialized);
    return;
  }

  const root = path.isAbsolute(options.outputRoot!) ? options.outputRoot! : repoPath(options.outputRoot!);
  const target = path.join(root, options.collection!, "final.json");
  if ((await pathExists(target)) && !options.force) {
    throw new Error(`Refusing to overwrite existing file: ${target}. Pass --force only after reviewing it.`);
  }
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, serialized);
  console.log(`Exported read-only page snapshot: ${target}`);
  if (row.item_count && !finalJson.title.includes("{count}")) {
    console.log("Warning: title did not contain the stored item count; review the title token before verification.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
