import "../shared/load-env";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { isManagedDevelopmentSupabaseUrl, isProductionSupabaseUrl } from "../shared/supabase-target";
import { validateWikiControlsJson } from "../shared/wiki-controls";

type Options = { workspaces: string[]; apply: boolean; allowProd: boolean };
type GameInput = {
  slug: string;
  title: string;
  short_title?: string | null;
  installment?: string | null;
  developer?: string | null;
  publisher?: string | null;
  description_md?: string | null;
  cover_image?: string | null;
  hero_image?: string | null;
  official_url?: string | null;
  release_dates_json?: Record<string, unknown>;
  platforms_json?: unknown[];
  status?: "announced" | "upcoming" | "released";
  is_published?: boolean;
};
type WikiInput = {
  game_slug: string;
  slug: string;
  title: string;
  seo_title?: string | null;
  meta_description?: string | null;
  description_md?: string | null;
  cover_image?: string | null;
  controls_json?: unknown;
  tips_md?: string | null;
  is_published?: boolean;
};
type PlannedWiki = { workspace: string; game: GameInput; wiki: WikiInput };

function parseArgs(argv: string[]): Options {
  const workspaces: string[] = [];
  let apply = false;
  let allowProd = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--workspace") workspaces.push(path.resolve(argv[++index] ?? ""));
    else if (arg.startsWith("--workspace=")) workspaces.push(path.resolve(arg.slice("--workspace=".length)));
    else if (arg === "--apply") apply = true;
    else if (arg === "--allow-prod") allowProd = true;
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: npm run sync:gta-wiki-runtime -- --workspace <wiki-workspace> [--workspace <wiki-workspace> ...] [--apply] [--allow-prod]");
      process.exit(0);
    } else throw new Error(`Unknown option: ${arg}`);
  }
  const unique = [...new Set(workspaces.filter(Boolean))];
  if (!unique.length) throw new Error("At least one --workspace is required.");
  return { workspaces: unique, apply, allowProd };
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function requiredImageUrl(value: string | null | undefined, label: string): string {
  const resolved = value?.trim() ?? "";
  if (!resolved) throw new Error(`${label} is required.`);
  const url = new URL(resolved);
  if (url.protocol !== "https:") throw new Error(`${label} must be an HTTPS URL.`);
  return resolved;
}

async function planWorkspace(workspace: string): Promise<PlannedWiki> {
  const [game, wiki] = await Promise.all([
    readJson<GameInput>(path.join(workspace, "game.json")),
    readJson<WikiInput>(path.join(workspace, "final.json"))
  ]);
  const slug = game.slug?.trim().toLowerCase();
  if (!slug || wiki.game_slug !== slug || wiki.slug !== slug) {
    throw new Error(`Workspace identity does not match in ${workspace}.`);
  }
  if (!game.title?.trim() || !wiki.title?.trim() || !wiki.description_md?.trim()) {
    throw new Error(`${slug} requires game/wiki titles and wiki description_md.`);
  }
  const coverImage = requiredImageUrl(game.cover_image, `${slug} cover_image`);
  const heroImage = requiredImageUrl(game.hero_image, `${slug} hero_image`);
  if (coverImage === heroImage) throw new Error(`${slug} cover_image and hero_image must be distinct.`);
  validateWikiControlsJson(wiki.controls_json ?? [], `${slug} controls_json`);
  return {
    workspace,
    game: { ...game, slug, cover_image: coverImage, hero_image: heroImage },
    wiki: { ...wiki, game_slug: slug, slug }
  };
}

async function saveGame(game: GameInput): Promise<string> {
  const sb = supabaseAdmin();
  const payload = {
    ...game,
    slug: game.slug.trim().toLowerCase(),
    release_dates_json: game.release_dates_json ?? {},
    platforms_json: game.platforms_json ?? [],
    status: game.status ?? "released",
    is_published: game.is_published ?? true
  };
  const existing = await sb.from("gta_games").select("id").eq("slug", payload.slug).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data?.id) {
    const updated = await sb.from("gta_games").update(payload).eq("id", existing.data.id).select("id").single();
    if (updated.error) throw updated.error;
    return updated.data.id;
  }
  const inserted = await sb.from("gta_games").insert(payload).select("id").single();
  if (inserted.error) throw inserted.error;
  return inserted.data.id;
}

async function saveWiki(gameId: string, wiki: WikiInput): Promise<string> {
  const sb = supabaseAdmin();
  const payload = {
    game_id: gameId,
    slug: wiki.slug.trim().toLowerCase(),
    title: wiki.title,
    seo_title: wiki.seo_title ?? null,
    meta_description: wiki.meta_description ?? null,
    description_md: wiki.description_md ?? null,
    cover_image: wiki.cover_image ?? null,
    controls_json: wiki.controls_json ?? [],
    tips_md: wiki.tips_md ?? null,
    is_published: wiki.is_published ?? true
  };
  const existing = await sb.from("gta_wiki_pages").select("id").eq("slug", payload.slug).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data?.id) {
    const updated = await sb.from("gta_wiki_pages").update(payload).eq("id", existing.data.id).select("id").single();
    if (updated.error) throw updated.error;
    return updated.data.id;
  }
  const inserted = await sb.from("gta_wiki_pages").insert(payload).select("id").single();
  if (inserted.error) throw inserted.error;
  return inserted.data.id;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const managed = isManagedDevelopmentSupabaseUrl(process.env.SUPABASE_URL);
  const production = isProductionSupabaseUrl(process.env.SUPABASE_URL);
  if (!managed && !production) throw new Error("Unrecognized Supabase target.");
  if (options.allowProd && (!options.apply || !production)) {
    throw new Error("--allow-prod requires --apply and the recognized production target.");
  }
  if (options.apply && production && !options.allowProd) {
    throw new Error("Production GTA wiki writes require --allow-prod.");
  }

  const plans = await Promise.all(options.workspaces.map(planWorkspace));
  const slugs = plans.map((plan) => plan.game.slug);
  if (new Set(slugs).size !== slugs.length) throw new Error("Duplicate GTA wiki slug in release input.");
  console.log(`Planned ${plans.length} GTA wiki hubs for ${production ? "production" : "managed development"}: ${slugs.join(", ")}`);
  if (!options.apply) {
    console.log("Dry run complete; no database rows were changed.");
    return;
  }

  for (const plan of plans) {
    const gameId = await saveGame(plan.game);
    await saveWiki(gameId, plan.wiki);
  }
  const readback = await supabaseAdmin()
    .from("gta_wiki_pages_view")
    .select("slug,is_published,game_cover_image,game_hero_image")
    .in("slug", slugs);
  if (readback.error) throw readback.error;
  if (readback.data.length !== plans.length) throw new Error("GTA wiki readback count mismatch.");
  for (const row of readback.data) {
    if (!row.is_published) throw new Error(`${row.slug} was not published.`);
    const cover = requiredImageUrl(row.game_cover_image, `${row.slug} readback cover`);
    const hero = requiredImageUrl(row.game_hero_image, `${row.slug} readback hero`);
    if (cover === hero) throw new Error(`${row.slug} readback image roles are not distinct.`);
  }
  console.log(`Applied and verified ${plans.length} GTA wiki hubs.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
