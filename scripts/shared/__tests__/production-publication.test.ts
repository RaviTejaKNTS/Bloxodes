import assert from "node:assert/strict";
import test from "node:test";
import { isProductionSupabaseUrl } from "../supabase-target";
import { assertProductionPublication } from "../../ci/publication-guard";

test("recognized production URLs all require CI publication", () => {
  for (const url of ["https://database.bloxodes.com", "https://database.bloxodes.com/", "https://bloxodesdb.ravitejaknts.com", "https://DATABASE.BLOXODES.COM/"]) {
    assert.equal(isProductionSupabaseUrl(url), true);
    assert.throws(() => assertProductionPublication(), /Production content writes run only/);
  }
  assert.equal(isProductionSupabaseUrl("https://bbtcaurrtyoukvjbxbbj.supabase.co"), false);
});
