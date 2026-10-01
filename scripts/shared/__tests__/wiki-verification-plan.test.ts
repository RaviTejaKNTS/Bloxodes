import test from "node:test";
import assert from "node:assert/strict";
import { wikiVerificationSyncArgs } from "../wiki-verification-plan";

test("task-local unregistered games sync their explicit final with exact identity", () => {
  assert.deepEqual(wikiVerificationSyncArgs("/state/new-game/wiki/final.json", "new-game", { slug: "new-game", universe_id: 123 }, "https://dev.supabase.co"),
    ["run", "sync:game-wiki-runtime", "--", "--final-json", "/state/new-game/wiki/final.json", "--game", "new-game", "--universe-id", "123", "--apply"]);
});

test("wiki verification refuses production and malformed or mismatched identity before mutation", () => {
  for (const target of [undefined, "https://database.bloxodes.com", "http://dev.supabase.co", "https://example.com"]) {
    assert.throws(() => wikiVerificationSyncArgs("/state/final.json", "new-game", { slug: "new-game", universe_id: 123 }, target), /managed development/);
  }
  for (const final of [{ slug: "other-game", universe_id: 123 }, { universe_id: 123 }, { slug: "new-game", universe_id: 0 }, { slug: "new-game", universe_id: "123" }, { slug: "new-game", universe_id: 1.5 }]) {
    assert.throws(() => wikiVerificationSyncArgs("/state/final.json", "new-game", final, "https://dev.supabase.co"));
  }
});
