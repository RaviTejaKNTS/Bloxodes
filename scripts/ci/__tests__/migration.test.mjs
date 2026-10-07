import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { migrationBody } from "../migration-transaction.mjs";

test("comments and quoted function bodies cannot hide an internal commit", () => {
  assert.doesNotThrow(() => migrationBody("-- header\n BEGIN; do $$ begin perform 1; end $$; COMMIT; -- footer"));
  assert.throws(() => migrationBody("begin; select 1; commit; select 2; commit;"), /internal transaction/);
  assert.throws(() => migrationBody("select 'commit;'; /* nested /* comment */ */ COMMIT; select 1;"), /internal transaction/);
});
test("boundary wrappers are removed while data and function bodies stay intact", () => {
  const statement = "do $body$ begin perform 'semi;colon'; end $body$;";
  const body = migrationBody(`/* header */ BEGIN;\n${statement}\nCOMMIT;`);
  assert.ok(body.includes(statement));
  assert.ok(!body.includes("COMMIT"));
});
test("a real PostgreSQL rollback retains no migration objects", {skip: !process.env.CI_TRANSACTION_DATABASE_URL}, () => {
  const psql = sql => execFileSync("psql", [process.env.CI_TRANSACTION_DATABASE_URL, "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1"], {input:sql,encoding:"utf8"}).trim();
  const body = migrationBody("-- header\nbegin; create table ci_rollback_probe(id integer); commit; -- footer");
  psql(`begin; ${body}\nrollback;`);
  assert.equal(psql("select to_regclass('public.ci_rollback_probe') is null;"), "t");
  psql(`begin; ${body}\ncommit;`);
  assert.equal(psql("select to_regclass('public.ci_rollback_probe') is not null;"), "t");
  psql("drop table ci_rollback_probe;");
});
