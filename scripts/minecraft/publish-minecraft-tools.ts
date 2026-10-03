import "../shared/load-env";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isManagedDevelopmentSupabaseUrl, isProductionSupabaseUrl } from "../shared/supabase-target";
import { validateMinecraftToolRules } from "@/lib/minecraft-tools/validate";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const allowProd = args.includes("--allow-prod");
const files = args.flatMap((arg, index) => arg === "--final" ? [args[index + 1]] : []).filter(Boolean);
const fields = ["slug", "title", "seo_title", "meta_description", "intro_md", "how_it_works_md", "description_md", "description_json", "faq_json", "schema_ld_json", "thumb_url", "tool_key", "rules_json", "is_published"];
async function main() {
  if (args.includes("--help")) { console.log("Usage: publish:minecraft-tools -- --final <final.json> [--final <final.json>] [--apply] [--allow-prod]"); return; }
  if (!files.length) throw new Error("At least one exact --final file is required.");
  const production = isProductionSupabaseUrl(process.env.SUPABASE_URL);
  if (!production && !isManagedDevelopmentSupabaseUrl(process.env.SUPABASE_URL)) throw new Error("Unrecognized database target.");
  if (apply && production && !allowProd) throw new Error("Production writes require --allow-prod.");
  if (allowProd && (!apply || !production)) throw new Error("--allow-prod requires production with --apply.");
  const plans: Record<string, unknown>[] = [];
  for (const file of files) {
    const data = JSON.parse(await readFile(path.resolve(file), "utf8")) as Record<string, unknown>;
    const slug = data.slug ?? data.code;
    if (typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`${file} has an invalid slug.`);
    if (data.namespace && data.namespace !== "minecraft") throw new Error(`${file} is not a Minecraft tool.`);
    if (data.universe_id != null) throw new Error(`${file} must not use a Roblox universe.`);
    const toolKey = data.tool_key ?? slug;
    if (toolKey !== slug) throw new Error(`${file} tool_key must match its route slug.`);
    validateMinecraftToolRules(toolKey, data.rules_json);
    for (const key of ["title", "meta_description", "intro_md", "how_it_works_md"]) {
      if (typeof data[key] !== "string" || !data[key].trim()) throw new Error(`${file} needs ${key}.`);
    }
    if (!data.description_json || typeof data.description_json !== "object" || Array.isArray(data.description_json) || !Array.isArray(data.faq_json)) throw new Error(`${file} needs description_json and faq_json.`);
    const plan = Object.fromEntries(fields.filter(key => data[key] !== undefined).map(key => [key, data[key]]));
    plans.push({ ...plan, slug, tool_key: data.tool_key ?? slug, is_published: data.is_published === true });
  }
  if (new Set(plans.map(row => row.slug)).size !== plans.length) throw new Error("Duplicate tool slugs in the exact publication batch.");
  console.table(plans.map(row => ({ slug: row.slug, published: row.is_published, target: production ? "production" : "managed-development" })));
  if (!apply) return;
  const sb = supabaseAdmin();
  for (const plan of plans) {
    const existing = await sb.from("minecraft_tools").select("*").eq("slug", plan.slug).maybeSingle();
    if (existing.error) throw existing.error;
    const unchanged = existing.data && Object.entries(plan).every(([key, value]) => isDeepStrictEqual(existing.data[key], value));
    if (unchanged) continue;
    const result = await sb.from("minecraft_tools").upsert(plan, { onConflict: "slug" }).select("slug,title,is_published").single();
    if (result.error) throw result.error;
    if (result.data.slug !== plan.slug || result.data.title !== plan.title || result.data.is_published !== plan.is_published) throw new Error(`Tool publication readback failed for ${plan.slug}.`);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
