import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { assertApprovedHubCoverScope, parseContentOptions } from "../../content/wiki-content-options";
import { bundleSchema } from "../../../contracts/roblox-wiki/v1/schema";
import { bundlePath, selectBundlePages } from "../roblox-wiki-bundle";
import { validateRobloxHubCover } from "../roblox-hub-cover";

const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const flag = "--approved-hub-cover-sha256";
const approval = "ab".repeat(32);
const image = (background: string, width = 768, height = 432) => sharp({ create: { width, height, channels: 3, background } });

// Different, fully decodable byte sequences at the same required dimensions.
async function covers() {
  return { original: await image("red").png().toBuffer(), edited: await image("blue").png().toBuffer() };
}

test("default accepts exact official bytes and rejects an edited cover", async () => {
  const { original, edited } = await covers();
  const result = await validateRobloxHubCover(original, original);
  assert.deepEqual(result, { sha256: hash(original), format: "png", mime: "image/png" });
  await assert.rejects(validateRobloxHubCover(edited, original), /differs from the current official thumbnail/);
});

test("approval accepts only the exact reviewed edited bytes for that invocation", async () => {
  const { original, edited } = await covers();
  const approved = hash(edited);
  assert.equal((await validateRobloxHubCover(edited, original, approved)).sha256, approved);
  assert.equal((await validateRobloxHubCover(edited, original, approved.toUpperCase())).sha256, approved);
  await assert.rejects(validateRobloxHubCover(edited, original, hash(original)), /does not match/);
  await assert.rejects(validateRobloxHubCover(original, original, approved), /does not match/);
  const changed = await image("green").png().toBuffer();
  await assert.rejects(validateRobloxHubCover(changed, original, approved), /does not match/);
  // A previous approval does not persist to another call.
  await assert.rejects(validateRobloxHubCover(edited, original), /differs from the current official thumbnail/);
  for (const invalid of ["", "a".repeat(63), "a".repeat(65), "g".repeat(64), `${approved}\n`, ` ${approved}`]) {
    await assert.rejects(validateRobloxHubCover(edited, original, invalid), /64 hexadecimal/);
  }
});

test("default and approved covers retain supported formats and exact dimensions", async () => {
  const original = await image("red").png().toBuffer();
  for (const format of ["png", "jpeg", "webp", "avif"] as const) {
    const bytes = await image("blue").toFormat(format).toBuffer();
    const expectedMime = format === "jpeg" ? "image/jpeg" : `image/${format}`;
    for (const approved of [undefined, hash(bytes)]) {
      const result = await validateRobloxHubCover(bytes, bytes, approved);
      assert.equal(result.format, format);
      assert.equal(result.mime, expectedMime);
    }
    assert.equal((await validateRobloxHubCover(bytes, original, hash(bytes))).format, format);
  }
  for (const [width, height] of [[767, 432], [768, 431], [1536, 864]]) {
    const bytes = await image("blue", width, height).png().toBuffer();
    await assert.rejects(validateRobloxHubCover(bytes, bytes), /readable 768x432/);
    await assert.rejects(validateRobloxHubCover(bytes, original, hash(bytes)), /readable 768x432/);
  }
});

test("approval never bypasses format, decoding or the 1 MB byte limit", async () => {
  const { original, edited } = await covers();
  const gif = await image("blue").gif().toBuffer();
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="768" height="432"><rect width="768" height="432" fill="blue"/></svg>');
  const truncated = edited.subarray(0, Math.floor(edited.length / 2));
  // A truncated PNG still has readable dimensions, so metadata alone is insufficient.
  assert.equal((await sharp(truncated).metadata()).width, 768);
  const tooLarge = Buffer.concat([edited, Buffer.alloc(1_000_001 - edited.length)]);
  for (const bytes of [gif, svg, Buffer.from("unreadable"), truncated, tooLarge]) {
    await assert.rejects(validateRobloxHubCover(bytes, bytes), /readable 768x432/);
    await assert.rejects(validateRobloxHubCover(bytes, original, hash(bytes)), /readable 768x432/);
  }
  const atLimit = Buffer.concat([edited, Buffer.alloc(1_000_000 - edited.length)]);
  assert.equal((await validateRobloxHubCover(atLimit, original, hash(atLimit))).sha256, hash(atLimit));
});

