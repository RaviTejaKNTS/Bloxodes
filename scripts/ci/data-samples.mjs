// Supplemental samples for public page, index and sitemap readers.
export function addPublicSamples(tables, { add, id, route, common, timestamp, author, article, peak, universe }) {
  const sharedArticle = add("game_article_pages_view", { ...article, id: id(), universe_id: null, universe: null, namespace: "peak", game_id: peak.id, game_slug: "peak", game_title: "PEAK", slug: "peak-first-climb", canonical_path: "/articles/peak-first-climb", title: "PEAK first climb guide", source: "game", author });
  route(sharedArticle, "game", "article");
  add("game_article_game_summary", { game_id: peak.id, namespace: "peak", game_slug: "peak", title: "PEAK", icon_url: "/Bloxodes.png", article_count: 1, latest_updated_at: timestamp });
  add("game_codes", { id: id(), code_page_id: tables.game_code_pages_view[0].id, code: "TRAIL2026", rewards_text: "Trail supplies", status: "active", verified_at: timestamp });
  const user = add("app_users", { id: id(), display_name: "Trail player", roblox_avatar_url: "/Bloxodes.png", roblox_display_name: null, roblox_username: null, role: "user" });
  for (const page of [article, sharedArticle]) add("comments", { id: id(), parent_id: null, entity_type: page.namespace ? "game_article" : "article", entity_id: page.id, body_md: "The dock quest is a useful starting point.", status: "approved", created_at: timestamp, author_id: user.id, guest_name: null, author: user });

  // Today's date matches the public loader's America/New_York clock. Yesterday
  // and an older answer exercise the archive without aging out on later CI runs.
  const dateParts = new Intl.DateTimeFormat("en", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const today = ["year", "month", "day"].map(type => dateParts.find(part => part.type === type).value).join("-");
  const puzzle = add("puzzle_pages_view", { ...common, id: id(), slug: "wordle", provider: "nyt", title: "Wordle answer", seo_title: "Wordle answer", answer_intro_md: "Check the answer after your last guess.", how_to_play_md: "Guess the five-letter word in six tries.", source_url: "https://www.nytimes.com/games/wordle/index.html", icon_url: "/Bloxodes.png", sort_order: 1, latest_answer_date: today, latest_fetched_at: timestamp, canonical_path: "/puzzles/wordle" });
  route(puzzle, "roblox", "puzzle");
  for (const [index, word] of ["TRAIL", "CLIMB", "ROPES"].entries()) {
    const date = new Date(`${today}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - index);
    add("puzzle_answers", { id: id(), puzzle_slug: puzzle.slug, answer_date: date.toISOString().slice(0, 10), puzzle_id: String(1700 - index), source_url: puzzle.source_url, fetched_at: timestamp, extracted_from: "ci-fixture", answer_summary: { answer: word }, payload: { solution: word }, created_at: timestamp, updated_at: timestamp });
  }
  const event = add("roblox_virtual_events", { event_id: "ci-trail-event", universe_id: universe.universe_id, place_id: 2753915549, title: "Island supply hunt", display_title: "Island supply hunt", start_utc: "2099-01-01T00:00:00Z", end_utc: "2099-01-02T00:00:00Z", created_utc: timestamp, updated_utc: timestamp, event_status: "upcoming", event_visibility: "public", featuring_status: null, all_thumbnails_created: true, host_name: "Game Studio", host_has_verified_badge: true, host_type: "Group", host_id: 1, event_summary_md: "Collect supplies around the island.", event_details_md: "Start at the docks.", guide_slug: null, categories: [{ category: "Adventure", rank: 1 }], thumbnails: [{ media_id: 12345, rank: 1 }] });
  tables.roblox_virtual_event_categories = event.categories;
  tables.roblox_virtual_event_thumbnails = event.thumbnails;
  for (const wiki of tables.wiki_pages) {
    const universe_id = wiki.universe_id;
    add("roblox_universe_media", { id: id(), universe_id, media_type: "screenshot", image_url: "/Bloxodes.png", video_url: null, alt_text: "Island trail", is_primary: true, approved: true, fetched_at: timestamp });
    add("roblox_universe_badges", { universe_id, badge_id: universe_id + 1, name: "First trail", description: "Finish your first trail.", icon_image_url: "/Bloxodes.png", enabled: true, awarded_count: 100, awarded_past_day: 10, awarded_past_week: 50, rarity_percent: 20, stats_updated_at: timestamp });
    add("roblox_universe_gamepasses", { universe_id, pass_id: universe_id + 2, name: "Trail kit", description: "Extra trail supplies.", price: 50, is_for_sale: true, sales: 10, icon_image_url: "/Bloxodes.png" });
    add("roblox_universe_place_servers", { id: id(), universe_id, server_id: `ci-${universe_id}`, region: "US", ping_ms: 40, fps: 60, player_count: 4, max_players: 12, fetched_at: timestamp });
  }
  add("roblox_promo_rewards", { id: id(), asset_id: 7000, reward_name: "Trail hat", official_name: "Trail hat", claim_type: "experience_code", promo_code: "TRAIL2026", event_name: "Trail hunt", requirement_text: "Redeem at camp.", destination_url: "https://www.roblox.com/games/2753915549", roblox_item_url: "https://www.roblox.com/catalog/7000", thumbnail_url: "/Bloxodes.png", status: "verified_claimable", sort_order: 1 });
  for (const code of ["roblox-music-ids/trending", "roblox-music-ids/weekly", "roblox-music-ids/monthly", "roblox-music-ids/yearly", "roblox-decal-ids/curated"]) add("catalog_membership_snapshots", { code, updated_at: timestamp });
  add("roblox_emote_commands", { code: "wave", name: "Wave", command: "/e wave", asset_id: 507770239, kind: "default", description: "Wave to nearby players.", requirements: "Use a compatible avatar.", source_urls: ["https://en.help.roblox.com/"], verification_method: "fixture", verified_at: timestamp, sort_order: 1, is_published: true });
  add("stats_reports", { ...common, id: id(), slug: "roblox-october-2026", month: "2026-10-01", title: "Roblox October 2026 stats", dek: "Players and visits across tracked games.", visibility: "public", feature_image_url: "/Bloxodes.png", content: { month: "2026-10", short_version: ["The island games reached 1,200 players."], body: [{ type: "h2", id: "players", text: "Players" }, { type: "p", md: "Tracked games reached 1,200 players." }] }, data: { facts: { avgPlayers: 1200, busiestPlayers: 1500, busiestDay: "2026-10-15", visits: 500000, playersChange: 10, visitsChange: 5, top10Share: 20, newGames: 1, trackedGames: 7 }, charts: {}, games: {} } });
  tables.published_articles_view = [...tables.articles, sharedArticle];
  tables.code_pages_view = tables.code_pages.map(page => ({ ...page, codes: tables.codes.filter(code => code.code_page_id === page.id) }));
}

export function addStatsSamples(tables, { add, timestamp, universe }) {
  const now = new Date(), recent = now.toISOString(), day = recent.slice(0, 10), hour = recent.slice(0, 13) + ":00:00Z";
  for (const row of tables.stats_game_current_index) Object.assign(row, { playing: 6000, last_playing_refreshed_at: recent, baseline_playing_24h: 4500, baseline_playing_7d: 4000, growth_24h: 1500, growth_24h_percent: 33, growth_7d: 2000, growth_7d_percent: 50, genre_playing_rank: 1 });
  Object.assign(tables.stats_genre_current_index[0], { genre: "Adventure", genre_slug: "adventure", games: 7, top_name: universe.name, top_slug: universe.slug, top_icon_url: "/Bloxodes.png", top_playing: 6000 });
  add("stats_risers_current_index", { universe_id: universe.universe_id, rank_value: 1 });
  const item = tables.roblox_catalog_items[0];
  add("stats_item_current_index", { ...item, indexed_at: recent, item_stats_tier: "HOT", thumbnail_state: "Completed", roblox_url: "https://www.roblox.com/catalog/7000", units_available_for_consumption: 100, quantity_limit_per_user: 1, collectible_item_id: null, last_item_stats_refreshed_at: recent, last_resale_data_fetched_at: recent, price_change_24h: 5, resale_change_24h: 5, favorite_change_24h: 10, price_change_7d: 10, resale_change_7d: 10, favorite_change_7d: 20, global_favorites_rank: 1, global_resale_rank: 1, first_seen_at: timestamp });
  add("stats_creator_current_index", { creator_key: "User:1", creator_type: "User", creator_id: 1, creator_name: "Roblox", creator_slug: "roblox", game_count: 7, playing: 42000, visits: 3500000, favorites: 84000, likes: 1330, dislikes: 70, rating_percent: 95, top_universe_id: universe.universe_id, top_slug: universe.slug, top_name: universe.name, top_display_name: universe.display_name, top_icon_url: "/Bloxodes.png", top_playing: 6000, top_visits: 500000, top_favorites: 12000, member_count: null, has_verified_badge: true, last_stats_refreshed_at: recent, indexed_at: recent });
  for (let index = 0; index < 3; index++) {
    const point = new Date(now); point.setUTCDate(point.getUTCDate() - index);
    const stat_date = point.toISOString().slice(0, 10), hour_start = point.toISOString().slice(0, 13) + ":00:00Z";
    add("roblox_universe_stats_hourly", { universe_id: universe.universe_id, hour_start, playing: 6000, avg_playing: 6000, peak_playing: 6500, visits_end: 500000, favorites_end: 12000, likes_end: 190, dislikes_end: 10, rating_percent: 95, sample_count: 12 });
    add("roblox_universe_stats_daily", { universe_id: universe.universe_id, stat_date, playing: 6000, avg_playing: 6000, peak_playing: 6500, visits: 500000, visit_delta: 10000, visits_start: 490000, visits_end: 500000, like_delta: 10, dislike_delta: 1, sample_count: 288, is_finalized: index > 0 });
    add("roblox_universe_rank_snapshots_hourly", { universe_id: universe.universe_id, hour_start, sampled_at: recent, rank_type: "global_playing", rank_value: 1, metric_value: 6000 });
    const platform = { playing: 42000, peak_players: 45000, avg_players: 42000, visits: 3500000, favorites: 84000, rating_percent: 95, tracked_games: 7, samples: 12, recorded_at: recent };
    add("roblox_platform_stats_hourly", { ...platform, hour_start });
    add("roblox_platform_stats_daily", { ...platform, stat_date });
  }
  add("roblox_universe_update_events", { id: "ci-update", universe_id: universe.universe_id, updated_at_api: recent, detected_at: recent, label: "New island trail", source: "api" });
  add("roblox_catalog_item_stats_hourly", { asset_id: item.asset_id, hour_start: hour, price_robux: 0, lowest_resale_price_robux: null, favorite_count: 100, units_available_for_consumption: 100 });
  add("roblox_catalog_item_stats_daily", { asset_id: item.asset_id, stat_date: day, price_close: 0, resale_close: null, favorites_close: 100, units_available_close: 100 });
  add("roblox_catalog_item_resale_points", { asset_id: item.asset_id, point_date: day, resale_price_robux: 50, resale_volume: 2 });
}
