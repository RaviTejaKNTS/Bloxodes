import assert from "node:assert/strict";
import test from "node:test";
import { verifiedMigrationHashes } from "../migration-byte-proof.mjs";

const version = "20261007000001";
const hash = "a".repeat(64);
const migration = {version,hash};
test("an applied version cannot certify changed SQL or an empty ledger record", () => {
  assert.deepEqual(verifiedMigrationHashes([migration],[{version,sql_hash: hash}],{}),[migration]);
  assert.throws(() => verifiedMigrationHashes([{version,hash: "b".repeat(64)}],[{version,sql_hash: hash}],{}),/cannot be proven/);
  assert.throws(() => verifiedMigrationHashes([migration],[{version,sql_hash: null}],{}),/cannot be proven/);
  assert.deepEqual(verifiedMigrationHashes([migration],[],{}),[]);
});
test("audited historical formatting requires both pinned hashes", () => {
  const source = "b".repeat(64);
  const policy = {managed_dev_sql_equivalences: [{version,local_sha256: hash,source_sha256: source,reason: "Only comments changed in the audited historical record."}]};
  assert.deepEqual(verifiedMigrationHashes([migration],[{version,sql_hash: source}],policy),[migration]);
  assert.throws(() => verifiedMigrationHashes([{version,hash: "c".repeat(64)}],[{version,sql_hash: source}],policy),/historical migration byte proof/);
  assert.throws(() => verifiedMigrationHashes([migration],[{version,sql_hash: "c".repeat(64)}],policy),/cannot be proven/);
});
