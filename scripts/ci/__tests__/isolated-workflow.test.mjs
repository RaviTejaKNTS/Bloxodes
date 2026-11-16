import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workflow=fs.readFileSync(new URL("../../../.github/workflows/pull-request.yml",import.meta.url),"utf8");
const checks=workflow.split("\n  checks:\n")[1].split("\n  required:\n")[0];
test("ordinary code checks have no managed credentials, dependency or shared concurrency lane",()=>{
  assert.doesNotMatch(checks,/secrets\.|needs:.*managed-development|concurrency:|bloxodes-pr-checks/);
  assert.match(checks,/needs: scope/);
  assert.match(checks,/SUPABASE_URL: http:\/\/127\.0\.0\.1:54321/);
  assert.match(checks,/0\.0\.0\.0 bbtcaurrtyoukvjbxbbj\.supabase\.co/);
  for(const flag of ["--ready","--build","--audit"]) assert.ok(checks.includes(`assert-isolated-data.mjs ${flag}`));
});
test("schema checks run alongside code checks only for migration scope",()=>{
  const managed=workflow.split("\n  managed-development:\n")[1].split("\n  checks:\n")[0];
  assert.match(managed,/if: needs\.scope\.outputs\.migrations == 'true'/);
  assert.match(workflow,/if \[ "\$MIGRATIONS" = true \]; then test "\$MANAGED" = success; else test "\$MANAGED" = skipped; fi/);
  assert.match(workflow,/name: Required PR checks/);
  assert.match(checks,/npm run supabase:migrations:check/);
});
test("cleanup and all managed content QA jobs share the content lane",()=>{
  const cleanup=fs.readFileSync(new URL("../../../.github/workflows/managed-dev-cleanup.yml",import.meta.url),"utf8");
  const qa=fs.readFileSync(new URL("../../../.github/workflows/managed-content-qa.yml",import.meta.url),"utf8");
  assert.match(cleanup,/group: bloxodes-managed-content-qa/);
  assert.match(qa,/group: bloxodes-managed-content-qa/);
  for(const name of ["selected-franchise-development-qa","selected-roblox-development-qa"]) assert.match(workflow.split(`\n  ${name}:\n`)[1],/group: bloxodes-managed-content-qa/);
});
test("PR content verification imports only the static contract and never invokes publishers",()=>{
  const verifier=fs.readFileSync(new URL("../verify-content-batches.ts",import.meta.url),"utf8");
  assert.match(verifier,/verifyStaticBatch\(batch\)/);
  assert.doesNotMatch(verifier,/publish-content|--managed|createClient|supabaseAdmin/);
});

test("non-web app checks do not require web fixture reads",()=>{
  assert.match(checks,/name: Prove all data requests stayed in CI\n        if: always\(\) && needs\.scope\.outputs\.web == 'true'/);
});
