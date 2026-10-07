import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { dispatchContentBundle, folderInputs } from "./dispatch-content-bundle";
import { resolveArticleDevCredentials } from "../articles/article-queue-env";
import { assertWikiBatchBinding } from "./wiki-publication-binding.mjs";
import { wikiReceiptMatches } from "./wiki-publication-state.mjs";

export async function dispatchWiki(row: any, result: any) {
  const wiki = JSON.parse(await fs.readFile(result.wikiFinalPath, "utf8"));
  const inputs = [{ source: result.wikiFinalPath, destination: "wiki/final.json" }];
  const operations: any[] = [{ publisher: "roblox-wiki", file: "wiki/final.json" }];
  const urls = [{ path: `/wiki/${result.wikiSlug}`, contains: wiki.title }];
  const events = [{ type: "wiki", slug: result.wikiSlug }];
  const fingerprint = async (file: string) => createHash("sha256").update(await fs.readFile(file)).digest("hex");
  const wikiBinding = {source_path: result.wikiFinalPath, file: "wiki/final.json", sha256: await fingerprint(result.wikiFinalPath)};
  const collectionBindings: any[] = [];
  const artifacts: any[] = [{publisher: "roblox-wiki",file: wikiBinding.file,hash: wikiBinding.sha256,data: wiki}];
  for (const manifestPath of result.collectionManifests) {
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    const slug = manifest.collection.slug;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Invalid selected collection.");
    inputs.push(...await folderInputs(path.dirname(manifestPath), `collections/${slug}`));
    operations.push({ publisher: "roblox-collection", file: `collections/${slug}/${path.basename(manifestPath)}` });
    const binding = {slug,source_path: manifestPath,file: `collections/${slug}/${path.basename(manifestPath)}`,sha256: await fingerprint(manifestPath)};
    collectionBindings.push(binding);
    artifacts.push({publisher: "roblox-collection",file: binding.file,hash: binding.sha256,data: manifest});
    urls.push({ path: `/wiki/${result.wikiSlug}/${slug}`, contains: manifest.collection.label });
    events.push({ type: "wiki_collection", slug: `${result.wikiSlug}/${slug}` });
  }
  const ticket = {queueId: row.id,requestId: row.production_receipt.request_id};
  const batch = { version: 1, operations, urls, events, wikiReceipt: ticket };
  return dispatchContentBundle(batch, inputs, async hash => {
    const credentials = resolveArticleDevCredentials();
    if (credentials.url !== "https://bbtcaurrtyoukvjbxbbj.supabase.co") throw new Error("Unexpected wiki receipt project.");
    const db = createClient(credentials.url,credentials.serviceRole,{auth: {persistSession: false}});
    const {data: current,error} = await db.from("wiki_generation_queue").select("status,lease_token,lease_expires_at,production_receipt,wiki_slug,universe_id,wiki_final_path,collection_manifests,approved_collections").eq("id",row.id).single();
    if (error || !wikiReceiptMatches(current,ticket)) throw new Error("Cannot freeze an expired or replaced wiki request.");
    const binding = {bundle_hash: hash,wiki: wikiBinding,collections: collectionBindings};
    if (current.production_receipt.artifact_binding?.bundle_hash && current.production_receipt.artifact_binding.bundle_hash !== hash) throw new Error("Approved wiki artifact bytes changed. A new reviewed request is required.");
    assertWikiBatchBinding({...current,production_receipt: {...current.production_receipt,artifact_binding: binding}},batch,artifacts,hash);
    const now = new Date().toISOString();
    let save = db.from("wiki_generation_queue").update({production_receipt: {...current.production_receipt,artifact_binding: binding}}).eq("id",row.id).eq("status",current.status).eq("production_receipt->>request_id",ticket.requestId).eq("production_receipt->>state","publishing");
    if (current.status === "processing") save = save.eq("lease_token",current.lease_token).gt("lease_expires_at",now);
    const saved = await save.select("id");
    if (saved.error || saved.data?.length !== 1) throw new Error("Wiki request changed before its bundle was dispatched.");
  });
}
