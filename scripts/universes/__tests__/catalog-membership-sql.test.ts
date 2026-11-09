import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

test("catalog dates follow visible membership across statement writes", {
  skip: process.env.CI !== "true" || !process.env.CI_TRANSACTION_DATABASE_URL
}, () => {
  const url = new URL(process.env.CI_TRANSACTION_DATABASE_URL!);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname) && url.search === "");
  const migration = readFileSync(new URL("../../../supabase/migrations/20261109123156_catalog_dates_follow_membership.sql", import.meta.url), "utf8");
  const chartMigration = readFileSync(new URL("../../../supabase/migrations/20261109124321_catalog_chart_membership_dates.sql", import.meta.url), "utf8");
  const futureMigration = readFileSync(new URL("../../../supabase/migrations/20261109125128_catalog_membership_future_page_guards.sql", import.meta.url), "utf8");
  const fixture = readFileSync(new URL("../../../supabase/tests/catalog_membership.sql", import.meta.url), "utf8");
  const [setup, assertions] = fixture.split("-- APPLY MIGRATION HERE");
  assert.ok(assertions);
  execFileSync("psql", [url.toString(), "-X", "-v", "ON_ERROR_STOP=1", "-q"], {
    input: `begin;\n${setup}\n${migration}\n${chartMigration}\n${futureMigration}\n${assertions}\nrollback;`,
    encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 60_000,
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PG")))
  });
});
