// Deployment overlap: the cutover leaves legacy search_index rows in place.
// TODO: remove after tmp/streamline-later/20261102220000_reindex_shared_game_search.sql ships.
export const LEGACY_GAME_SEARCH_TYPES: Record<string, string> = {
  gta_game: "game_wiki", gta_wiki: "game_wiki", gta_wiki_collection: "game_collection", gta_checklist: "game_checklist",
  red_dead_game: "game_wiki", red_dead_wiki: "game_wiki", red_dead_wiki_collection: "game_collection",
  minecraft_game: "game_wiki", minecraft_wiki: "game_wiki", minecraft_wiki_collection: "game_collection", minecraft_tool: "game_tool",
};

export const SCOPE_ENTITY_TYPES: Record<string, string[]> = {
  codes: ["code"],
  articles: ["article"],
  checklists: ["checklist"],
  quizzes: ["quiz"],
  puzzles: ["puzzle"],
  stats: ["stats_game"],
  tools: ["tool"],
  catalog: ["catalog"],
  events: ["event"],
  authors: ["author"],
  music: ["music_hub", "music_genre", "music_artist"],
  wiki: ["wiki", "wiki_collection"],
  maps: ["game_map"],
  games: ["game_wiki", "game_collection", "game_code", "game_tool", "game_checklist", "game_map", "game_quiz", "game_catalog", ...Object.keys(LEGACY_GAME_SEARCH_TYPES)],
};

