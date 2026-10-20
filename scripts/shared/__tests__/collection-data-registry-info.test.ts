import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

test("optional collection registration never blocks file checks or queries the Roblox registry for franchises", async () => {
  process.env.BLOXODES_ENV_PROFILE = "process-only";
  const { optionalCollectionRegistration } = await import("../../collections/check-game-collection-data");
  const priorUrl = process.env.SUPABASE_URL;
  const priorKey = process.env.SUPABASE_SERVICE_ROLE;
  const options = { game: "example", collection: "pets", checkRegistry: true, namespace: "roblox" };
  let reads = 0;
  const lookup = async () => { reads += 1; return null; };
  try {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE;
    const absent = await optionalCollectionRegistration(options, lookup);
    assert.equal(absent.registered, null);
    assert.match(absent.note!, /credentials are absent/);
    assert.equal(reads, 0);

    process.env.SUPABASE_URL = "https://database.example.invalid";
    process.env.SUPABASE_SERVICE_ROLE = "test-only-placeholder";
    await optionalCollectionRegistration({ ...options, checkRegistry: false }, lookup);
    for (const namespace of ["gta", "red-dead", "minecraft", "arc-raiders"]) {
      assert.match((await optionalCollectionRegistration({ ...options, namespace }, lookup)).note!, /franchise content/);
    }
    assert.equal(reads, 0);
    assert.deepEqual(await optionalCollectionRegistration(options, lookup), { registered: false, note: null });
    assert.equal(reads, 1);
    const failure = await optionalCollectionRegistration(options, async () => { throw new Error("read failed"); });
    assert.equal(failure.registered, null);
    assert.match(failure.note!, /read failed/);
  } finally {
    if (priorUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = priorUrl;
    if (priorKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE; else process.env.SUPABASE_SERVICE_ROLE = priorKey;
  }
});

test("the file checker runs without database credentials and reports skipped registry info in JSON", async () => {
  const folder = path.resolve("tmp", `collection-check-${randomUUID()}`);
  await fs.mkdir(folder, { recursive: true });
  const file = path.join(folder, "dataset.json");
  await fs.writeFile(file, JSON.stringify({
    meta: { schemaVersion: 2, display: { sectionOrder: ["Rare"], cardFields: ["price", "ability", "obtainment"] } },
    items: [{ item: { name: "Cat", price: "25 Coins", ability: "Boosts harvests", obtainment: "Hatches from an egg" }, system: { slug: "cat", section: "Rare", sortOrder: 10 } }]
  }));
  try {
    for (const extra of [[], ["--check-registry"], ["--namespace", "gta", "--check-registry"]]) {
      const output = execFileSync(process.execPath, ["--import", "tsx", "scripts/collections/check-game-collection-data.ts", "--game", "example", "--collection", "pets", "--file", file, "--json", ...extra], {
        encoding: "utf8", env: { ...process.env, BLOXODES_ENV_PROFILE: "process-only", SUPABASE_URL: "", SUPABASE_SERVICE_ROLE: "" }
      });
      const summary = JSON.parse(output);
      assert.equal(summary.itemCount, 1);
      assert.equal(summary.registered, null);
      assert.match(summary.registryNote, /skipped/);
      assert.equal(summary.issues.some((issue: { level: string }) => issue.level === "error"), false);
    }
  } finally { await fs.rm(folder, { recursive: true, force: true }); }
});
