import test from "node:test";
import assert from "node:assert/strict";
import { auditDataset, type Issue } from "../../collections/audit-game-collection-datasets-v2";

function labelIssues(fieldLabels?: unknown) {
  const issues: Issue[] = [];
  auditDataset("example-pets", "dataset.json", {
    meta: {
      schemaVersion: 2, itemFields: ["name", "price", "rarity", "obtainment", "cardSummary"], columns: ["name", "price", "rarity", "obtainment"],
      display: { tableFields: ["price", "rarity", "obtainment"], cardFields: ["price", "rarity", "obtainment"], cardDescriptionField: "cardSummary", sectionOrder: ["Items"], ...(fieldLabels !== undefined ? { fieldLabels } : {}) }
    },
    items: [{ item: { name: "Pet", price: "25 Coins", rarity: "Rare", obtainment: "Hatches from an egg.", cardSummary: "A companion." }, system: { slug: "pet", section: "Items", sortOrder: 10 } }]
  }, issues);
  return issues.filter(issue => /fieldLabels|Field label/.test(issue.message));
}

test("dataset labels are optional and accept plain game terminology for known item keys", () => {
  assert.deepEqual(labelIssues(), []);
  assert.deepEqual(labelIssues({ price: "Hatch Cost", obtainment: "How to Get It", name: "Pet Name" }), []);
  assert.deepEqual(labelIssues({}), []);
  assert.match(labelIssues({ missing: "Missing" })[0].message, /not listed in meta.itemFields/);
});

test("dataset labels reject wrong shapes, empty values, markup and multiline text", () => {
  for (const value of [null, [], "Hatch Cost", 42]) assert.ok(labelIssues(value).length, JSON.stringify(value));
  for (const value of ["", "  ", 42, null, "<b>Cost</b>", "**Cost**", "_Cost_", "`Cost`", "[Cost](https://example.com)", "Cost\nCoins", "Cost\u0000", "&lt;Cost&gt;"]) {
    assert.ok(labelIssues({ price: value }).length, JSON.stringify(value));
  }
});
