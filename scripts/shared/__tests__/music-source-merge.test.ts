import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mergeMusicSources } from "../../catalog/music-source-merge";

test("static music additions preserve live rows, provenance and distinct game/use mappings", () => {
  const live = { game_slug: "a", asset_id: 1, use_type: "radio", source_checked_at: "live" };
  const community = { ...live, source_checked_at: "original" };
  const addition = { ...community, asset_id: 2 };
  const otherGame = { ...community, game_slug: "b" };
  const otherUse = { ...community, use_type: "kill_sound" };
  assert.deepEqual(mergeMusicSources([live], [community, addition, addition, otherGame, otherUse]),
    [live, addition, otherGame, otherUse]);
  assert.equal(addition.source_checked_at, "original");
  assert.deepEqual(mergeMusicSources([live], []), [live]);
});

test("the committed community source expands A Dusty Trip to 33 distinct songs", () => {
  const additions = JSON.parse(readFileSync(new URL("../../../data/game-specific-ids/community-music.json", import.meta.url), "utf8"));
  const generated = JSON.parse(readFileSync(new URL("../../../data/game-specific-ids/source-backed.json", import.meta.url), "utf8"));
  type Row = { game_slug: string; asset_id: number; use_type: string; compatibility_status: string; source_url: string };
  const dustyRows: Row[] = generated.music.filter((row: Row) => row.game_slug === "a-dusty-trip");
  assert.equal(additions.length, 30);
  assert.equal(dustyRows.length, 33);
  assert.equal(new Set(dustyRows.map(row => row.asset_id)).size, 33);
  assert.equal(dustyRows.filter(row => row.compatibility_status === "source_verified").length, 3);
  for (const row of additions as Row[]) {
    assert.equal(row.game_slug, "a-dusty-trip");
    assert.equal(row.compatibility_status, "community_reported");
    assert.equal(row.source_url, "https://progameguides.com/roblox/roblox-a-dusty-trip-song-id-codes/");
    assert.deepEqual(dustyRows.find(candidate => candidate.asset_id === row.asset_id), row);
  }
});
