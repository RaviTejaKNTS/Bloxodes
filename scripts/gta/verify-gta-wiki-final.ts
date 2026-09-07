import "../shared/load-env";

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { validateWikiControlsJson } from "../shared/wiki-controls";
import { isManagedDevelopmentSupabaseUrl } from "../shared/supabase-target";

type Options = { baseUrl: string; game: string; workspace: string };
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

function parseArgs(argv: string[]): Options {
  let baseUrl = "";
  let game = "";
  let workspace = "";
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--base-url") baseUrl = argv[++index] ?? "";
    else if (arg === "--game" || arg === "--game-slug") game = (argv[++index] ?? "").trim().toLowerCase();
    else if (arg === "--workspace") workspace = argv[++index] ?? "";
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: npm run verify:gta-wiki-final -- --base-url http://localhost:3000 --game gta-5 --workspace tmp/content-workspace/gta/gta-5/wiki/gta-5");
      process.exit(0);
    } else throw new Error(`Unknown option: ${arg}`);
  }
  if (!baseUrl || !game || !workspace) throw new Error("--base-url, --game, and --workspace are required.");
  return { baseUrl: new URL(baseUrl).toString().replace(/\/$/, ""), game, workspace: path.resolve(workspace) };
}

async function run(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), env: process.env, shell: false, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function saveGame(game: GameInput): Promise<string> {
  const sb = supabaseAdmin();
  const slug = game.slug.trim().toLowerCase();
  const payload = {
    ...game,
    slug,
    release_dates_json: game.release_dates_json ?? {},
    platforms_json: game.platforms_json ?? [],
    status: game.status ?? "released",
    is_published: game.is_published ?? true
  };
  const existing = await sb.from("gta_games").select("id").eq("slug", slug).maybeSingle();
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
  const slug = wiki.slug.trim().toLowerCase();
  const payload = {
    game_id: gameId,
    slug,
    title: wiki.title,
    seo_title: wiki.seo_title ?? null,
    meta_description: wiki.meta_description ?? null,
    description_md: wiki.description_md ?? null,
    cover_image: wiki.cover_image ?? null,
    controls_json: wiki.controls_json ?? [],
    tips_md: wiki.tips_md ?? null,
    is_published: wiki.is_published ?? true
  };
  const existing = await sb.from("gta_wiki_pages").select("id").eq("slug", slug).maybeSingle();
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
  if (!isManagedDevelopmentSupabaseUrl(process.env.SUPABASE_URL)) {
    throw new Error("GTA wiki verification writes only to managed development.");
  }
  const gameFile = path.join(options.workspace, "game.json");
  const finalFile = path.join(options.workspace, "final.json");
  const [game, wiki] = await Promise.all([readJson<GameInput>(gameFile), readJson<WikiInput>(finalFile)]);
  if (game.slug !== options.game || wiki.game_slug !== options.game || wiki.slug !== options.game) {
    throw new Error(`Workspace identity does not match ${options.game}.`);
  }
  if (!game.title.trim() || !wiki.title.trim() || !wiki.description_md?.trim()) {
    throw new Error("game.json and final.json require titles; final.json also requires description_md.");
  }
  const coverImage = game.cover_image?.trim() ?? "";
  const heroImage = game.hero_image?.trim() ?? "";
  if (!coverImage || !heroImage) {
    throw new Error("GTA game.json requires both cover_image and hero_image for a released wiki hub.");
  }
  if (coverImage === heroImage) {
    throw new Error("GTA game.json cover_image and hero_image must be separate image URLs.");
  }
  validateWikiControlsJson(wiki.controls_json ?? [], "GTA final.json controls_json");
  await run("npm", ["run", "content:check-copy", "--", finalFile]);
  const gameId = await saveGame(game);
  const wikiId = await saveWiki(gameId, wiki);
  const readback = await supabaseAdmin()
    .from("gta_wiki_pages_view")
    .select("id, slug, title, game_id, game_title, is_published")
    .eq("id", wikiId)
    .single();
  if (readback.error) throw readback.error;
  if (!readback.data.is_published || readback.data.game_id !== gameId || readback.data.title !== wiki.title) {
    throw new Error(`Managed-development readback failed for ${options.game}.`);
  }
  const url = `${options.baseUrl}/gta/wiki/${options.game}`;
  const response = await fetch(url, { redirect: "follow" });
  const html = await response.text();
  if (response.status !== 200 || !html.includes(wiki.title)) {
    throw new Error(`${url} did not render ${wiki.title} (HTTP ${response.status}).`);
  }
  console.log(`Verified GTA wiki: ${url}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
