import assert from "node:assert/strict";
import test from "node:test";

import { checkArticleMedia } from "../check-article-media";

test("requires the tier-list component for tier-list articles", async () => {
  const findings = await checkArticleMedia({
    title: "Runaways best class tier list",
    slug: "runaways-best-class-tier-list",
    content_md: "## S Tier\n\n| Class | Role |\n|---|---|\n| Medic | Support |",
    requireLocalFiles: false,
  });

  assert.ok(findings.some((finding) => finding.rule === "missing-tier-list-component"));
});

test("accepts a text-only tier-list component", async () => {
  const findings = await checkArticleMedia({
    title: "Runaways best class tier list",
    slug: "runaways-best-class-tier-list",
    content_md: [
      "```tier-list",
      "schema: 1",
      "id: runaways-classes",
      "title: Runaways classes ranked",
      "tiers:",
      "  - rank: S",
      "    items:",
      "      - name: Medic",
      "```",
      "",
      "## S Tier",
      "",
      "Choose S tier when your squad needs the most forgiving clear.",
      "",
      "| Class | Best use |",
      "|---|---|",
      "| Medic | Keeping a full squad alive |",
      "",
      "Medic converts a teammate's mistake into recoverable time instead of a lost run.",
    ].join("\n"),
    requireLocalFiles: false,
  });

  assert.equal(findings.filter((finding) => finding.level === "error").length, 0);
});
