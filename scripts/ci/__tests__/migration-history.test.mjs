import assert from "node:assert/strict";
import test from "node:test";
import { historyRepairs, repairHistorySql } from "../migration-history.mjs";

const alias = { version: "20260920000021", source_version: "20260902122707", source_sha256: "a".repeat(64), local_sha256: "b".repeat(64), reason: "Verified connector SQL and retirement." };
const local = [{version: alias.version, name: "remove_unused_gta_tools", hash: alias.local_sha256}];
const ledger = [{version: alias.source_version, name: local[0].name, sql_hash: alias.source_sha256}, {version: "20261006074815"}];

test("repair adds canonical history while preserving original SQL evidence", () => {
  const repairs = historyRepairs([alias], local, ledger);
  assert.equal(repairs.length, 1);
  const sql = repairHistorySql(repairs).join("\n");
  assert.match(sql, /insert into supabase_migrations.schema_migrations/);
  assert.match(sql, /select '20260920000021',name,statements/);
  assert.match(sql, /E'\\n'/);
  assert.ok(!sql.includes("drop table"));
  assert.ok(!sql.includes("delete from"));
  assert.match(sql, /Migration-history current-object proof failed/);
});
test("missing source executes normally and existing canonical history is untouched", () => {
  assert.deepEqual(historyRepairs([alias], local, []), []);
  assert.deepEqual(historyRepairs([alias], local, [...ledger, {version: alias.version}]), []);
});
test("changed evidence or absent retirement blocks history repair", () => {
  assert.throws(() => historyRepairs([alias], [{...local[0], hash: "c".repeat(64)}], ledger), /local proof changed/);
  assert.throws(() => historyRepairs([alias], local, [{...ledger[0], sql_hash: "c".repeat(64)}, ledger[1]]), /source proof changed/);
  assert.throws(() => historyRepairs([alias], local, [ledger[0]]), /retirement/);
  assert.throws(() => historyRepairs([alias, alias], local, ledger), /Invalid audited/);
});
