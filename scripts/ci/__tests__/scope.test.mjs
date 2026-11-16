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
});

test("managed development runs only for migration SQL or migration policy", () => {
  for (const file of ["supabase/migrations/20261116123456_add_field.sql", "supabase/migration-policy.json"]) assert.equal(classify([file]).migrations, true);
  for (const file of ["apps/web/src/lib/db.ts", "scripts/ci/change-scope.mjs", ".github/workflows/pull-request.yml", "supabase/types/shared-games.ts"]) assert.equal(classify([file]).migrations, false);
});
const specs = files => classify(files).browser_specs.split(" ").map(file => file.match(/([^/]+)\.spec\.ts$/)?.[1]).filter(Boolean);
test("article and stats routes keep smoke and route parity while skipping catalog regression", () => {
  for (const file of ["apps/web/src/app/(site)/articles/[slug]/page.tsx", "apps/web/src/app/(site)/stats/page-data.ts"]) {
    assert.deepEqual(specs([file]), ["release-smoke", "ci-data-source", "site-route-parity"]);
    assert.equal(classify([file]).catalog_regression, false);
  }
});
test("game routes include the registry and specialized route suites", () => {
  assert.deepEqual(specs(["apps/web/src/app/(site)/wiki/[slug]/page.tsx"]), ["release-smoke", "ci-data-source", "site-route-parity", "shared-game-registry", "game-page-type-urls", "specialized-franchise-page-type-urls"]);
  assert.equal(classify(["apps/web/src/app/(site)/wiki/[slug]/page.tsx"]).catalog_regression, false);
});
test("catalog changes include covers, routes and the catalog regression", () => {
  for (const file of ["apps/web/src/app/(site)/catalog/roblox-music-ids/page.tsx", "apps/web/src/app/api/roblox-decal-ids/route.ts", "apps/web/src/app/catalog-image/[...slug]/route.ts"]) {
    assert.equal(classify([file]).catalog_regression, true);
    assert.ok(specs([file]).includes("catalog-covers"));
  }
});
test("shared dependencies and unknown web paths fail safe to all specs", () => {
  const full = specs([".github/workflows/pull-request.yml"]);
  assert.equal(full.length, 7);
  for (const file of ["apps/web/src/app/(site)/layout.tsx", "apps/web/src/app/layout.tsx", "apps/web/src/lib/wiki.ts", "apps/web/src/components/Card.tsx", "apps/web/src/app/(site)/unclassified/page.tsx", "apps/web/src/app/api/new/route.ts", "apps/web/next.config.js", "playwright.config.ts", "tsconfig.json", "eslint.config.mjs", ".browserslistrc", ".npmrc", ".node-version", "middleware.ts", "proxy.ts", "package.json", "package-lock.json", "scripts/ci/data-query.mjs", "scripts/ci/fixtures/pages.json", "data/local.json", "env/config.json", "Dockerfile"]) {
    assert.deepEqual(specs([file]), full, file);
    assert.equal(classify([file]).catalog_regression, true, file);
  }
});
test("mixed changes take the union and docs or other apps select no browser work", () => {
  assert.equal(classify(["AGENTS.md"]).browser_specs, "");
  assert.equal(classify(["apps/mobile/app/index.tsx"]).browser_specs, "");
  assert.equal(classify(["apps/web/src/app/(site)/articles/page.tsx", "scripts/ci/data-query.mjs"]).browser_specs, classify(["scripts/ci/data-query.mjs"]).browser_specs);
});

test("root TypeScript configuration verifies every affected app", () => {
  const scope = classify(["tsconfig.json"]);
  for (const app of ["web", "extension", "admin", "mobile"]) assert.equal(scope[app], true, app);
});
