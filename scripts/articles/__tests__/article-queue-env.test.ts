import assert from "node:assert/strict";
import test from "node:test";

import { assertNonProductionArticleTarget } from "../article-queue-env";
import {
  isManagedDevelopmentSupabaseUrl,
  isProductionSupabaseUrl,
} from "../../shared/supabase-target";

test("managed development accepts only HTTPS Supabase Cloud project URLs", () => {
  assert.equal(isManagedDevelopmentSupabaseUrl("https://example.supabase.co"), true);
  assert.equal(isManagedDevelopmentSupabaseUrl("http://example.supabase.co"), false);
  assert.equal(isManagedDevelopmentSupabaseUrl("http://127.0.0.1:54321"), false);
  assert.equal(isManagedDevelopmentSupabaseUrl("https://database.bloxodes.com"), false);
});

test("article development rejects localhost and production", () => {
  assert.doesNotThrow(() => assertNonProductionArticleTarget("https://example.supabase.co"));
  assert.throws(() => assertNonProductionArticleTarget("http://127.0.0.1:54321"));
  assert.throws(() => assertNonProductionArticleTarget("https://database.bloxodes.com"));
});

test("production classification remains separate", () => {
  assert.equal(isProductionSupabaseUrl("https://database.bloxodes.com"), true);
  assert.equal(isProductionSupabaseUrl("https://bloxodesdb.ravitejaknts.com"), true);
  assert.equal(isProductionSupabaseUrl("https://example.supabase.co"), false);
});
