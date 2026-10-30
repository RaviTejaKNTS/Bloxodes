import type { supabaseAdmin } from "@/lib/supabase-admin";
import { PassRefreshDeferredError } from "./game-pass-http";

type Database = ReturnType<typeof supabaseAdmin>;
type FetchJson = (url: string, label: string) => Promise<any>;
export type RefreshBadge = {
  id: number; name: string; displayName?: string; description?: string; displayDescription?: string;
  enabled: boolean; created?: string; updated?: string;
  statistics?: { awardedCount?: number; pastDayAwardedCount?: number; winRatePercentage?: number };
};
export const BADGE_MAX_PAGES_PER_UNIVERSE = 10;

// Complete snapshots only. A failed/malformed/repeated/truncated page never
// becomes a deletion allowlist. A large roster is deferred to deep enrichment.
export async function fetchRefreshBadges(universeId: number, fetchJson: FetchJson): Promise<RefreshBadge[]> {
  const badges = new Map<number, RefreshBadge>();
  const seen = new Set<string>();
  let cursor = "";
  for (let page = 0; page < BADGE_MAX_PAGES_PER_UNIVERSE; page++) {
    const params = new URLSearchParams({ limit: "100", sortOrder: "Asc" });
    if (cursor) params.set("cursor", cursor);
    const result = await fetchJson(`https://badges.roblox.com/v1/universes/${universeId}/badges?${params}`, "badges");
    if (!Array.isArray(result?.data) || !("nextPageCursor" in result)) throw new Error(`Malformed badges for ${universeId}`);
    for (const badge of result.data) {
      if (!badge || !Number.isSafeInteger(badge.id) || badge.id <= 0 || typeof badge.enabled !== "boolean" || typeof badge.name !== "string" || !badge.name.trim()) throw new Error(`Invalid badge for ${universeId}`);
      const stats = badge.statistics;
      if (stats != null) for (const field of ['awardedCount', 'pastDayAwardedCount', 'winRatePercentage'] as const) {
        const value = stats[field];
        if (value != null && (typeof value !== "number" || !Number.isFinite(value) || value < 0 || (field === 'winRatePercentage' && value > 1))) throw new Error(`Invalid badge statistics for ${universeId}`);
      }
      badges.set(badge.id, badge);
    }
    const next = result.nextPageCursor;
    if (next != null && typeof next !== "string") throw new Error(`Invalid badge cursor for ${universeId}`);
    if (!next) return [...badges.values()];
    if (!result.data.length || seen.has(next)) throw new Error(`Repeated/incomplete badge page for ${universeId}`);
    seen.add(next); cursor = next;
  }
  throw new PassRefreshDeferredError(`Badge roster exceeds ${BADGE_MAX_PAGES_PER_UNIVERSE} pages for ${universeId}`);
}

export async function saveRefreshBadges(db: Database, universeId: number, badges: RefreshBadge[], now = new Date().toISOString(), shouldStop = () => false) {
  const check = () => { if (shouldStop()) throw new PassRefreshDeferredError("Badge write deadline exhausted"); };
  const existing = new Set<number>();
  let after = 0;
  while (true) {
    check();
    const { data, error } = await db.from("roblox_universe_badges").select("badge_id")
      .eq("universe_id", universeId).gt("badge_id", after).order("badge_id").limit(200);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) existing.add(Number(row.badge_id));
    after = Number(data[data.length - 1].badge_id);
    if (data.length < 200) break;
  }
  const ids = new Set(badges.map(b => b.id));
  for (let i = 0; i < badges.length; i += 100) {
    const rows = badges.slice(i, i + 100).map(b => ({
      badge_id: b.id, universe_id: universeId, name: b.displayName || b.name,
      ...((b.displayDescription ?? b.description) != null ? { description: b.displayDescription ?? b.description } : {}),
      enabled: b.enabled,
      // Light refresh leaves existing icons alone. Raw win rate stays in 0..1
      // units, matching deep enrichment; conversion to percent belongs to UI.
      ...(b.statistics?.awardedCount != null ? { awarded_count: b.statistics.awardedCount } : {}),
      ...(b.statistics?.pastDayAwardedCount != null ? { awarded_past_day: b.statistics.pastDayAwardedCount } : {}),
      ...(b.statistics?.winRatePercentage != null ? { rarity_percent: b.statistics.winRatePercentage, stats_updated_at: now } : {}),
      ...(b.created != null ? { created_at_api: b.created } : {}),
      ...(b.updated != null ? { updated_at_api: b.updated } : {}),
      raw_payload: b
    }));
    // Group identical field sets so omitted fields preserve stored values even
    // when another row in the same source page has those fields populated.
    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = Object.keys(row).sort().join(",");
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    for (const group of groups.values()) {
      check();
      const { error } = await db.from("roblox_universe_badges").upsert(group, { onConflict: "badge_id", defaultToNull: false });
      if (error) throw error;
    }
  }
  const stale = [...existing].filter(id => !ids.has(id));
  for (let i = 0; i < stale.length; i += 200) {
    check();
    const { error } = await db.from("roblox_universe_badges").delete().eq("universe_id", universeId).in("badge_id", stale.slice(i, i + 200));
    if (error) throw error;
  }
}
export async function refreshBadges(db: Database, universeIds: number[], http: { fetchJson: FetchJson; shouldStop: () => boolean }) {
  const pending = [...new Set(universeIds)];
  const refreshed: number[] = [], failed: number[] = [], deferred: number[] = [];
  let badgesCount = 0;
  await Promise.all(Array.from({ length: 2 }, async () => {
    while (pending.length && !http.shouldStop()) {
      const id = pending.shift()!;
      try {
        const badges = await fetchRefreshBadges(id, http.fetchJson);
        if (http.shouldStop()) { deferred.push(id); continue; }
        await saveRefreshBadges(db, id, badges, new Date().toISOString(), http.shouldStop);
        badgesCount += badges.length; refreshed.push(id);
      } catch (error) {
        (error instanceof PassRefreshDeferredError ? deferred : failed).push(id);
        console.warn(`Badge refresh failed/deferred for ${id}:`, error);
      }
    }
  }));
  deferred.push(...pending);
  return { refreshed, failed, deferred, badgesCount };
}
