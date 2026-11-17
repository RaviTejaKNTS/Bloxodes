import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { verifyStaticBatch } from "../content-static-contract.mjs";

test("static batch check needs no database and rejects missing, malformed or unsafe inputs", () => {
  const base="content/releases/ci-static-contract-test";
  fs.mkdirSync(base,{recursive:true});
  const batch={version:1,operations:[{publisher:"roblox-codes-page",file:"final.json"}],urls:[{path:"/codes/trail",contains:"Trail"}],events:[{type:"code",slug:"trail"}]};
  const tracked=()=>{};
  try {
    fs.writeFileSync(`${base}/batch.json`,JSON.stringify(batch));
    assert.throws(()=>verifyStaticBatch(`${base}/batch.json`,{tracked}),/ENOENT/);
    fs.writeFileSync(`${base}/final.json`,JSON.stringify({slug:"trail"}));
    assert.equal(verifyStaticBatch(`${base}/batch.json`,{tracked}).operations.length,1);
    fs.writeFileSync(`${base}/final.json`,"{");assert.throws(()=>verifyStaticBatch(`${base}/batch.json`,{tracked}),SyntaxError);
    fs.writeFileSync(`${base}/final.json`,JSON.stringify({slug:"unsafe/slug"}));assert.throws(()=>verifyStaticBatch(`${base}/batch.json`,{tracked}),/editorial slug/);
    fs.rmSync(`${base}/final.json`);fs.symlinkSync("batch.json",`${base}/final.json`);assert.throws(()=>verifyStaticBatch(`${base}/batch.json`,{tracked}),/symlink/);
  } finally {fs.rmSync(base,{recursive:true,force:true});}
});
