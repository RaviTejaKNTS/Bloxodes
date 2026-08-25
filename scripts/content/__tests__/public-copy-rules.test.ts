import assert from "node:assert/strict";
import test from "node:test";

import { scanPublicCopy } from "../public-copy-rules";

test("rejects public source and editorial narration", () => {
  const findings = scanPublicCopy(
    {
      content_md:
        "It follows PGG's Beta Update 1 ordering as an editorial recommendation, not a universal consensus.",
    },
    "runaways"
  );

  assert.ok(findings.some((finding) => finding.rule === "public competitor/source name"));
  assert.ok(findings.some((finding) => finding.rule === "public editorial disclaimer"));
});

test("rejects research workflow language across article fields", () => {
  const findings = scanPublicCopy(
    {
      meta_description: "A source-backed ranking after database checks.",
      faq_json: [{ q: "Why?", a: "According to the sources, this class wins." }],
    },
    "article"
  );

  assert.ok(findings.some((finding) => finding.rule === "public source or research workflow"));
  assert.ok(findings.some((finding) => finding.rule === "public source attribution"));
});

test("allows direct player advice and a normal in-game use of source", () => {
  const findings = scanPublicCopy(
    {
      content_md:
        "Pick Medic when your squad loses health faster than it can reset. The generator is your main power source during the night. Units are ranked by DPS.",
    },
    "article"
  );

  assert.deepEqual(findings, []);
});
