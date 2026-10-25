import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { cachedStatsChart } from "@/lib/stats-chart-cache";
import { slugify } from "@/lib/slug";
import { isPlayingTimestampFresh, STATS_PLAYING_FRESHNESS_MS } from "@/lib/stats-freshness";
import type { StatsGame } from "@/lib/stats";
import {
  DAY_MS, HOUR_MS, utcDay, monthlyPlayers, detectMilestones, updateImpact,
  sessionEstimates, selectBadges, selectMovers, playersCalendar,
  type DailyInsightRow, type HourlyInsightRow, type BadgeInsight, type PassInsight,
  type StatsGameInsights, type GenreScatter, type Mover, type CalendarDay, type UpdateImpact
} from "@/lib/stats-insights";

// Each optional panel has its own five-minute last-good cache. Failed reads
// cannot reject the main detail/home load or erase a different panel's data.
export const INSIGHT_READ_TIMEOUT_MS = 3000;

async function insightRead<T>(key: string, load: (signal: AbortSignal) => Promise<T>): Promise<T | null> {
  return cachedStatsChart(`insight:v2:${key}`, async () => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    // Bound the complete panel load as well as aborting its database requests.
    // Even a transport that fails to settle after abort cannot hold up the page.
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error(`Stats insight deadline exceeded: ${key}`));
      }, INSIGHT_READ_TIMEOUT_MS);
    });
    try {
      return await Promise.race([load(controller.signal), deadline]);
    } finally {
      clearTimeout(timer!);
      controller.abort();
    }
  });
}

export async function loadWeeklyMovers(): Promise<Mover[]> {
  return await insightRead("weekly-movers", async (signal) => {
    const { data, error } = await supabaseAdmin().from("stats_game_current_index")
      .select("universe_id,slug,name,display_name,playing,baseline_playing_7d,growth_7d_percent").abortSignal(signal)
      .gte("playing", 5000).gte("last_playing_refreshed_at", new Date(Date.now() - STATS_PLAYING_FRESHNESS_MS).toISOString())
      .order("playing", { ascending: false, nullsFirst: false }).order("universe_id").limit(1000);
    if (error) throw error;
    return selectMovers((data ?? []).map(r => ({ ...r, name: r.display_name || r.name })) as Mover[]);
  }) ?? [];
}

export async function loadPlayersCalendar(): Promise<CalendarDay[][]> {
  return await insightRead("players-calendar", async (signal) => {
    const { data, error } = await supabaseAdmin().from("roblox_platform_stats_daily")
      .select("stat_date,playing").abortSignal(signal).gte("stat_date", utcDay(Date.now() - 96 * DAY_MS))
      .lte("stat_date", utcDay(Date.now())).order("stat_date", { ascending: false }).limit(97);
    if (error) throw error;
    // Daily `playing` is the rounded sum of daily averages, exactly as in
    // mapPlatformAggregatePoint. `peak_players` sums separate game peaks.
    return playersCalendar((data ?? []).map(row => ({
      stat_date: row.stat_date,
      playing: row.playing == null ? null : Number(row.playing)
    })));
  }) ?? [];
}

async function loadGenreScatter(game: StatsGame): Promise<GenreScatter | null> {
  if (!game.genre || !game.playing || !isPlayingTimestampFresh(game.lastPlayingRefreshedAt)) return null;
  return (await insightRead<{ data: GenreScatter | null }>(`scatter:${game.universeId}`, async (signal) => {
    const db = supabaseAdmin();
    const [peers, total, current] = await Promise.all([
      db.from("stats_game_current_index").select("universe_id,name,display_name,playing,rating_percent").abortSignal(signal)
        .eq("genre_l1", game.genre).gte("playing", 1000).not("rating_percent", "is", null)
        .gte("last_playing_refreshed_at", new Date(Date.now() - STATS_PLAYING_FRESHNESS_MS).toISOString())
        .order("playing", { ascending: false, nullsFirst: false }).order("universe_id").limit(300),
      db.from("stats_genre_current_index").select("games").abortSignal(signal)
        .eq("genre_slug", slugify(game.genre)).limit(1).maybeSingle(),
      db.from("stats_game_current_index").select("genre_playing_rank,rating_percent,playing,name,display_name").abortSignal(signal)
        .eq("universe_id", game.universeId).limit(1).maybeSingle()
    ]);
    if (peers.error || total.error || current.error) throw peers.error ?? total.error ?? current.error;
    if (!total.data || !(total.data.games > 0)) return { data: null };
    const points = (peers.data ?? []).filter(r => r.playing > 0 && r.rating_percent >= 0 && r.rating_percent <= 100)
      .map(r => ({ universeId: Number(r.universe_id), name: r.display_name || r.name, rating: Number(r.rating_percent), players: Number(r.playing) }));
    const row = current.data;
    if (points.filter(r => r.universeId !== game.universeId).length < 10 || !row?.genre_playing_rank || row.rating_percent == null || !(row.playing > 0)) return { data: null };
    return { data: { genre: game.genre!, points, count: total.data.games, rank: row.genre_playing_rank,
      current: { universeId: game.universeId, name: row.display_name || row.name, rating: Number(row.rating_percent), players: Number(row.playing) } } };
  }))?.data ?? null;
}

