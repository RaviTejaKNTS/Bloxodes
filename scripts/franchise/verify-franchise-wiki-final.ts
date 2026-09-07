import "../shared/load-env";

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { validateWikiControlsJson } from "../shared/wiki-controls";
import { isManagedDevelopmentSupabaseUrl } from "../shared/supabase-target";

type Namespace = "gta" | "red-dead";
type Config = { label: string; routePrefix: string; tablePrefix: string };
const CONFIGS: Record<Namespace, Config> = {
  gta: { label: "GTA", routePrefix: "/gta/wiki", tablePrefix: "gta" },
  "red-dead": { label: "Red Dead", routePrefix: "/red-dead/wiki", tablePrefix: "red_dead" }
};

type GameInput = {
  slug: string;
  title: string;
  short_title?: string | null;
  installment?: string | null;
  content_kind?: "game" | "expansion" | "online";
  parent_slug?: string | null;
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

const argv = process.argv.slice(2);

function flag(name: string): string {
  const index = argv.indexOf(name);
  return index === -1 ? "" : (argv[index + 1] ?? "").trim();
}

function required(name: string): string {
  const result = flag(name);
  if (!result) throw new Error(`${name} is required.`);
  return result;
}

if (argv.includes("--help") || argv.includes("-h")) {
  console.log("Usage: npm run verify:franchise-wiki-final -- --namespace <gta|red-dead> --base-url <url> --game <slug> --workspace <dir>");
  process.exit(0);
}

const namespace = required("--namespace") as Namespace;
if (!(namespace in CONFIGS)) throw new Error("--namespace must be gta or red-dead.");
const config = CONFIGS[namespace];
const baseUrl = new URL(required("--base-url")).toString().replace(/\/$/, "");
const gameSlug = required("--game").toLowerCase();
const workspace = path.resolve(required("--workspace"));

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function tableName(suffix: string): string {
  return `${config.tablePrefix}_${suffix}`;
}

async function run(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), env: process.env, shell: false, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}

async function saveGame(game: GameInput): Promise<string> {
  const sb = supabaseAdmin();
  const slug = game.slug.trim().toLowerCase();
  const payload: Record<string, unknown> = {
    slug,
    title: game.title,
    short_title: game.short_title ?? null,
    installment: game.installment ?? null,
    developer: game.developer ?? null,
    publisher: game.publisher ?? null,
    description_md: game.description_md ?? null,
    cover_image: game.cover_image ?? null,
    hero_image: game.hero_image ?? null,
    official_url: game.official_url ?? null,
    release_dates_json: game.release_dates_json ?? {},
    platforms_json: game.platforms_json ?? [],
    status: game.status ?? "released",
    is_published: game.is_published ?? true
  };
  if (namespace === "red-dead") {
    payload.content_kind = game.content_kind ?? "game";
    if (game.parent_slug?.trim()) {
      const parent = await sb.from(tableName("games")).select("id").eq("slug", game.parent_slug.trim().toLowerCase()).eq("is_published", true).maybeSingle();
      if (parent.error) throw parent.error;
      if (!parent.data) throw new Error(`Parent Red Dead title ${game.parent_slug} must be published before ${slug}.`);
      payload.parent_game_id = parent.data.id;
    } else {
      payload.parent_game_id = null;
    }
  }
  const existing = await sb.from(tableName("games")).select("id").eq("slug", slug).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data?.id) {
    const updated = await sb.from(tableName("games")).update(payload).eq("id", existing.data.id).select("id").single();
    if (updated.error) throw updated.error;
    return updated.data.id;
  }
  const inserted = await sb.from(tableName("games")).insert(payload).select("id").single();
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
  const existing = await sb.from(tableName("wiki_pages")).select("id").eq("slug", slug).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data?.id) {
    const updated = await sb.from(tableName("wiki_pages")).update(payload).eq("id", existing.data.id).select("id").single();
    if (updated.error) throw updated.error;
    return updated.data.id;
  }
  const inserted = await sb.from(tableName("wiki_pages")).insert(payload).select("id").single();
  if (inserted.error) throw inserted.error;
  return inserted.data.id;
}

async function main() {
  if (!isManagedDevelopmentSupabaseUrl(process.env.SUPABASE_URL)) {
    throw new Error(`${config.label} wiki verification writes only to managed development.`);
  }
  const gameFile = path.join(workspace, "game.json");
  const finalFile = path.join(workspace, "final.json");
  const [game, wiki] = await Promise.all([readJson<GameInput>(gameFile), readJson<WikiInput>(finalFile)]);
  if (game.slug !== gameSlug || wiki.game_slug !== gameSlug || wiki.slug !== gameSlug) {
    throw new Error(`Workspace identity does not match ${gameSlug}.`);
  }
  if (!game.title.trim() || !wiki.title.trim() || !wiki.description_md?.trim()) {
    throw new Error("game.json and final.json require titles; final.json also requires description_md.");
  }
  validateWikiControlsJson(wiki.controls_json ?? [], `${config.label} final.json controls_json`);
  await run("npm", ["run", "content:check-copy", "--", finalFile]);
  const gameId = await saveGame(game);
  const wikiId = await saveWiki(gameId, wiki);
  const readback = await supabaseAdmin()
    .from(tableName("wiki_pages_view"))
    .select("id, slug, title, game_id, game_title, is_published")
    .eq("id", wikiId)
    .single();
  if (readback.error) throw readback.error;
  if (!readback.data.is_published || readback.data.game_id !== gameId || readback.data.title !== wiki.title) {
    throw new Error(`Managed-development readback failed for ${gameSlug}.`);
  }
  const url = `${baseUrl}${config.routePrefix}/${gameSlug}`;
  const response = await fetch(url, { redirect: "follow" });
  const html = await response.text();
  if (response.status !== 200 || !html.includes(wiki.title)) throw new Error(`${url} did not render ${wiki.title} (HTTP ${response.status}).`);
  console.log(`Verified ${config.label} wiki: ${url}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
