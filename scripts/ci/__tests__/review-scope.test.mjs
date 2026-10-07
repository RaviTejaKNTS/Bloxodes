import assert from "node:assert/strict";
import test from "node:test";
import { needsCodexReview, selectCodexReview } from "../review-scope.mjs";

const ready = {
  eventName: "pull_request", eventAction: "opened", draft: false, state: "open",
  baseBranch: "production", baseRepository: "owner/repo", headRepository: "owner/repo",
  files: ["apps/web/src/app/page.tsx"]
};

test("guidance and private skill resources avoid paid reviews", () => {
  assert.equal(needsCodexReview(["README.md", "AGENTS.md", "scripts/AGENTS.md", "docs/release.md", "dev-docs/operations/deployment.md", ".agents/skills/example/scripts/helper.py"]), false);
});

test("each executable release surface receives a review, including mixed PRs", () => {
  for (const file of ["apps/web/src/app/page.tsx", "apps/mobile/package.json", "apps/extension/manifest.json", "scripts/wiki/publish.ts", "workers/wiki-media/src/index.ts", "workers/wiki-media/wrangler.jsonc", "one-off-scripts/repair.ts", "supabase/migrations/20261007123456_add.sql", "package-lock.json", ".github/workflows/publish.yml", ".github/codex/review.md", "Dockerfile", "Dockerfile.stats-worker", "env/config.json", "data/recipes.json", "t3.json", "next.config.ts"]) {
    assert.equal(needsCodexReview(["docs/release.md", file]), true, file);
  }
});

test("public MDX and renamed runtime sources cannot be disguised as guidance", () => {
  assert.equal(needsCodexReview(["apps/web/src/app/guide.mdx"]), true);
  assert.equal(needsCodexReview(["new-runtime/worker.ts"]), true);
  // The API scope includes both names of a moved file.
  assert.equal(needsCodexReview(["docs/retired.md", "scripts/retired.ts"]), true);
});

test("ready PRs review once and fixes need an explicit fresh review", () => {
  for (const eventAction of ["opened", "ready_for_review", "reopened"]) {
    assert.equal(selectCodexReview({ ...ready, eventAction }).review, true);
  }
  assert.equal(selectCodexReview({ ...ready, eventAction: "synchronize" }).review, false);
  assert.equal(selectCodexReview({ ...ready, eventName: "workflow_dispatch", eventAction: undefined }).review, true);
});

test("manual dispatch cannot bypass draft, fork, closed or docs-only boundaries", () => {
  for (const change of [{ draft: true }, { state: "closed" }, { baseBranch: "feature" }, { headRepository: "outsider/fork" }, { headRepository: null }, { files: ["docs/release.md"] }]) {
    assert.equal(selectCodexReview({ ...ready, eventName: "workflow_dispatch", ...change }).review, false);
  }
});
