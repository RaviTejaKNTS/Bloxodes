import { createClient } from "@supabase/supabase-js";
import { assertNonProductionArticleTarget } from "./article-queue-env";
import { StageFailure } from "./article-pipeline";
import { fetchWithTransientRetries } from "../shared/transient-http";

type Identity = { universe_id: number | null; supplied_id: number | null; note: string };
export async function resolveOfficialArticleGame(id: number, fetcher = fetch, pause?: (ms: number) => Promise<void>) {
  const notes: string[] = [];
  const getGame = async (universeId: number) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetchWithTransientRetries(`https://games.roblox.com/v1/games?universeIds=${universeId}`, {}, { fetchImpl: fetcher, sleep: pause, timeoutMs: 30_000, attempts: 3 });
        const payload = await response.json();
        const game = Array.isArray(payload.data) ? payload.data.find((item: any) => Number(item.id) === universeId) : null;
        if (game && Number.isSafeInteger(game.rootPlaceId) && game.rootPlaceId > 0 && typeof game.name === "string" && game.name.trim()) return { ...game, id: universeId };
        notes.push(`Universe ${universeId}: official response had no complete matching game.`);
      } catch (error) { notes.push(error instanceof Error ? error.message : String(error)); break; }
      if (attempt < 2) await (pause ?? (ms => new Promise(resolve => setTimeout(resolve, ms))))(1000 * 2 ** attempt);
    }
    return null;
  };
  const direct = await getGame(id);
  if (direct) return { game: direct, note: "Official universe metadata confirmed." };
  // /games/<id> URLs contain place IDs. Only an official mapping can correct one.
  try {
    const response = await fetchWithTransientRetries(`https://apis.roblox.com/universes/v1/places/${id}/universe`, {}, { fetchImpl: fetcher, sleep: pause, timeoutMs: 30_000, attempts: 3 });
    const { universeId } = await response.json();
    if (Number.isSafeInteger(universeId) && universeId > 0 && universeId !== id) {
      const mapped = await getGame(universeId);
      if (mapped) return { game: mapped, note: `Official place mapping corrected supplied place ${id} to universe ${universeId}.` };
    }
  } catch (error) { notes.push(error instanceof Error ? error.message : String(error)); }
  return { game: null, note: `No official identity confirmed after bounded retries; universe_id is null. ${notes.join(" ")}` };
}

export function briefUniverseId(brief: string): number | null {
  const ids = [...brief.matchAll(/universe_id[^\n\d]{0,70}(\d{3,})/gi)].map(match => Number(match[1]));
  const unique = [...new Set(ids)];
  return unique.length === 1 && Number.isSafeInteger(unique[0]) ? unique[0] : null;
}
export async function ensureArticleGameIdentity(id: unknown, env: NodeJS.ProcessEnv, fetcher = fetch): Promise<Identity> {
  if (id === null || id === undefined) return { universe_id: null, supplied_id: null, note: "No game identity supplied." };
  if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) throw new StageFailure("Invalid article universe identity.");
  let universeId = Number(id);
  const suppliedId = universeId;
  assertNonProductionArticleTarget(env.SUPABASE_URL!);
  const db = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.from("roblox_universes").select("universe_id").eq("universe_id", universeId).maybeSingle();
  if (error) throw new StageFailure(`Game identity lookup failed: ${error.message}`, true);
  if (data) return { universe_id: universeId, supplied_id: suppliedId, note: "Existing managed-development identity preserved." };
  const { game, note } = await resolveOfficialArticleGame(universeId, fetcher);
  if (!game) { console.warn(note); return { universe_id: null, supplied_id: suppliedId, note }; }
  universeId = game.id;
  const slug = `${game.name.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "universe"}-${universeId}`;
  const { error: insertError } = await db.from("roblox_universes").upsert({ universe_id: universeId, root_place_id: game.rootPlaceId, name: game.name, slug, stats_tier: "NEW", stats_tier_reason: "article_identity_preflight" }, { onConflict: "universe_id", ignoreDuplicates: true });
  if (insertError) throw new StageFailure(`Game identity setup failed: ${insertError.message}`, true);
  const verified = await db.from("roblox_universes").select("root_place_id").eq("universe_id", universeId).single();
  if (verified.error || Number(verified.data?.root_place_id) !== game.rootPlaceId) throw new StageFailure("Game identity readback failed.", true);
  return { universe_id: universeId, supplied_id: suppliedId, note };
}
