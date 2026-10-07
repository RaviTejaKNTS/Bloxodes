import fs from "node:fs/promises";
import path from "node:path";
import { dispatchContentBundle, folderInputs } from "./dispatch-content-bundle";

export async function dispatchWiki(row: any, result: any) {
  const wiki = JSON.parse(await fs.readFile(result.wikiFinalPath, "utf8"));
  const inputs = [{ source: result.wikiFinalPath, destination: "wiki/final.json" }];
  const operations: any[] = [{ publisher: "roblox-wiki", file: "wiki/final.json" }];
  const urls = [{ path: `/wiki/${result.wikiSlug}`, contains: wiki.title }];
  const events = [{ type: "wiki", slug: result.wikiSlug }];
  for (const manifestPath of result.collectionManifests) {
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    const slug = manifest.collection.slug;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Invalid selected collection.");
    inputs.push(...await folderInputs(path.dirname(manifestPath), `collections/${slug}`));
    operations.push({ publisher: "roblox-collection", file: `collections/${slug}/${path.basename(manifestPath)}` });
    urls.push({ path: `/wiki/${result.wikiSlug}/${slug}`, contains: manifest.collection.label });
    events.push({ type: "wiki_collection", slug: `${result.wikiSlug}/${slug}` });
  }
  return dispatchContentBundle({ version: 1, operations, urls, events, wikiReceipt: { queueId: row.id, requestId: row.production_receipt.request_id } }, inputs);
}
