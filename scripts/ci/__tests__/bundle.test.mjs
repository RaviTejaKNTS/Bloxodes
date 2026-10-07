import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { decodeBundle } from "../content-bundle.mjs";
function encoded(paths) {
  const buffer = Buffer.from(JSON.stringify({version:1,batch:{},files:paths.map(path => ({path,base64:Buffer.from('content').toString('base64')}))}));
  return [buffer, createHash('sha256').update(buffer).digest('hex')];
}
test("private bundles require the exact approved bytes", () => {
  const [buffer, hash] = encoded(['final.json']);
  assert.equal(decodeBundle(buffer, hash).files.length, 1);
  assert.throws(() => decodeBundle(Buffer.concat([buffer,Buffer.from(' ')]),hash));
});
test("private bundles reject traversal, code, credentials and duplicate files", () => {
  for (const paths of [['../final.json'],['.env.json'],['script.mjs'],['final.json','final.json'],['batch.json']]) assert.throws(() => decodeBundle(...encoded(paths)));
});