test("approval CLI syntax works on dry runs and applies without weakening production guards", () => {
  for (const flags of [[], ["--apply"], ["--target=production"], ["--target=production", "--apply", "--allow-prod"]]) {
    for (const selection of [[], ["--only=hub"], ["--only=pets", "--only=hub"]]) {
      assert.equal(parseContentOptions(["publish", "/bundle", flag, approval, ...selection, ...flags]).approvedHubCoverSha256, approval);
    }
  }
  assert.equal(parseContentOptions(["publish", "/bundle", `${flag}=${approval.toUpperCase()}`]).approvedHubCoverSha256, approval.toUpperCase());
  for (const invalid of ["", "a".repeat(63), "a".repeat(65), "g".repeat(64), `${approval}\n`, ` ${approval}`]) {
    assert.throws(() => parseContentOptions(["publish", "/bundle", `${flag}=${invalid}`]));
  }
  for (const args of [
    ["publish", "/bundle", flag],
    ["publish", "/bundle", flag, approval, flag, approval],
    ["publish", "/bundle", flag, approval, "--only=pets"],
    ["status", "--game=example", flag, approval],
    ["candidates", flag, approval],
    ["deployed-sha", flag, approval],
    ["publish", "/bundle", flag, approval, "--target=production", "--apply"],
    ["publish", "/bundle", flag, approval, "--allow-prod"]
  ]) assert.throws(() => parseContentOptions(args), undefined, args.join(" "));
});

test("resolved approval scope requires a selected Roblox hub with explicit local cover", async () => {
  const options = parseContentOptions(["publish", "/bundle", flag, approval]);
  const hub = { finalJson: "wiki/final.json", coverImage: "wiki/cover.png" };
  const bundle = bundleSchema.parse({ contract: "roblox-wiki@1", game: { slug: "example", name: "Example", universeId: 123, universeNames: ["Example"] }, hub });
  for (const only of [undefined, ["hub"]]) {
    const selected = await selectBundlePages(bundle, only, async () => { throw new Error("No collections selected"); });
    assert.doesNotThrow(() => assertApprovedHubCoverScope({ ...options, only }, bundle.contract, selected.hub));
  }
  assert.throws(() => assertApprovedHubCoverScope(options, "roblox-wiki@1"), /selected Roblox hub/);
  assert.throws(() => assertApprovedHubCoverScope(options, "roblox-wiki@1", { coverImage: undefined }), /explicit local/);
  assert.throws(() => assertApprovedHubCoverScope(options, "roblox-wiki@1", { coverImage: "" }), /explicit local/);
  assert.throws(() => assertApprovedHubCoverScope(options, "game-wiki@1", hub), /not franchise bundles/);
  assert.throws(() => assertApprovedHubCoverScope({ ...options, only: ["pets"] }, bundle.contract, hub), /selected hub/);
  // Direct publisher callers must meet the same requirements as CLI callers.
  assert.throws(() => assertApprovedHubCoverScope({ ...options, command: "status" }, bundle.contract, hub), /only valid for publish/);
  assert.throws(() => assertApprovedHubCoverScope({ ...options, approvedHubCoverSha256: "bad" }, bundle.contract, hub), /64 hexadecimal/);
  assert.doesNotThrow(() => assertApprovedHubCoverScope({ ...options, approvedHubCoverSha256: undefined }, "game-wiki@1"));
});

test("approval retains bundle path confinement and exact local-file hashing", async () => {
  const scratch = path.resolve("tmp", `approved-hub-cover-${randomUUID()}`);
  const root = path.join(scratch, "bundle");
  await fs.mkdir(root, { recursive: true });
  try {
    const { original, edited } = await covers();
    await fs.writeFile(path.join(root, "cover.png"), edited);
    await fs.writeFile(path.join(scratch, "outside.png"), edited);
    await fs.symlink(path.join(scratch, "outside.png"), path.join(root, "escape.png"));
    const local = await bundlePath(root, "cover.png");
    assert.equal((await validateRobloxHubCover(await fs.readFile(local), original, hash(edited))).sha256, hash(edited));
    await assert.rejects(bundlePath(root, "../outside.png"), /escapes/);
    await assert.rejects(bundlePath(root, "escape.png"), /escapes/);
    await assert.rejects(bundlePath(root, "missing.png"), /ENOENT/);
  } finally { await fs.rm(scratch, { recursive: true, force: true }); }
});

test("CLI rejects approval on franchise bundles before loading credentials or publishing", async () => {
  const root = path.resolve("tmp", `franchise-cover-approval-${randomUUID()}`);
  await fs.mkdir(root, { recursive: true });
  try {
    await fs.writeFile(path.join(root, "bundle.json"), JSON.stringify({ contract: "game-wiki@1" }));
    const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/content/roblox-wiki-cli.ts", "publish", root, flag, approval], {
      encoding: "utf8", env: { ...process.env, BLOXODES_ENV_PROFILE: "must-not-load", SUPABASE_URL: "", SUPABASE_SERVICE_ROLE: "" }
    });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /only valid for Roblox hub publication, not franchise bundles/);
    assert.equal(result.stdout, "");
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
