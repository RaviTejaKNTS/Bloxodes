import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { newCollectionImageKeys } from "../publish-image-baseline";
import { selectLiveImages } from "../publish-network.mjs";

for (const family of ["wiki", "game"] as const) {
  test(`${family}: first publish and failed-live-check rerun select the same new keys without uploads`, async () => {
    for (const rerun of [false, true]) {
      const requestedDatasets: string[] = [];
      const db = createClient("https://target.supabase.co", "test-key", { global: { fetch: async input => {
        const url = new URL(String(input));
        let data: unknown;
        if (url.pathname.endsWith(`${family}_collection_pages`)) {
          assert.equal(url.searchParams.get("namespace"), family === "game" ? "eq.example" : null);
          data = { id: "page", is_published: true, published_dataset_id: rerun ? "new" : "old" };
        }
        else if (url.pathname.endsWith(`${family}_collection_datasets`)) {
          if (url.searchParams.has("collection_page_id")) {
            assert.equal(url.searchParams.get("collection_page_id"), "eq.page");
            assert.equal(url.searchParams.get("created_at"), "lt.2026-11-18T00:00:00Z");
            assert.equal(url.searchParams.get("order"), "created_at.desc");
            data = { id: "old" };
          } else data = { id: rerun ? "new" : "old", content_hash: rerun ? "bundle" : "previous", created_at: "2026-11-18T00:00:00Z" };
        } else {
          requestedDatasets.push(url.searchParams.get("dataset_id")!);
          data = [{ image_key: "old.png" }, { image_key: null }];
        }
        return new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
      } } });
      const keys = await newCollectionImageKeys(db, family, "page-code", "bundle", [{ image_key: "old.png" }, { image_key: "new.png" }, { image_key: "new.png" }, { image_key: null }], family === "game" ? "example" : undefined);
      assert.deepEqual(requestedDatasets, ["eq.old"]);
      assert.deepEqual(keys, ["new.png"]);
      assert.deepEqual(selectLiveImages({ expectedImages: ["old.png", "new.png", "cover.png", "hero.png"], changedImages: [...keys, "cover.png", "hero.png"] }), ["new.png", "cover.png", "hero.png"]);
    }
  });

  test(`${family}: first revision rerun checks all keys and paginated baselines retain old keys`, async () => {
    for (const firstRevision of [true, false]) {
      let itemReads = 0;
      const db = createClient("https://target.supabase.co", "test-key", { global: { fetch: async input => {
        const url = new URL(String(input));
        let data: unknown;
        if (url.pathname.endsWith("_pages")) data = { id: "page", is_published: true, published_dataset_id: "new" };
        else if (url.pathname.endsWith("_datasets")) data = url.searchParams.has("collection_page_id") ? firstRevision ? null : { id: "old" } : { id: "new", content_hash: "bundle", created_at: "2026-11-18" };
        else data = ++itemReads === 1 ? Array.from({ length: 500 }, (_, i) => ({ image_key: `old-${i}` })) : [{ image_key: "last-old" }];
        return new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
      } } });
      const keys = await newCollectionImageKeys(db, family, "code", "bundle", [{ image_key: "old-0" }, { image_key: "last-old" }, { image_key: "new" }], family === "game" ? "example" : undefined);
      assert.deepEqual(keys, firstRevision ? ["old-0", "last-old", "new"] : ["new"]);
      assert.equal(itemReads, firstRevision ? 0 : 2);
    }
  });
}
