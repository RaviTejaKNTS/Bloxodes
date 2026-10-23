import { PassRefreshDeferredError } from "./game-pass-http";
import type { supabaseAdmin } from "@/lib/supabase-admin";

export type GamePass = {
  id: number;
  productId?: number;
  name?: string;
  displayName?: string;
  description?: string;
  displayDescription?: string;
  price?: number;
  isForSale?: boolean;
  sales?: number;
  created?: string;
  updated?: string;
  iconImageId?: number;
  displayIconImageId?: number;
  displayIconImageAssetId?: number;
};

type FetchJson = (url: string, label: string) => Promise<any>;
type Database = ReturnType<typeof supabaseAdmin>;

export function getGamePassIconId(pass: GamePass): number | null {
  return pass.displayIconImageAssetId ?? pass.displayIconImageId ?? pass.iconImageId ?? null;
}

// Reject the entire snapshot on a failed/malformed/repeated page. Partial lists
// must never become deletion allowlists, including when a later page fails.
export async function fetchGamePasses(universeId: number, fetchJson: FetchJson): Promise<GamePass[]> {
  const passes = new Map<number, GamePass>();
  const seenTokens = new Set<string>();
  let pageToken = "";
  for (let page = 0; page < 100; page++) {
    const params = new URLSearchParams({ limit: "100", passView: "Full" });
    if (pageToken) params.set("pageToken", pageToken);
    const data = await fetchJson(`https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes?${params}`, "game passes");
    const rows = data?.gamePasses ?? data?.data;
    if (!Array.isArray(rows)) throw new Error(`Malformed game passes for ${universeId}`);
    for (const pass of rows) {
      if (!pass || !Number.isSafeInteger(pass.id) || pass.id <= 0 || typeof pass.isForSale !== "boolean") {
        throw new Error(`Invalid game pass for ${universeId}`);
      }
      // A missing price on a live pass means Full data was not returned.
      if (pass.isForSale && (!Number.isSafeInteger(pass.price) || pass.price < 0)) {
        throw new Error(`Missing full game pass price for ${universeId}/${pass.id}`);
      }
      passes.set(pass.id, pass);
    }
    const next = data.nextPageToken ?? data.nextPageCursor;
    if (next !== undefined && next !== null && typeof next !== "string") {
      throw new Error(`Invalid game pass page token for ${universeId}`);
    }
    if (!next) return [...passes.values()];
    if (!rows.length || seenTokens.has(next)) throw new Error(`Repeated/incomplete game pass page for ${universeId}`);
    seenTokens.add(next);
    pageToken = next;
  }
  throw new Error(`Game pass page limit reached for ${universeId}`);
}

export async function fetchGamePassThumbnails(passes: GamePass[], fetchJson: FetchJson) {
  const ids = [...new Set(passes.map(getGamePassIconId).filter((id): id is number => Number.isSafeInteger(id) && Number(id) > 0))];
  const urls = new Map<number, string>();
  for (let i = 0; i < ids.length; i += 100) {
    const requested = new Set(ids.slice(i, i + 100));
    const params = new URLSearchParams({ assetIds: [...requested].join(","), size: "150x150", format: "Png", isCircular: "false" });
    const data = await fetchJson(`https://thumbnails.roblox.com/v1/assets?${params}`, "game pass thumbnails");
    if (!Array.isArray(data?.data)) throw new Error("Malformed game pass thumbnails");
    const seen = new Set<number>();
    for (const entry of data.data) {
      if (!entry || !requested.has(entry.targetId) || seen.has(entry.targetId)) {
        throw new Error("Unexpected/duplicate game pass thumbnail target");
      }
      seen.add(entry.targetId);
      if (entry.state === "Completed" && typeof entry.imageUrl === "string" && entry.imageUrl.trim()) urls.set(entry.targetId, entry.imageUrl);
    }
    const missing = [...requested].filter(id => !seen.has(id));
    const unavailable = [...seen].filter(id => !urls.has(id));
    if (missing.length || unavailable.length) {
      console.warn("Incomplete game pass thumbnails; retaining stored URLs for unchanged assets:", { missing, unavailable });
    }
  }
  return urls;
}

