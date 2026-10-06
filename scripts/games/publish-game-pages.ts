import "../shared/load-env";
import { reservedGameNamespaces } from "../../apps/web/src/lib/game-route-names";
import { parseGameMapData, parseGameQuizData, parseGameCatalogData } from "../../apps/web/src/lib/game-page-data";
import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { assertManagedDevelopmentSupabaseUrl } from "../shared/supabase-target";

const validSlug = (value: unknown) => typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const validId = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
const argv = process.argv.slice(2);
function option(flag: string) { const index = argv.indexOf(flag); return index < 0 ? "" : argv[index + 1] ?? ""; }
async function main() {
 const namespace = option("--namespace");
 const file = option("--file");
 if (argv.includes("--help")) { console.log("Usage: npm run publish:game-pages -- --namespace <game> --file <reviewed.json> [--apply]. Development only; dry run by default."); return; }
 if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(namespace) || reservedGameNamespaces.has(namespace) || !file) throw new Error("Provide a non-Roblox namespace and reviewed JSON file.");
 assertManagedDevelopmentSupabaseUrl(process.env.SUPABASE_URL, "game page publication");
 if (new URL(process.env.SUPABASE_URL!).hostname !== "bbtcaurrtyoukvjbxbbj.supabase.co") throw new Error("Unexpected development project");
 const payload = JSON.parse(await fs.readFile(file, "utf8")) as Record<string, Array<Record<string, unknown>>>;
 const contract = { games: { table: "games", conflict: "namespace,slug,kind" }, wiki: { table: "game_wiki_pages", conflict: "game_id" }, codesPages: { table: "game_code_pages", conflict: "game_id" }, tools: { table: "game_tool_pages", conflict: "namespace,slug" }, maps: { table: "game_map_pages", conflict:"namespace,slug" }, quizzes:{table:"game_quiz_pages",conflict:"namespace,slug"}, catalog:{table:"game_catalog_pages",conflict:"namespace,slug"}, checklists:{table:"game_checklist_pages",conflict:"namespace,slug"}, checklistItems:{table:"game_checklist_items",conflict:"page_id,item_key"}, codes: { table: "game_codes", conflict: "code_page_id,code" } } as const;
 if (!Object.keys(payload).length || Object.keys(payload).some(key => !(key in contract))) throw new Error("Supported groups: games, wiki, codesPages, tools, maps, quizzes, catalog, checklists, checklistItems, codes.");
 const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!, { auth: { persistSession: false } });
 const validated = new Map<keyof typeof contract, Array<Record<string, unknown>>>();
 for (const key of Object.keys(contract) as Array<keyof typeof contract>) {
  const rows = payload[key];
  if (!rows) continue;
  if (!Array.isArray(rows) || !rows.length) throw new Error(`Invalid ${key} rows`);
  const prepared = [];
  for (const row of rows) {
   if (!row || typeof row !== "object" || Array.isArray(row) || row.namespace !== undefined && row.namespace !== namespace) throw new Error("Cross-game write rejected");
   if (row.id !== undefined && !validId(row.id)) throw new Error("Invalid reviewed row ID");
   if (row.is_published !== undefined && typeof row.is_published !== "boolean") throw new Error("Publication state must be boolean");
   if (key === "games") {
    if (!validId(row.id)) throw new Error("Games need an explicit reviewed UUID");
    if (row.parent_id != null && !validId(row.parent_id)) throw new Error("Invalid parent game ID");
    if (!["franchise", "game"].includes(String(row.kind)) || typeof row.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug) || typeof row.title !== "string" || !row.title.trim()) throw new Error("Games need a title, slug and franchise/game kind.");
    if (!row.parent_id && row.slug !== namespace) throw new Error("Root game slug must match its namespace.");
    if (row.kind === "franchise" && (row.slug !== namespace || row.parent_id)) throw new Error("Franchise root must use its namespace slug and no parent.");
   } else if (key === "checklistItems") {
    if (!validId(row.page_id) || !validSlug(row.item_key) || typeof row.section_code !== "string" || !/^[0-9]+(?:\.[0-9]+){0,2}$/.test(row.section_code) || typeof row.title !== "string" || !row.title.trim()) throw new Error("Checklist tasks need an owned page, stable item key, numeric section code and title.");
    if (!payload.checklists?.some(page=>page.id===row.page_id)) {
     const {data,error}=await sb.from("game_checklist_pages").select("namespace").eq("id",row.page_id).single();
     if(error || data.namespace!==namespace) throw new Error("Checklist page ownership mismatch");
    }
   } else if (key === "codes") {
    if (!validId(row.code_page_id)) throw new Error("Codes need an owned page UUID");
    if (!["active", "expired", "check"].includes(String(row.status)) || typeof row.code !== "string" || !row.code.trim() || typeof row.source_url !== "string" || !row.source_url.startsWith("https://") || typeof row.verified_at !== "string" || !Number.isFinite(Date.parse(row.verified_at))) throw new Error("Codes need a verified source URL, date and status.");
    if (!payload.codesPages?.some(page => page.id === row.code_page_id)) {
     const { data, error } = await sb.from("game_code_pages").select("namespace").eq("id", row.code_page_id).single();
     if (error || data.namespace !== namespace) throw new Error("Code page ownership mismatch");
    }
   } else {
    if (!validId(row.game_id) || !validSlug(row.slug)) throw new Error(`${key} rows need game_id and a valid slug.`);
    if (typeof row.game_id !== "string" || typeof row.title !== "string" || !row.title.trim()) throw new Error(`${key} rows need game_id and title.`);
    if (key === "codesPages" && row.faq_json != null && (!Array.isArray(row.faq_json) || row.faq_json.some(faq => !faq || typeof faq !== "object" || typeof faq.q !== "string" || !faq.q.trim() || typeof faq.a !== "string" || !faq.a.trim()))) throw new Error("Codes FAQs need an array of non-empty question/answer strings.");
    const stagedGame = payload.games?.find(game => game.id === row.game_id);
    if (!stagedGame) {
     const { data, error } = await sb.from("games").select("namespace").eq("id", row.game_id).single();
     if (error || data.namespace !== namespace) throw new Error("Page game ownership mismatch");
    }
    if (key === "maps") { if (row.renderer_key && row.renderer_key !== "image-pins") throw new Error("Existing GTA map engines use the specialist import."); row.map_data=parseGameMapData(row.map_data); }
    if (key === "quizzes") row.quiz_data=parseGameQuizData(row.quiz_data);
    if (key === "catalog") row.catalog_data=parseGameCatalogData(row.catalog_data);
    if (key === "checklists" && (typeof row.is_public!=="boolean" || row.is_public && (typeof row.published_at!=="string" || !Number.isFinite(Date.parse(row.published_at))))) throw new Error("Checklists need an explicit public state and publication date.");
    if (key === "tools" && (row.tool_key !== "resource-cost" || typeof row.rules_json !== "object" || row.rules_json === null || typeof (row.rules_json as Record<string, unknown>).unitCost !== "number" || !Number.isFinite((row.rules_json as Record<string, number>).unitCost) || (row.rules_json as Record<string, number>).unitCost < 0 || typeof (row.rules_json as Record<string, unknown>).resourceLabel !== "string" || !(row.rules_json as Record<string, string>).resourceLabel.trim())) throw new Error("New shared tools need registered resource-cost rules. Minecraft uses its existing specialist publisher.");
   }
   prepared.push(key === "codes" ? row : { ...row, namespace });
  }
  console.log(`${namespace}: ${prepared.length} ${key} rows validated${argv.includes("--apply") ? ", checking atomic publication" : ", checking rollback-only publication"}`);
  validated.set(key, prepared);
 }
 // The database checks constraints and writes every group in one transaction.
 const { data, error } = await sb.rpc("publish_game_content_batch", { target_namespace: namespace, payload: Object.fromEntries(validated), apply_changes: argv.includes("--apply") });
 if (error) throw error;
 const written = data.rows as Array<{ group: keyof typeof contract; id: string }>;
 if (written.length !== [...validated.values()].reduce((sum, rows) => sum + rows.length, 0)) throw new Error("Incomplete batch readback");
 if (data.applied) for (const [key, prepared] of validated) {
   const ids = written.filter(row => row.group === key).map(row => row.id);
   let query = sb.from(contract[key].table).select("id").in("id", ids);
   if (key !== "codes") query = query.eq("namespace", namespace);
   const { data: readback, error: readError } = await query;
   if (readError) throw readError;
   if (readback.length !== prepared.length) throw new Error("Incomplete publication readback");
   console.log(`${key}: ${readback.length} row IDs read back`);
 }
 console.log(data.applied ? "Atomic publication committed." : "Full database validation passed; every staged change was rolled back.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
