import { expect, it } from "vitest";
import { SCOPE_ENTITY_TYPES } from "../search-scopes";
it.each(Object.entries({ codes: ["code"], articles: ["article", "game_article"], checklists: ["checklist"], quizzes: ["quiz"], puzzles: ["puzzle"], stats: ["stats_game"], tools: ["tool"], catalog: ["catalog"], events: ["event"], authors: ["author"], music: ["music_hub", "music_genre", "music_artist"], wiki: ["wiki", "wiki_collection"] }))("keeps the %s entity list", (scope, types) => {
  expect(SCOPE_ENTITY_TYPES[scope]).toEqual(types);
});
it("puts all nine shared page families in the games scope", () => {
  expect(SCOPE_ENTITY_TYPES.games).toEqual(["game_wiki", "game_collection", "game_code", "game_tool", "game_checklist", "game_map", "game_article", "game_quiz", "game_catalog"]);
});
