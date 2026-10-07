import assert from "node:assert/strict";
import test from "node:test";
import { batchPath, ownedPath, parseBatch } from "../content-contract.mjs";
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
