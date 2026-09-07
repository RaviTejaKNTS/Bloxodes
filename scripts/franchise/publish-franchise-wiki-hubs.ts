import "../shared/load-env";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isManagedDevelopmentSupabaseUrl, isProductionSupabaseUrl } from "../shared/supabase-target";

const args = process.argv.slice(2);
const value = (key: string) => args[args.indexOf(key) + 1];
const apply = args.includes("--apply");
const allowProd = args.includes("--allow-prod");
const slugs = args.flatMap((arg, i) => arg === "--game" ? [args[i + 1]] : []);
const gameFields = ["slug", "title", "short_title", "installment", "content_kind", "developer", "publisher", "description_md", "cover_image", "hero_image", "official_url", "release_dates_json", "platforms_json", "status", "is_published"];
const wikiFields = ["slug", "title", "seo_title", "meta_description", "description_md", "cover_image", "controls_json", "tips_md", "is_published"];
const pick = (row: Record<string, unknown>, fields: string[]) => Object.fromEntries(fields.filter(key => row[key] !== undefined).map(key => [key, row[key]]));

async function main() {
  if (args.includes("--help")) {
    console.log("Usage: npm run publish:franchise-wiki-hubs -- --namespace red-dead --workspace <root> --game <slug> [--game <slug>] [--apply --allow-prod]");
    return;
  }
  if (value("--namespace") !== "red-dead" || !args.includes("--workspace") || !slugs.length || slugs.some(s => !/^[a-z0-9-]+$/.test(s))) throw new Error("Explicit namespace, workspace and game allowlist required.");
  const production = isProductionSupabaseUrl(process.env.SUPABASE_URL);
  if (!production && !isManagedDevelopmentSupabaseUrl(process.env.SUPABASE_URL)) throw new Error("Unrecognized database target.");
  if (apply && production && !allowProd) throw new Error("Production writes require --allow-prod.");
  if (allowProd && !production) throw new Error("--allow-prod requires the production target.");
  const sb = supabaseAdmin();
  const plans = [];
  for (const slug of [...new Set(slugs)]) {
    const dir = path.resolve(value("--workspace"), slug, "wiki", slug);
    const game = JSON.parse(await readFile(path.join(dir, "game.json"), "utf8"));
    const wiki = JSON.parse(await readFile(path.join(dir, "final.json"), "utf8"));
    if (game.slug !== slug || wiki.slug !== slug || wiki.game_slug !== slug || game.is_published !== true || wiki.is_published !== true) throw new Error(`Unapproved or mismatched hub ${slug}`);
    if (!game.cover_image || !game.hero_image || game.cover_image === game.hero_image) throw new Error(`Separate hosted media required for ${slug}`);
    for (const url of [game.cover_image, game.hero_image]) {
      if (!url.startsWith(`https://media.bloxodes.com/wiki/red-dead/${slug}/`)) throw new Error(`Unapproved media URL for ${slug}`);
      const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(30000) });
      if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) throw new Error(`Unavailable image for ${slug}`);
    }
    plans.push({ slug, game, wiki });
  }
  // Read all exact target rows before the first mutation.
  const existing = await sb.from("red_dead_games").select("id,slug").in("slug", slugs);
  if (existing.error) throw existing.error;
  console.log(`${apply ? "Apply" : "Dry run"}: ${plans.length} Red Dead hubs; ${existing.data.length} existing games; target=${production ? "production" : "managed-development"}`);
  if (!apply) return;
  const ids = new Map<string, string>();
  for (const { slug, game } of plans) {
    const current = existing.data.find(row => row.slug === slug);
    const payload = pick(game, gameFields);
    const result = current
      ? await sb.from("red_dead_games").update(payload).eq("id", current.id).select("id").single()
      : await sb.from("red_dead_games").insert(payload).select("id").single();
    if (result.error) throw result.error;
    ids.set(slug, result.data.id);
  }
  for (const { slug, game, wiki } of plans) {
    const id = ids.get(slug)!;
    if (game.parent_slug) {
      const parent = await sb.from("red_dead_games").select("id").eq("slug", game.parent_slug).single();
      if (parent.error) throw parent.error;
      const linked = await sb.from("red_dead_games").update({ parent_game_id: parent.data.id }).eq("id", id);
      if (linked.error) throw linked.error;
    }
    const result = await sb.from("red_dead_wiki_pages").upsert({ ...pick(wiki, wikiFields), game_id: id }, { onConflict: "game_id" }).select("slug,is_published").single();
    if (result.error || result.data?.slug !== slug || !result.data.is_published) throw result.error ?? new Error(`Hub readback failed for ${slug}`);
    console.log(`Published ${slug}`);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
