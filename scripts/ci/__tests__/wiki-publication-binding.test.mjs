import assert from "node:assert/strict";
import test from "node:test";
import { assertWikiBatchBinding } from "../wiki-publication-binding.mjs";

function fixture() {
  const hash = "a".repeat(64);
  const row = {wiki_slug: "example",universe_id: 123,approved_collections: ["items"],wiki_final_path: "/approved/final.json",collection_manifests: ["/approved/items/runtime-manifest.json"],production_receipt: {artifact_binding: {
    bundle_hash: hash,wiki: {source_path: "/approved/final.json",file: "wiki/final.json",sha256: "hub-bytes"},
    collections: [{slug: "items",source_path: "/approved/items/runtime-manifest.json",file: "items/runtime-manifest.json",sha256: "manifest-bytes"}]
  }}};
  const batch = {urls: [{path: "/wiki/example"},{path: "/wiki/example/items"}],events: [{type: "wiki",slug: "example"},{type: "wiki_collection",slug: "example/items"}]};
  const artifacts = [{publisher: "roblox-wiki",file: "wiki/final.json",hash: "hub-bytes",data: {slug: "example",universe_id: 123}}, {publisher: "roblox-collection",file: "items/runtime-manifest.json",hash: "manifest-bytes",data: {game: {slug: "example",universeId: 123},collection: {slug: "items"}}}];
  return {row,batch,artifacts,hash};
}
const verify = f => assertWikiBatchBinding(f.row,f.batch,f.artifacts,f.hash);
test("the exact frozen request binds its hub, collections and canonical routes", () => {
  assert.doesNotThrow(() => verify(fixture()));
});
test("another page cannot acknowledge the selected queue request", () => {
  for (const change of [
    f => {f.artifacts[0].data.slug = "another-game";},
    f => {f.artifacts[1].data.game.universeId = 999;},
    f => {f.batch.urls[0].path = "/wiki/another-game";},
    f => {f.batch.events[0].slug = "another-game";},
    f => {f.row.wiki_final_path = "/different/final.json";},
    f => {f.row.collection_manifests = ["/different/runtime-manifest.json"];},
    f => {f.artifacts[1].hash = "edited-bytes";},
    f => {f.hash = "b".repeat(64);},
    f => {f.artifacts.push(f.artifacts[1]);},
    f => {f.batch.urls.push(f.batch.urls[0]);}
  ]) {
    const f = fixture(); change(f);
    assert.throws(() => verify(f));
  }
});
