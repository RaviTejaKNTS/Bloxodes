import assert from "node:assert/strict";
import test from "node:test";
import { classify } from "../change-scope.mjs";

test("guidance changes skip dependency installation and builds", () => {
  const scope = classify(["AGENTS.md", "apps/web/src/lib/AGENTS.md", ".agents/skills/example/SKILL.md", "bloxodes-docs/operations/release.md"]);
  assert.equal(scope.checks, false);
  assert.equal(scope.web, false);
});
test("schema changes receive checks and web compatibility verification", () => {
  const scope = classify(["supabase/migrations/20261007123456_add_field.sql"]);
  assert.equal(scope.schema, true);
  assert.equal(scope.web, true);
});
test("mobile-only changes avoid web and extension builds", () => {
  const scope = classify(["apps/mobile/app/index.tsx"]);
  assert.equal(scope.mobile, true);
  assert.equal(scope.web, false);
  assert.equal(scope.extension, false);
  assert.equal(scope.statsPrepared, false);
});
test("prepared chart readers, worker, runtime and schema receive database verification", () => {
  for (const file of ["apps/web/src/lib/stats.ts", "scripts/shared/prepared-charts-worker.mjs",
    "scripts/ops/stats-chart-runtime.mjs", "supabase/migrations/20261023100441_stats_prepared_charts_v1.sql",
    ".github/workflows/pull-request.yml", "apps/web/src/app/api/revalidate/route.ts"]) {
    assert.equal(classify([file]).statsPrepared, true, file);
  }
  assert.equal(classify(["apps/web/src/lib/catalog.ts"]).statsPrepared, false);
  assert.equal(classify(["bloxodes-docs/content/stats.md"]).statsPrepared, false);
});
test("selected-page code reads require the bounded backend compatibility probe", () => {
  for (const file of ["apps/web/src/lib/db.ts", "apps/web/src/lib/extension-codes.ts",
    "apps/web/src/lib/__tests__/code-lookups.test.ts", "scripts/ci/code-lookups-qa.mjs",
    ".github/workflows/pull-request.yml"]) {
    assert.equal(classify([file]).codeLookups, true, file);
  }
  assert.equal(classify(["apps/web/src/lib/catalog.ts"]).codeLookups, false);
  assert.equal(classify(["bloxodes-docs/content/codes.md"]).codeLookups, false);
});