async function loadUpdateImpacts(universeId: number): Promise<UpdateImpact[]> {
  return await insightRead(`updates:${universeId}`, async (signal) => {
    const db = supabaseAdmin();
    const { data, error } = await db.from("roblox_universe_update_events").select("updated_at_api").abortSignal(signal)
      .eq("universe_id", universeId).gte("updated_at_api", new Date(Date.now() - 89 * DAY_MS).toISOString())
      .lte("updated_at_api", new Date(Date.now() - 48 * HOUR_MS).toISOString())
      .order("updated_at_api", { ascending: false }).limit(5);
    if (error) throw error;
    const results = await Promise.all((data ?? []).map(async event => {
      const at = Date.parse(event.updated_at_api);
      if (at + 48 * HOUR_MS > Date.now()) return null;
      const [hours, titles] = await Promise.all([
        db.from("roblox_universe_stats_hourly").select("hour_start,avg_playing,playing").abortSignal(signal)
          .eq("universe_id", universeId).gte("hour_start", new Date(at - 24 * HOUR_MS).toISOString())
          .lt("hour_start", new Date(at + 48 * HOUR_MS).toISOString()).order("hour_start").limit(73),
        db.from("roblox_virtual_events").select("display_title,title,start_utc").abortSignal(signal)
          .eq("universe_id", universeId).gte("start_utc", new Date(at - 12 * HOUR_MS).toISOString())
          .lte("start_utc", new Date(at + 12 * HOUR_MS).toISOString()).order("start_utc").limit(20)
      ]);
      if (hours.error || titles.error) throw hours.error ?? titles.error;
      const impact = updateImpact(event.updated_at_api, (hours.data ?? []) as HourlyInsightRow[]);
      const nearest = [...(titles.data ?? [])].sort((a, b) => Math.abs(Date.parse(a.start_utc) - at) - Math.abs(Date.parse(b.start_utc) - at))[0];
      return impact ? { ...impact, title: nearest?.display_title || nearest?.title || "Update" } : null;
    }));
    return results.filter((r): r is UpdateImpact => r !== null);
  }) ?? [];
}

export async function loadStatsGameInsights(game: StatsGame): Promise<StatsGameInsights> {
  const id = game.universeId;
  const db = supabaseAdmin();
  const [daily, first, ranks, updates, markers, scatter, badges, passes] = await Promise.all([
    insightRead(`daily:${id}`, async (signal) => {
      const { data, error } = await db.from("roblox_universe_stats_daily")
        .select("stat_date,playing,avg_playing,peak_playing,visits,favorites,visit_delta,visits_start,visits_end,like_delta,dislike_delta,sample_count,is_finalized").abortSignal(signal)
        .eq("universe_id", id).lt("stat_date", utcDay(Date.now())).order("stat_date", { ascending: false }).limit(1000);
      if (error) throw error;
      return (data ?? []) as DailyInsightRow[];
    }),
    insightRead(`first-day:${id}`, async (signal) => {
      const { data, error } = await db.from("roblox_universe_stats_daily").select("stat_date").abortSignal(signal)
        .eq("universe_id", id).order("stat_date").limit(1).maybeSingle();
      if (error) throw error;
      return { date: data?.stat_date ?? null };
    }),
    insightRead(`rank-firsts:${id}`, async (signal) => {
      const rows = await Promise.all([1, 10].map(rank => db.from("roblox_universe_rank_snapshots_daily").select("stat_date").abortSignal(signal)
        .eq("universe_id", id).eq("rank_type", "global_playing").lte("rank_value", rank).order("stat_date").limit(1).maybeSingle()));
      for (const row of rows) if (row.error) throw row.error;
      return rows.map(r => r.data?.stat_date ?? null);
    }),
    loadUpdateImpacts(id),
    insightRead(`session-markers:${id}`, async (signal) => {
      const { data, error } = await db.from("roblox_universe_update_events").select("updated_at_api,label").abortSignal(signal)
        .eq("universe_id", id).gte("updated_at_api", new Date(Date.now() - 90 * DAY_MS).toISOString())
        .order("updated_at_api", { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []).map(r => ({ date: r.updated_at_api, label: r.label || "Update" }));
    }),
    loadGenreScatter(game),
    insightRead(`badges:${id}`, async (signal) => {
      const { data, error } = await db.from("roblox_universe_badges").select("badge_id,name,enabled,rarity_percent,stats_updated_at").abortSignal(signal)
        .eq("universe_id", id).eq("enabled", true).order("badge_id").limit(1000);
      if (error) throw error;
      // An incomplete roster cannot support representative range selection.
      return data?.length === 1000 ? [] : (data ?? []) as BadgeInsight[];
    }),
    insightRead(`passes:${id}`, async (signal) => {
      const { data, error } = await db.from("roblox_universe_gamepasses").select("pass_id,name,price").abortSignal(signal)
        .eq("universe_id", id).eq("is_for_sale", true).gt("price", 0).order("pass_id").limit(1000);
      if (error) throw error;
      return data?.length === 1000 ? [] : (data ?? []) as PassInsight[];
    })
  ]);
  const rows = daily ?? [];
  const firstDate = first?.date ?? null;
  const completeHistory = firstDate !== null && rows.some(r => r.stat_date === firstDate);
  const milestones = detectMilestones(completeHistory ? rows : [], ranks?.[0], ranks?.[1]);
  const votes = rows.filter(r => r.stat_date >= utcDay(Date.now() - 21 * DAY_MS) && r.like_delta != null && r.dislike_delta != null && r.like_delta >= 0 && r.dislike_delta >= 0)
    .sort((a, b) => a.stat_date.localeCompare(b.stat_date)).map(r => ({ date: r.stat_date, likes: r.like_delta!, dislikes: r.dislike_delta! }));
  return { months: monthlyPlayers(rows), trackedSince: firstDate, milestones, updates, votes, sessions: sessionEstimates(rows),
    markers: markers ?? [], scatter, badges: selectBadges(badges ?? []), passes: passes ?? [], asOf: new Date().toISOString() };
}