// Upsert before pruning: a write failure preserves old rows. Read/delete in
// bounded pages rather than a potentially oversized PostgREST not.in URL.
export async function saveGamePasses(db: Database, universeId: number, passes: GamePass[], thumbnails: Map<number, string>) {
  const ids = new Set(passes.map(pass => pass.id));
  const existing = new Map<number, { icon_image_id: number | null; icon_image_url: string | null }>();
  let afterId = 0;
  while (true) {
    const { data, error } = await db.from("roblox_universe_gamepasses").select("pass_id,icon_image_id,icon_image_url")
      .eq("universe_id", universeId).gt("pass_id", afterId).order("pass_id").limit(200);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) existing.set(Number(row.pass_id), row);
    afterId = Number(data[data.length - 1].pass_id);
    if (data.length < 200) break;
  }
  for (let i = 0; i < passes.length; i += 100) {
    const rows = passes.slice(i, i + 100).map(pass => {
      const iconId = getGamePassIconId(pass);
      const stored = existing.get(pass.id);
      // A changed/removed icon asset must not inherit another asset's URL.
      // Pending, omitted and incomplete thumbnails for the same asset retain it.
      const storedUrl = stored?.icon_image_id === iconId ? stored?.icon_image_url : null;
      return {
        pass_id: pass.id, universe_id: universeId, product_id: pass.productId ?? null,
        name: pass.displayName ?? pass.name ?? `Pass ${pass.id}`,
        description: pass.displayDescription ?? pass.description ?? null,
        price: pass.price ?? null, is_for_sale: pass.isForSale, sales: pass.sales ?? null,
        icon_image_id: iconId, icon_image_url: iconId ? thumbnails.get(iconId) ?? storedUrl ?? null : null,
        created_at_api: pass.created ?? null, updated_at_api: pass.updated ?? null, raw_payload: pass
      };
    });
    const { error } = await db.from("roblox_universe_gamepasses").upsert(rows, { onConflict: "pass_id" });
    if (error) throw error;
  }
  const staleIds = [...existing.keys()].filter(id => !ids.has(id));
  for (let i = 0; i < staleIds.length; i += 200) {
    const { error } = await db.from("roblox_universe_gamepasses").delete()
      .eq("universe_id", universeId).in("pass_id", staleIds.slice(i, i + 200));
    if (error) throw error;
  }
}

export async function refreshGamePasses(db: Database, universeIds: number[], fetchJson: FetchJson, options: { shouldStop?: () => boolean } = {}) {
  const refreshed: number[] = [];
  const failed: number[] = [];
  const deferred: number[] = [];
  const shouldStop = options.shouldStop ?? (() => false);
  let passesCount = 0;
  // Keep memory and thumbnail batches bounded. The daily job supplies a
  // deadline-aware pass-only limiter; deep enrichment keeps its own defaults.
  const uniqueIds = [...new Set(universeIds)];
  for (let offset = 0; offset < uniqueIds.length; offset += 20) {
    if (shouldStop()) { deferred.push(...uniqueIds.slice(offset)); break; }
    const pending = uniqueIds.slice(offset, offset + 20);
    const snapshots = new Map<number, GamePass[]>();
    await Promise.all(Array.from({ length: 2 }, async () => {
      while (pending.length && !shouldStop()) {
        const id = pending.shift()!;
        try { snapshots.set(id, await fetchGamePasses(id, fetchJson)); }
        catch (error) {
          (error instanceof PassRefreshDeferredError ? deferred : failed).push(id);
          console.warn(`Game passes failed/deferred for ${id}:`, error);
        }
      }
    }));
    deferred.push(...pending);
    if (shouldStop()) { deferred.push(...snapshots.keys()); continue; }
    let thumbnails: Map<number, string>;
    try { thumbnails = await fetchGamePassThumbnails([...snapshots.values()].flat(), fetchJson); }
    catch (error) {
      (error instanceof PassRefreshDeferredError ? deferred : failed).push(...snapshots.keys());
      console.warn("Game pass thumbnail batch failed; retaining stored passes:", error);
      continue;
    }
    for (const [id, passes] of snapshots) {
      if (shouldStop()) { deferred.push(id); continue; }
      try {
        await saveGamePasses(db, id, passes, thumbnails);
        refreshed.push(id);
        passesCount += passes.length;
      } catch (error) { failed.push(id); console.warn(`Game pass save failed for ${id}:`, error); }
    }
  }
  return { refreshed, failed, deferred, passesCount };
}
