import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { newCollectionImageKeys } from "../publish-image-baseline";
import { selectLiveImages } from "../publish-network.mjs";

for (const family of ["wiki", "game"] as const) {
  const namespace = family === "game" ? "example" : undefined;
  for (const scenario of [
    { name: "first publish checks only keys absent from the live revision", live: "old", expected: ["new.png"] },
    { name: "rerun after a failed live check checks every page key", live: "bundle", expected: ["old.png", "new.png"] },
    { name: "unpublished intermediate revision has no effect", live: "old", expected: ["new.png"] },
    { name: "republishing an older revision compares only against the live revision", live: "newer", expected: ["old.png"] },
  ]) {
    test(`${family}: ${scenario.name}`, async () => {
      let live = scenario.live;
      const requests: URL[] = [];
      const datasets = [
        { id: "old", content_hash: "old", created_at: "2026-11-01" },
        { id: "staged", content_hash: "staged", created_at: "2026-11-02" },
        { id: "bundle", content_hash: "bundle", created_at: "2026-11-03" },
        { id: "newer", content_hash: "newer", created_at: "2026-11-04" },
      ];
      const db = createClient("https://target.supabase.co", "test-key", { global: { fetch: async input => {
        const url = new URL(String(input));
        requests.push(url);
        let data: unknown;
        if (url.pathname.endsWith("_pages")) {
          data = { is_published: true, published_dataset_id: live };
        } else if (url.pathname.endsWith("_datasets")) {
          data = datasets.find(row => `eq.${row.id}` === url.searchParams.get("id")) ?? { id: "staged" };
        } else {
          // The staged revision already contains both keys, but was never live.
          const id = url.searchParams.get("dataset_id");
          data = id === "eq.old" ? [{ image_key: "old.png" }, { image_key: null }]
            : id === "eq.newer" ? [{ image_key: "new.png" }]
            : [{ image_key: "old.png" }, { image_key: "new.png" }];
        }
        return new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
      } } });
      const readKeys = () => newCollectionImageKeys(db, family, "page-code", "bundle", [{ image_key: "old.png" }, { image_key: "new.png" }, { image_key: "new.png" }, { image_key: null }], namespace);
      if (scenario.live === "bundle") {
        // Publication updated the pointer, then its live check failed.
        live = "old";
        assert.deepEqual(await readKeys(), ["new.png"]);
        live = "bundle";
        requests.length = 0;
      }
      const keys = await readKeys();
      assert.deepEqual(keys, scenario.expected);
      assert.deepEqual(selectLiveImages({ expectedImages: ["old.png", "new.png", "cover.png", "hero.png"], changedImages: [...keys, "cover.png", "hero.png"] }), [...scenario.expected, "cover.png", "hero.png"]);
      assert.equal(requests[0].searchParams.get("namespace"), family === "game" ? "eq.example" : null);
      const datasetReads = requests.filter(url => url.pathname.endsWith("_datasets"));
      assert.equal(datasetReads.length, 1);
      assert.equal(datasetReads[0].searchParams.get("id"), `eq.${live}`);
      assert.equal(datasetReads[0].searchParams.has("created_at"), false);
      const itemReads = requests.filter(url => url.pathname.endsWith("_items"));
      assert.deepEqual(itemReads.map(url => url.searchParams.get("dataset_id")), live === "bundle" ? [] : [`eq.${live}`]);
    });
  }

  test(`${family}: unpublished pages check all keys and live baselines read every item page`, async () => {
    for (const published of [false, true]) {
      let itemReads = 0;
      const db = createClient("https://target.supabase.co", "test-key", { global: { fetch: async input => {
        const url = new URL(String(input));
        let data: unknown;
        if (url.pathname.endsWith("_pages")) data = { is_published: published, published_dataset_id: "old" };
        else if (url.pathname.endsWith("_datasets")) data = { id: "old", content_hash: "old" };
        else data = ++itemReads === 1 ? Array.from({ length: 500 }, (_, i) => ({ image_key: `old-${i}` })) : [{ image_key: "last-old" }];
        return new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
      } } });
      const keys = await newCollectionImageKeys(db, family, "code", "bundle", [{ image_key: "old-0" }, { image_key: "last-old" }, { image_key: "new" }], namespace);
      assert.deepEqual(keys, published ? ["new"] : ["old-0", "last-old", "new"]);
      assert.equal(itemReads, published ? 2 : 0);
    }
  });
}
