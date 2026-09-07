import { createClient } from "@supabase/supabase-js";
import { assertNonProductionArticleTarget } from "./article-queue-env";
import { StageFailure } from "./article-pipeline";

export function briefUniverseId(brief: string): number | null {
  const ids = [...brief.matchAll(/universe_id[^\n\d]{0,70}(\d{3,})/gi)].map(match => Number(match[1]));
  const unique = [...new Set(ids)];
  return unique.length === 1 && Number.isSafeInteger(unique[0]) ? unique[0] : null;
}
export async function ensureArticleGameIdentity(id: unknown, env: NodeJS.ProcessEnv, fetcher = fetch) {
  if (id === null || id === undefined) return;
  if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) throw new StageFailure("Invalid article universe identity.");
  const universeId = Number(id);
  assertNonProductionArticleTarget(env.SUPABASE_URL!);
  const db = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.from("roblox_universes").select("universe_id").eq("universe_id", universeId).maybeSingle();
  if (error) throw new StageFailure(`Game identity lookup failed: ${error.message}`, true);
  if (data) return;
  const response = await fetcher(`https://games.roblox.com/v1/games?universeIds=${universeId}`, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new StageFailure(`Official game identity request failed: HTTP ${response.status}`, response.status === 429 || response.status >= 500);
  const payload = await response.json();
  const game = payload.data?.find((item: any) => item.id === universeId);
  if (!game || !Number.isSafeInteger(game.rootPlaceId) || game.rootPlaceId <= 0 || !game.name?.trim()) throw new StageFailure(`Official Roblox metadata did not confirm universe ${universeId}.`);
  const slug = `${game.name.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "universe"}-${universeId}`;
  const { error: insertError } = await db.from("roblox_universes").upsert({ universe_id: universeId, root_place_id: game.rootPlaceId, name: game.name, slug, stats_tier: "NEW", stats_tier_reason: "article_identity_preflight" }, { onConflict: "universe_id", ignoreDuplicates: true });
  if (insertError) throw new StageFailure(`Game identity setup failed: ${insertError.message}`, true);
  const verified = await db.from("roblox_universes").select("root_place_id").eq("universe_id", universeId).single();
  if (verified.error || Number(verified.data?.root_place_id) !== game.rootPlaceId) throw new StageFailure("Game identity readback failed.", true);
}
