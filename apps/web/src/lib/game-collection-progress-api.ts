import "server-only";
import { reconcileGameProgress, normalizeStoredGameProgress } from "./game-progress-reconcile";
import { NextResponse } from "next/server";
import { getSessionUser } from "./auth/session-user";
import { supabaseAdmin } from "./supabase";
import { isTrustedMutationOrigin } from "./security/request";
import { checkRateLimit } from "./security/rate-limit";
import { normalizeGtaCollectionCode as normalizeCode, normalizeGtaCollectionItemSlugs as normalizeSlugs } from "./gta-collection-progress";

function response(payload: unknown, status = 200) { return NextResponse.json(payload, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } }); }
async function collection(namespace: string, code: string) {
 const { data, error } = await supabaseAdmin().from("game_collection_pages_view").select("id,code,published_dataset_id").eq("namespace", namespace).eq("code", code).eq("is_published", true).eq("page_type", "collectible").not("published_dataset_id", "is", null).maybeSingle();
 if (error) throw error;
 return data;
}
async function currentSlugs(namespace: string, datasetId: string): Promise<Set<string>> {
 const result = new Set<string>();
 for (let offset = 0;;offset += 1000) {
  const { data, error } = await supabaseAdmin().from("game_collection_items").select("item_slug").eq("namespace", namespace).eq("dataset_id", datasetId).order("item_slug").range(offset, offset + 999);
  if (error) throw error;
  for (const row of data) result.add(row.item_slug);
  if (data.length < 1000) return result;
 }
}
async function historicalSlugs(namespace: string, pageId: string, ids: string[]): Promise<Set<string>> {
 const result = new Set<string>();
 for (let start = 0; start < ids.length; start += 200) for (let offset = 0;;offset += 1000) {
  const { data, error } = await supabaseAdmin().from("game_collection_items").select("id,item_slug,game_collection_datasets!inner(collection_page_id)").eq("namespace", namespace).eq("game_collection_datasets.collection_page_id", pageId).in("item_slug", ids.slice(start, start + 200)).order("id").range(offset, offset + 999);
  if (error) throw error;
  for (const row of data) result.add(row.item_slug);
  if (data.length < 1000) break;
 }
 return result;
}
export function gameCollectionProgressApi(namespace: string) {
 if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(namespace) || namespace === "roblox") throw new Error("Invalid game namespace");
 return {
  async GET(request: Request) {
   try {
    const user = await getSessionUser();
    if (!user) return response({ error: "Unauthorized" }, 401);
    const rawCode = new URL(request.url).searchParams.get("code");
    const code = normalizeCode(rawCode);
    if (rawCode !== null && !code) return response({ error: "Invalid collection code." }, 400);
    const page = code ? await collection(namespace, code) : null;
    if (code && !page) return response({ error: "Unknown collectible collection." }, 404);
    let query = supabaseAdmin().from("game_collection_progress").select("collection_code,checked_item_slugs").eq("namespace", namespace).eq("user_id", user.id);
    if (code) query = query.eq("collection_code", code);
    const { data, error } = await query;
    if (error) throw error;
    if (code && page) {
     const current = await currentSlugs(namespace, page.published_dataset_id!);
     return response({ checkedIds: normalizeStoredGameProgress(data?.[0]?.checked_item_slugs).filter(id => current.has(id)) });
    }
    const { data: visible, error: visibleError } = await supabaseAdmin().from("game_collection_pages_view").select("code,published_dataset_id").eq("namespace", namespace).eq("is_published", true).eq("page_type", "collectible");
    if (visibleError) throw visibleError;
    const published = new Map((visible ?? []).map(row => [row.code, row.published_dataset_id]));
    const progress = await Promise.all((data ?? []).filter(row => published.has(row.collection_code)).map(async row => {
     const current = await currentSlugs(namespace, published.get(row.collection_code)!);
     return { code: row.collection_code, checkedCount: normalizeStoredGameProgress(row.checked_item_slugs).filter(id => current.has(id)).length };
    }));
    return response({ progress });
   } catch (error) { console.error("Game progress read failed", error); return response({ error: "Unable to load collection progress." }, 500); }
  },
  async PUT(request: Request) {
   try {
    if (!isTrustedMutationOrigin(request)) return response({ error: "Invalid request origin." }, 403);
    const user = await getSessionUser();
    if (!user) return response({ error: "Unauthorized" }, 401);
    if (!checkRateLimit({ key: `game-progress:${user.id}:${namespace}`, limit: 60, windowMs: 60000 }).allowed) return response({ error: "Too many requests." }, 429);
    const payload = await request.json().catch(() => null);
    const code = normalizeCode(payload?.code);
    if (!code || !Array.isArray(payload?.checkedIds) || payload.checkedIds.length > 2000) return response({ error: "Invalid progress data." }, 400);
    const page = await collection(namespace, code);
    if (!page) return response({ error: "Unknown collectible collection." }, 404);
    const checkedIds = normalizeSlugs(payload.checkedIds);
    if (checkedIds.length !== new Set(payload.checkedIds).size) return response({ error: "Invalid item IDs." }, 400);
    const sb = supabaseAdmin();
    const current = await currentSlugs(namespace, page.published_dataset_id!);
    const stale = checkedIds.filter(id => !current.has(id));
    const historical = await historicalSlugs(namespace, page.id, stale);
    const saved = await sb.from("game_collection_progress").select("checked_item_slugs").eq("namespace", namespace).eq("user_id", user.id).eq("collection_code", code).maybeSingle();
    if (saved.error) throw saved.error;
    const reconciled = reconcileGameProgress(checkedIds, normalizeStoredGameProgress(saved.data?.checked_item_slugs), current, historical);
    if (!reconciled) return response({ error: "Unknown collection item." }, 400);
    const write = reconciled.stored.length ? await sb.from("game_collection_progress").upsert({ namespace, user_id: user.id, collection_code: code, checked_item_slugs: reconciled.stored, updated_at: new Date().toISOString() }, { onConflict: "user_id,namespace,collection_code" }) : await sb.from("game_collection_progress").delete().eq("namespace", namespace).eq("user_id", user.id).eq("collection_code", code);
    if (write.error) throw write.error;
    return response({ checkedIds: reconciled.visible });
   } catch (error) { console.error("Game progress write failed", error); return response({ error: "Unable to save collection progress." }, 500); }
  }
 };
}
