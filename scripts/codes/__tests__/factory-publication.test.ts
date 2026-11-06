import test from "node:test";
import assert from "node:assert/strict";
import { bundleFingerprint, publishCodesBundle } from "../factory-publication";
import { commitFactoryPage } from "../factory-commit";
import type { CodePageFinal } from "../final-contract";

const final: CodePageFinal = { slug: "example", name: "Example", universe_id: 1, roblox_link: "https://www.roblox.com/games/2",
  source_url: "https://robloxden.com/game-codes/example", source_url_2: null, intro_md: "Intro", redeem_md: "Redeem",
  troubleshoot_md: "Trouble", rewards_md: "Rewards", find_codes_md: "Find", meta_description: "x".repeat(155),
  game_display_name: "Example", interlinking_copy_md: "[Other](/codes/other) [Other again](/codes/other)" };
function fixture(live = true) {
  let row: any = live ? { id: "page", ...final, is_published: true, intro_md: "Old copy" } : null;
  let readbackFails = false;
  const writes: any[] = [];
  const credited = new Set<string>();
  const counts = new Map<string, number>();
  let commits = 0;
  const sb: any = { rpc: async (name: string, args: any) => {
    assert.equal(name, "publish_factory_code_page"); commits++;
    for (const id of args.p_linked_ids) if (!credited.has(id)) {
      credited.add(id); counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    row = { ...row, ...args.p_payload, is_published: true, interlinking_ai: { bundle_hash: args.p_bundle_hash } };
    writes.push({ is_published: true }); return {};
  }, from: () => ({
    select: () => ({ or: async () => ({ data: row ? [row] : [], error: null }), eq: () => ({ single: async () =>
      readbackFails ? { error: { message: "Lost response" } } : { data: row, error: null } }) }),
    insert: (data: any) => { writes.push(data); row = { id: "page", ...data }; return { select: () => ({ single: async () => ({ data: row }) }) }; },
    update: () => { throw new Error("Unexpected intermediate update"); }
  }) };
  const deps = { context: async () => ({ related_pages: [{ id: "other-id", slug: "other" }] }) as any,
    guard: async () => {}, publicCopyFindings: () => [], ensureIdentity: async () => ({ universeId: 1 }),
    prepare: async (_game: any, fingerprint: string, linked: string[]) => {
      assert.deepEqual(linked, ["other-id"]);
      await commitFactoryPage(sb, "page", final, { universeId: 1, fingerprint, linkedIds: linked }, 1, true, async () => {});
    }
  };
  return { sb, deps, writes, counts, commits: () => commits, row: () => row, failReadback: () => { readbackFails = true; } };
}
test("publish retry after failed readback succeeds without preparation, context reselection or unpublishing", async () => {
  const f = fixture(); f.failReadback();
  await assert.rejects(publishCodesBundle(f.sb, final, f.deps), /readback failed/);
  assert.equal(f.row().is_published, true);
  const writes = f.writes.length;
  await publishCodesBundle(f.sb, final, { ...f.deps,
    context: async () => { throw new Error("Related pages rotated after credit"); },
    prepare: async () => { throw new Error("Source is now unavailable"); }
  });
  assert.equal(f.writes.length, writes);
  assert.equal(f.commits(), 1); assert.equal(f.counts.get("other-id"), 1);
  assert.equal(f.row().interlinking_ai.bundle_hash, bundleFingerprint(final));
});
test("real live update stays live with old content on preparation failure", async () => {
  const f = fixture();
  await assert.rejects(publishCodesBundle(f.sb, final, { ...f.deps, prepare: async game => {
    assert.equal(game.source_url, final.source_url);
    assert.equal(f.row().intro_md, "Old copy"); assert.equal(f.row().is_published, true);
    throw new Error("Source refresh failed");
  } }), /Source refresh failed/);
  assert.deepEqual(f.writes, []); assert.equal(f.row().is_published, true);
});
test("brand new page starts unpublished and passes the same preparation gate", async () => {
  const f = fixture(false);
  await publishCodesBundle(f.sb, final, { ...f.deps, prepare: async (...args) => {
    assert.equal(f.row().is_published, false); await f.deps.prepare(...args);
  } });
  assert.equal(f.writes[0].is_published, false); assert.equal(f.row().is_published, true);
});
test("failed universe/source gates and cover preparation perform no publish or credit RPC", async () => {
  const sb: any = { rpc: () => { throw new Error("Unexpected database call"); } };
  const factory = { universeId: 1, fingerprint: "a".repeat(64), linkedIds: ["linked"] };
  for (const [universe, synced] of [[null, true], [2, true], [1, false]] as const) {
    await assert.rejects(commitFactoryPage(sb, "page", {}, factory, universe, synced, async () => { throw new Error("Unexpected cover"); }), /Factory preparation failed/);
  }
  await assert.rejects(commitFactoryPage(sb, "page", {}, factory, 1, true, async () => { throw new Error("Cover failed"); }), /Cover failed/);
});
test("prepared content, cover, hash and only actual unique linked IDs commit in one RPC", async () => {
  const calls: any[] = [];
  const sb: any = { rpc: async (...args: any[]) => { calls.push(args); return {}; } };
  await commitFactoryPage(sb, "page", { intro_md: "New" }, { universeId: 1, fingerprint: "hash", linkedIds: ["a", "a", "b"] }, 1, true, async () => "cover");
  assert.deepEqual(calls, [["publish_factory_code_page", { p_page_id: "page", p_payload: { intro_md: "New", cover_image: "cover" }, p_bundle_hash: "hash", p_linked_ids: ["a", "b"] }]]);
  await assert.rejects(commitFactoryPage({ rpc: async () => ({ error: { message: "rollback" } }) } as any, "page", {}, { universeId: 1, fingerprint: "hash", linkedIds: [] }, 1, true, async () => {}), /rollback/);
});


test("matching pre-factory live copy succeeds without source refresh or mutations", async () => {
  const f = fixture();
  Object.assign(f.row(), final, { seo_description: final.meta_description, interlinking_ai_copy_md: final.interlinking_copy_md });
  await publishCodesBundle(f.sb, final, { ...f.deps, context: async () => { throw new Error("Unexpected context request"); } });
  assert.equal(f.commits(), 0); assert.deepEqual(f.writes, []);
});

test("republish and changed bundle send the same source page to atomic credit tracking", async () => {
  const f = fixture();
  await publishCodesBundle(f.sb, final, f.deps);
  await publishCodesBundle(f.sb, final, f.deps);
  await publishCodesBundle(f.sb, { ...final, intro_md: "Changed" }, f.deps);
  assert.equal(f.commits(), 2); assert.equal(f.counts.get("other-id"), 1);
});
