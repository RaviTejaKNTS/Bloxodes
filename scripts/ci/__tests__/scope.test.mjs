import assert from "node:assert/strict";
import test from "node:test";
import { classify } from "../change-scope.mjs";

test("guidance changes skip dependency installation and builds", () => {
  const scope = classify(["AGENTS.md", "apps/web/src/lib/AGENTS.md", ".agents/skills/example/SKILL.md", "dev-docs/operations/deployment.md"]);
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
});
