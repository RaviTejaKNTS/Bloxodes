import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

function checkCopy(value: unknown) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "bloxodes-public-copy-"));
  try {
    const file = path.join(dir, "final.json");
    writeFileSync(file, JSON.stringify(value));
    const childEnv = { ...process.env };
    delete childEnv.NODE_TEST_CONTEXT;
    return spawnSync(process.execPath, [
      "--import", "tsx", "scripts/content/check-public-copy.ts", file
    ], { cwd: path.resolve(import.meta.dirname, "../../.."), env: childEnv, encoding: "utf8" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("article orientation and useful developer attribution pass the copy gate", () => {
  const result = checkCopy({
    title: "How to Find Island Secrets", slug: "island-secrets",
    content_md: "This guide covers island puzzles. The developer's announcement explains how secret levels work.",
    faq_json: []
  });
  assert.equal(result.status, 0, result.stderr);
});

test("catalog finals retain their stricter self-reference gate", () => {
  const result = checkCopy({
    title: "Fruit Catalog", slug: "fruit-catalog", intro_md: "This guide lists the available fruits."
  });
  assert.equal(result.status, 1);
});

test("article body and FAQs still reject internal dataset framing", () => {
  const result = checkCopy({
    title: "Fruit Abilities", slug: "fruit-abilities",
    content_md: "This dataset lists the fruit abilities.",
    faq_json: [{ q: "Where are abilities?", a: "Check this database." }]
  });
  assert.equal(result.status, 1);
});

test("article FAQs have one visible home and cannot duplicate body headings", () => {
  for (const content_md of ["## Fisch Appraisal FAQ\n### Is it worth it?\nSometimes.", "## Is It Worth It?\nSometimes."]) {
    const result = checkCopy({ title: "Fisch Appraisal", slug: "fisch-appraisal", content_md, faq_json: [{ q: "Is it worth it?", a: "Sometimes." }] });
    assert.equal(result.status, 1); assert.match(result.stderr, /article FAQ placement/);
  }
  assert.equal(checkCopy({ title: "Fisch Appraisal", slug: "fisch-appraisal", content_md: "## Fisch Appraisal Cost\nIt costs 450 C$.", faq_json: [{ q: "Can I undo it?", a: "No." }] }).status, 0);
});
