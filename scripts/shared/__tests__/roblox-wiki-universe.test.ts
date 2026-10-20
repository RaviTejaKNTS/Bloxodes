import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureContentUniverse } from "../roblox-wiki-universe";

function database(options: { initial?: Record<string, unknown> | null; readError?: string; writeError?: string; discardWrite?: boolean; readback?: Record<string, unknown> } = {}) {
  let stored = options.initial ?? null;
  const writes: Array<{ payload: Record<string, unknown>; options: unknown }> = [];
  const query = {
    select: () => query,
    eq: (_key: string, id: number) => { assert.equal(id, 123); return query; },
    maybeSingle: async () => ({ data: stored, error: options.readError ? { message: options.readError } : null }),
    single: async () => ({ data: options.readback ?? stored, error: options.readError ? { message: options.readError } : null }),
    upsert: async (payload: Record<string, unknown>, settings: unknown) => {
      writes.push({ payload, options: settings });
      if (!options.discardWrite && !options.writeError) stored ??= payload;
      return { error: options.writeError ? { message: options.writeError } : null };
    }
  };
  return {
    client: { from: (table: string) => { assert.equal(table, "roblox_universes"); return query; } } as unknown as SupabaseClient,
    writes,
    store: (row: Record<string, unknown>) => { stored = row; }
  };
}

test("missing universes are notes in dry runs and import only on apply", async () => {
  const db = database();
  let imports = 0;
  const importer = async (client: SupabaseClient, id: number) => {
    assert.equal(client, db.client);
    assert.equal(id, 123);
    imports += 1;
    db.store({ universe_id: 123, root_place_id: 456, name: "Example", slug: "example" });
  };
  const notes: string[] = [];
  const original = console.log;
  try {
    console.log = message => notes.push(String(message));
    assert.equal(await ensureContentUniverse(db.client, 123, false, importer), null);
    assert.equal(imports, 0);
    assert.deepEqual(notes, ["NOTE will import universe 123 on apply"]);
    assert.equal((await ensureContentUniverse(db.client, 123, true, importer))?.universe_id, 123);
    assert.equal(imports, 1);
    await ensureContentUniverse(db.client, 123, true, importer);
    assert.equal(imports, 1);
  } finally { console.log = original; }
  assert.deepEqual(db.writes, []);
  await assert.rejects(ensureContentUniverse(database({ readError: "permission denied" }).client, 123, false, importer), /permission denied/);
  await assert.rejects(ensureContentUniverse(database().client, 123, true, async () => {}), /import readback failed/);
});

test("universe import uses the stats API mapper, preserves concurrent inserts and verifies identity", async () => {
  // Import the job without invoking its standalone entrypoint or loading target credentials.
  process.env.BLOXODES_ENV_PROFILE = "process-only";
  const { importRobloxUniverse, previewRobloxUniverse } = await import("../../universes/enrich-roblox-universes");
  const details = async (ids: number[]) => {
    assert.deepEqual(ids, [123]);
    return [{ id: 123, name: "Example", rootPlaceId: 456, playing: 10, visits: 100, creator: { id: 789, name: "Creator", type: "Group" } }];
  };
  const db = database();
  const preview = await previewRobloxUniverse(123, details);
  assert.equal(preview.universe_id, 123);
  assert.equal(preview.root_place_id, 456);
  assert.equal(preview.slug, "example");
  assert.deepEqual(db.writes, []);
  await assert.rejects(previewRobloxUniverse(123, async () => [{ id: 999, rootPlaceId: 456, name: "Wrong" }]), /no complete game details/);
  const row = await importRobloxUniverse(db.client, 123, details);
  assert.equal(row.root_place_id, 456);
  assert.equal(db.writes[0].payload.creator_id, 789);
  assert.equal(db.writes[0].payload.playing, 10);
  assert.equal(db.writes[0].payload.slug, "example");
  assert.equal(db.writes[0].payload.display_name, "Example");
  assert.deepEqual(db.writes[0].options, { onConflict: "universe_id", ignoreDuplicates: true });
  const concurrent = database({ initial: { universe_id: 123, root_place_id: 456, name: "Existing name", slug: "existing-stats-slug" } });
  assert.equal((await importRobloxUniverse(concurrent.client, 123, details)).slug, "existing-stats-slug");
  await assert.rejects(importRobloxUniverse(database().client, 123, async () => []), /no complete game details/);
  await assert.rejects(importRobloxUniverse(database().client, 123, async () => [{ id: 999, rootPlaceId: 456, name: "Wrong" }]), /no complete game details/);
  await assert.rejects(importRobloxUniverse(database().client, 123, async () => [{ id: 123, rootPlaceId: 0, name: "Example" }]), /no complete game details/);
  await assert.rejects(importRobloxUniverse(database({ writeError: "write denied" }).client, 123, details), /write denied/);
  await assert.rejects(importRobloxUniverse(database({ discardWrite: true }).client, 123, details), /readback/);
  await assert.rejects(importRobloxUniverse(database({ readback: { universe_id: 999, root_place_id: 456, name: "Wrong", slug: "wrong" } }).client, 123, details), /readback/);
});
