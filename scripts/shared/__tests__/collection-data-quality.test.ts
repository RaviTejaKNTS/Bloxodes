import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { isAchievementReference, usefulCollectionItemFields } from "../collection-data-quality";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

function dataset(fields: string[], items: Record<string, unknown>[], collection = "roster") {
  return {
    meta: {
      schemaVersion: 2, gameSlug: "example-game", collection,
      itemFields: ["name", ...fields], columns: ["name", ...fields],
      display: {
        tableFields: [...fields], cardFields: [...fields], sectionOrder: ["Items"],
        badgeField: null, subtitleFields: [] as string[],
        descriptionField: null as string | null, cardDescriptionField: null as string | null
      }
    },
    items: items.map((item, index) => ({item, system: {slug: `entry-${index + 1}`, section: "Items", sortOrder: index, image: null as string | null}}))
  };
}

function achievements() {
  const document = dataset(["condition", "visibility"], [
    {name: "First steps", condition: "Complete the tutorial", visibility: "Visible"},
    {name: "Hidden achievement", condition: null, visibility: "Hidden"}
  ], "achievements");
  document.meta.display.cardFields = ["visibility"];
  document.meta.display.descriptionField = "condition";
  document.meta.display.cardDescriptionField = "condition";
  return document;
}

function runGate(script: string, document: ReturnType<typeof dataset>, file: string) {
  fs.writeFileSync(file, JSON.stringify(document));
  const result = spawnSync(process.execPath, ["--import", "tsx", `scripts/collections/${script}`,
    "--game", document.meta.gameSlug, "--collection", document.meta.collection, "--file", file, "--json"
  ], {
    cwd: repoRoot, encoding: "utf8", timeout: 30_000,
    env: {PATH: process.env.PATH, BLOXODES_ENV_PROFILE: "process-only", NODE_ENV: "test"}
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, script);
  assert.ok(result.status === 0 || result.status === 1, `${script}: ${result.stderr}`);
  const report = JSON.parse(result.stdout);
  const errors = report.issues.filter((issue: {level: string}) => issue.level === "error") as Array<{message: string}>;
  return {status: result.status, errors, stderr: result.stderr};
}

test("achievement references allow visible conditions and generic hidden rows across games without images", () => {
  for (const game of ["example-game", "another-game"]) {
    const document = achievements();
    document.meta.gameSlug = game;
    assert.equal(isAchievementReference(document, `${game}-achievements`), true);
    document.items.pop();
    assert.equal(isAchievementReference(document, `${game}-achievements`), true);
  }
});

test("achievement exceptions reject malformed rows, other schemas and facts missing from either view", () => {
  const mutations: Array<[string, (document: ReturnType<typeof achievements>) => void]> = [
    ["invalid visibility", doc => { doc.items[0]!.item.visibility = "Public"; }],
    ["case-sensitive visibility", doc => { doc.items[0]!.item.visibility = "visible"; }],
    ["blank name", doc => { doc.items[0]!.item.name = " "; }],
    ...[null, "", "  ", 0, "123", false, [], {}, "Unknown", "N/A"].map((value): [string, (doc: ReturnType<typeof achievements>) => void] => [
      `invalid condition ${JSON.stringify(value)}`, doc => { doc.items[0]!.item.condition = value; }
    ]),
    ["hidden condition", doc => { doc.items[1]!.item.condition = "Unapproved detail"; }],
    ["hidden name", doc => { doc.items[1]!.item.name = "Unapproved name"; }],
    ["absent hidden condition", doc => { delete doc.items[1]!.item.condition; }],
    ["all hidden", doc => { doc.items.shift(); }],
    ["no rows", doc => { doc.items = []; }],
    ["extra row fact", doc => { doc.items[0]!.item.reward = "Unrelated"; }],
    ["extra declared fact", doc => { doc.meta.itemFields.push("reward"); }],
    ["duplicate column", doc => { doc.meta.columns = ["name", "condition", "condition"]; }],
    ["wrong collection", doc => { doc.meta.collection = "weapons"; }],
    ["invalid game slug", doc => { doc.meta.gameSlug = "Example Game"; }],
    ["old schema", doc => { doc.meta.schemaVersion = 1; }],
    ["table omits condition", doc => { doc.meta.display.tableFields = ["visibility"]; }],
    ["cards omit condition", doc => { doc.meta.display.cardDescriptionField = null; doc.meta.display.descriptionField = null; }],
    ["cards omit visibility", doc => { doc.meta.display.cardFields = ["condition"]; }]
  ];
  for (const [label, mutate] of mutations) {
    const document = achievements();
    mutate(document);
    assert.equal(isAchievementReference(document, "example-game-achievements"), false, label);
  }
  assert.equal(isAchievementReference(achievements(), "different-game-achievements"), false);
  assert.equal(isAchievementReference(achievements(), "example-game-weapons"), false);
});

test("system and identity fields never inflate the useful fact count while numeric gameplay facts remain", () => {
  assert.deepEqual(usefulCollectionItemFields([
    "name", "condition", "visibility", "slug", "image", "collectionSection",
    "sortOrder", "sort_order", "_sortOrder", "__sortOrder", "cardSummary", "condition"
  ]), ["condition", "visibility"]);
  assert.deepEqual(usefulCollectionItemFields(["name", "damage", "range", "price", "sortOrder"]), ["damage", "range", "price"]);
});

// Exercise both actual CLIs so the shared allowance cannot accidentally fix
// only one gate. These file-only fixtures never import or stage content.
test("audit and checker agree on achievement, thin, numbered-location and rich datasets", () => {
  const scratch = path.join(repoRoot, "tmp");
  fs.mkdirSync(scratch, {recursive: true});
  const root = fs.mkdtempSync(path.join(scratch, "collection-quality-test-"));
  const locationGuide = dataset(["guideNumber", "location"], Array.from({length: 10}, (_, index) => ({name: `Location ${index + 1}`, guideNumber: index + 1, location: `Inside room ${index + 1}`})), "locations");
  for (const row of locationGuide.items) row.system.image = "https://example.com/location.png";
  const invalidVisibility = achievements();
  invalidVisibility.items[0]!.item.visibility = "Public";
  const emptyCondition = achievements();
  emptyCondition.items[0]!.item.condition = " ";
  const revealedHidden = achievements();
  revealedHidden.items[1]!.item.condition = "Unapproved detail";
  const unpicturedGuide = structuredClone(locationGuide);
  unpicturedGuide.items[0]!.system.image = null;
  const shortGuide = structuredClone(locationGuide);
  shortGuide.items.pop();
  const wrongDisplay = achievements();
  wrongDisplay.meta.display.tableFields = ["name", "condition", "visibility"];
  const leakedField = achievements();
  leakedField.items[0]!.item.sourcePage = "https://example.com/evidence";
  const cases = [
    {label: "achievement reference before images", document: achievements(), passes: true},
    {label: "invalid visibility", document: invalidVisibility, passes: false},
    {label: "empty visible condition", document: emptyCondition, passes: false},
    {label: "revealed hidden condition", document: revealedHidden, passes: false},
    {label: "unrelated two-field roster with numeric sortOrder", document: dataset(["damage", "price"], [{name: "Weapon", damage: 12, price: 50}]), passes: false},
    {label: "normal rich numeric roster", document: dataset(["damage", "range", "price"], [{name: "Weapon", damage: 12, range: 30, price: 50}]), passes: true},
    {label: "image-backed numbered locations", document: locationGuide, passes: true},
    {label: "numbered locations missing one image", document: unpicturedGuide, passes: false},
    {label: "numbered locations below ten rows", document: shortGuide, passes: false},
    {label: "name repeated as display fact", document: wrongDisplay, passes: false},
    {label: "extra provenance item field", document: leakedField, passes: false}
  ];
  try {
    for (const [index, fixture] of cases.entries()) {
      const file = path.join(root, `${index}.json`);
      for (const script of ["audit-game-collection-datasets-v2.ts", "check-game-collection-data.ts"]) {
        const label = `${script}: ${fixture.label}`;
        const {status, errors, stderr} = runGate(script, fixture.document, file);
        assert.equal(status, fixture.passes ? 0 : 1, `${label}: ${JSON.stringify(errors)} ${stderr}`);
        assert.equal(errors.length === 0, fixture.passes, label);
        if (fixture.label === "unrelated two-field roster with numeric sortOrder") {
          assert.ok(errors.some(issue => /only 2 useful/.test(issue.message)), label);
          assert.ok(errors.every(issue => !/sortOrder/.test(issue.message)), label);
        }
      }
    }
    const guarded = achievements();
    Object.assign(guarded.items[0]!.system, {unsupported: "internal value"});
    assert.equal(isAchievementReference(guarded, "example-game-achievements"), true);
    const result = runGate("audit-game-collection-datasets-v2.ts", guarded, path.join(root, "system-guard.json"));
    assert.equal(result.status, 1);
    assert.ok(result.errors.some(issue => /unsupported system key/.test(issue.message)));
    assert.ok(result.errors.every(issue => !/only 2 useful/.test(issue.message)));
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});
