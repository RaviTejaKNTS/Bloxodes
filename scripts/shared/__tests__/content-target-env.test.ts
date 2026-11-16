import assert from "node:assert/strict";
import test from "node:test";
import { selectContentTarget } from "../content-target-env";
import { parseContentOptions } from "../../content/wiki-content-options";

test("all content commands default to production and both dry-run spellings are read only", () => {
  for (const args of [["publish", "/bundle"], ["status", "--article", "guide"], ["status", "--stats-report", "report"], ["candidates"]]) {
    const options = parseContentOptions(args);
    assert.equal(options.target, "production"); assert.equal(options.apply, false);
  }
  assert.equal(parseContentOptions(["publish", "/bundle", "--target", "production"]).apply, false);
  assert.equal(parseContentOptions(["publish", "/bundle", "--target", "managed-dev"]).target, "managed-dev");
  assert.throws(() => parseContentOptions(["publish", "/bundle", "--apply"]), /allow-prod/);
  assert.equal(parseContentOptions(["publish", "/bundle", "--apply", "--allow-prod"]).apply, true);
});

test("process-only target guard rejects development credentials for production", () => {
  const original = { BLOXODES_ENV_PROFILE: process.env.BLOXODES_ENV_PROFILE, SUPABASE_URL: process.env.SUPABASE_URL, NODE_ENV: process.env.NODE_ENV };
  try {
    process.env.BLOXODES_ENV_PROFILE = "process-only";
    process.env.SUPABASE_URL = "https://bbtcaurrtyoukvjbxbbj.supabase.co";
    assert.throws(() => selectContentTarget(), /Credentials do not match/);
    selectContentTarget("managed-dev"); assert.equal(process.env.NODE_ENV, "development");
    process.env.SUPABASE_URL = "https://database.bloxodes.com";
    selectContentTarget(); assert.equal(process.env.NODE_ENV, "production");
    assert.throws(() => selectContentTarget("managed-dev"), /Credentials do not match/);
  } finally {
    for (const [key, value] of Object.entries(original)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
