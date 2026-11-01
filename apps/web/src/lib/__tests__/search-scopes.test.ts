import { expect, it } from "vitest";
import { LEGACY_GAME_SEARCH_TYPES, SCOPE_ENTITY_TYPES } from "../search-scopes";
it.each(Object.entries({ codes: ["code"], articles: ["article"], checklists: ["checklist"], quizzes: ["quiz"], puzzles: ["puzzle"], stats: ["stats_game"], tools: ["tool"], catalog: ["catalog"], events: ["event"], authors: ["author"], music: ["music_hub", "music_genre", "music_artist"], wiki: ["wiki", "wiki_collection"] }))("preserves the Roblox %s entity list", (scope, types) => {
  expect(SCOPE_ENTITY_TYPES[scope]).toEqual(types);
});
it("puts all eight shared page families and rollout aliases in the games scope", () => {
  expect(SCOPE_ENTITY_TYPES.games).toEqual(["game_wiki", "game_collection", "game_code", "game_tool", "game_checklist", "game_map", "game_quiz", "game_catalog", ...Object.keys(LEGACY_GAME_SEARCH_TYPES)]);
});
