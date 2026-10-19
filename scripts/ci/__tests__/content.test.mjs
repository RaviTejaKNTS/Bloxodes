import assert from "node:assert/strict";
import test from "node:test";
import { batchPath, changedContentBatches, ownedPath, parseBatch } from "../content-contract.mjs";
const batch = () => ({version: 1, operations: [{publisher: "game-pages", namespace: "sandustry", file: "pages.json"}], urls: [{path: "/sandustry/wiki", contains: "Sandustry"}], events: [{type: "game_content", slug: "sandustry/wiki"}]});
test("publication rejects arbitrary commands and arguments", () => {
  assert.throws(() => parseBatch({...batch(), operations: [{publisher: "shell", file: "pages.json"}]}));
  assert.throws(() => parseBatch({...batch(), operations: [{...batch().operations[0], args: ["--all"]}]}));
});
test("bundle paths cannot escape to credentials or another batch", () => {
  for (const input of ["../.envs", "/etc/passwd", "a/../../b", "a\\b"]) assert.throws(() => ownedPath("content/releases/selected", input));
  assert.throws(() => batchPath("tmp/content-workspace/batch.json"));
});
test("exact cache events and public readback are required", () => {
  assert.throws(() => parseBatch({...batch(), events: []}));
  assert.throws(() => parseBatch({...batch(), urls: [{path: "//example.com", contains: "x"}]}));
  assert.equal(parseBatch(batch()).operations.length, 1);
});
test("wiki receipts reject malformed tickets and unrelated publishers", () => {
  const ticket = {queueId: "00000000-0000-0000-0000-000000000001",requestId: "00000000-0000-0000-0000-000000000001-request"};
  assert.throws(() => parseBatch({...batch(),wikiReceipt: ticket}));
  const wiki = {...batch(),operations: [{publisher: "roblox-wiki",file: "final.json"}],wikiReceipt: ticket};
  assert.equal(parseBatch(wiki).wikiReceipt.queueId,ticket.queueId);
  assert.throws(() => parseBatch({...wiki,wikiReceipt: {...ticket,requestId: "different-request"}}));
});

test("batch verification skips removed releases and keeps surviving batches with deleted files", () => {
  const files = ["content/releases/removed/batch.json", "content/releases/removed/final.json", "content/releases/retained/removed-final.json", "content/releases/retained/batch.json", "scripts/ci/publish-content.ts"];
  assert.deepEqual(changedContentBatches(files, directory => directory === "content/releases/retained"), ["content/releases/retained/batch.json"]);
  assert.deepEqual(changedContentBatches(files.slice(0, 2), () => false), []);
});
test("a surviving release directory still requires verification when its batch manifest is removed", () => {
  assert.deepEqual(changedContentBatches(["content/releases/incomplete/batch.json"], directory => directory === "content/releases/incomplete"), ["content/releases/incomplete/batch.json"]);
});
