import "../shared/load-env";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { resolveArticleDevCredentials } from "../articles/article-queue-env";
import { parseBatch } from "./content-contract.mjs";
import { decodeBundle } from "./content-bundle.mjs";

export async function dispatchContentBundle(batch: any, inputs: Array<{ source: string; destination: string }>) {
  parseBatch(batch);
  const files = await Promise.all(inputs.map(async input => ({ path: input.destination, base64: (await fs.readFile(input.source)).toString("base64") })));
  const buffer = Buffer.from(JSON.stringify({ version: 1, batch, files }));
  const hash = createHash("sha256").update(buffer).digest("hex");
  decodeBundle(buffer, hash);
  const dev = resolveArticleDevCredentials();
  if (dev.url !== "https://bbtcaurrtyoukvjbxbbj.supabase.co") throw new Error("Unexpected bundle storage target.");
  const sb = createClient(dev.url, dev.serviceRole, { auth: { persistSession: false } });
  const { data: buckets, error: bucketError } = await sb.storage.listBuckets();
  if (bucketError) throw bucketError;
  const bucket = buckets.find(bucket => bucket.name === "ci-release-bundles");
  if (bucket?.public) throw new Error("Publication bundles must stay private.");
  if (!bucket) {
    const { error } = await sb.storage.createBucket("ci-release-bundles", { public: false, fileSizeLimit: 100 * 1024 * 1024, allowedMimeTypes: ["application/json"] });
    if (error) throw error;
  }
  const existing = await sb.storage.from("ci-release-bundles").download(`${hash}.json`);
  if (existing.data) decodeBundle(Buffer.from(await existing.data.arrayBuffer()), hash);
  else {
    const { error } = await sb.storage.from("ci-release-bundles").upload(`${hash}.json`, buffer, { contentType: "application/json", upsert: false });
    if (error) throw error;
  }
  const approvedSha = execFileSync("git", ["ls-remote", "origin", "refs/heads/production"], { encoding: "utf8" }).split(/\s+/)[0];
  if (!/^[0-9a-f]{40}$/.test(approvedSha ?? "")) throw new Error("Production SHA is unavailable.");
  execFileSync("gh", ["workflow", "run", "publish-content.yml", "--repo", "RaviTejaKNTS/Bloxodes", "--ref", "production", "--json"], { input: JSON.stringify({ bundle_hash: hash, approved_sha: approvedSha, apply: "true" }), stdio: ["pipe", "inherit", "inherit"] });
  console.log(`Dispatched frozen content ${hash}. Production acknowledgement follows CI readback.`);
  return { dispatched: true as const, hash };
}

export async function folderInputs(directory: string, destination: string): Promise<Array<{ source: string; destination: string }>> {
  const inputs = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const source = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error("Frozen workspaces cannot contain symlinks.");
    if (entry.isDirectory()) inputs.push(...await folderInputs(source, `${destination}/${entry.name}`));
    else if (/\.(json|md|png|jpg|jpeg|webp)$/.test(entry.name) && !/^(session|logs?|receipt|history)/.test(entry.name)) inputs.push({ source, destination: `${destination}/${entry.name}` });
  }
  return inputs;
}
