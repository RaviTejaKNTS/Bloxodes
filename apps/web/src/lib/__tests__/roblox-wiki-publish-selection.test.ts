import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CollectionPlan, CollectionSource } from "../../../../../scripts/collections/sync-game-collection-runtime";
import { publishBundle } from "../../../../../scripts/content/roblox-wiki-publish";

const state = vi.hoisted(() => ({ plan: null as CollectionPlan | null, events: [] as string[], registry: vi.fn(), universe: vi.fn(), apply: vi.fn() }));
const copy = (plan: CollectionPlan) => ({ title: "All 1 Pets in Example", seo_title: "All 1 Pets in Example", wiki_sort_order: plan.config.sortOrder });

vi.mock("server-only", () => ({}));
vi.mock("../../../../../scripts/shared/load-env", () => ({}));
vi.mock("../../../../../scripts/shared/local-content-publication-guard", () => ({ assertLocalContentPublication: vi.fn() }));
vi.mock("../../../../../scripts/shared/roblox-wiki-universe", () => ({ ensureContentUniverse: (...args: unknown[]) => state.universe(...args) }));
vi.mock("../../../../../scripts/content/check-public-copy", () => ({ publicCopyFindings: () => [] }));
vi.mock("../../../../../scripts/content/roblox-collection-copy", () => ({ assertRobloxCollectionCopy: () => {} }));
vi.mock("../../../../../scripts/collections/audit-game-collection-datasets-v2", () => ({ auditDataset: () => {} }));
vi.mock("../../../../../scripts/collections/sync-game-wiki-runtime", () => ({ readFinal: () => { throw new Error("Unselected hub was read"); } }));
vi.mock("../../../../../scripts/shared/r2-client", () => ({ loadR2ClientConfig: () => ({ bucket: "bloxodes-wiki" }), R2Client: class {} }));
vi.mock("@/lib/wiki-media", () => ({ resolveWikiMediaUrl: (key: string) => `https://media.bloxodes.com/wiki/${key}` }));
vi.mock("@/lib/game-collections/registry", () => ({ readGameCollectionGroups: async () => [{
  gameSlug: "example", gameName: "Example", universeId: 123, universeNames: ["Example"], sortOrder: 1000, collections: ["boats"],
  collectionConfigs: [{ slug: "boats", sortOrder: 1010 }]
}] }));
vi.mock("../../../../../scripts/collections/sync-game-collection-runtime", () => ({
  targetSources: async ([file]: string[]) => [{
    config: { code: "example-pets", gameSlug: "example", gameName: "Example", slug: "pets", label: "Pets", sortOrder: 0, universeNames: ["Example"] },
    universeId: 123, pageType: "database", datasetPath: path.join(path.dirname(file), "dataset.json"), finalJsonPath: path.join(path.dirname(file), "final.json")
  }],
  planCollection: async (source: CollectionSource) => ({
    ...source, contentHash: "hash", metaJson: {}, validationJson: { duplicateSlugCount: 0, repairedSlugCount: 0 },
    items: [{ item_slug: "pet", item_name: "Pet", fields_json: { price: "25 Coins" }, image_key: null }]
  } as unknown as CollectionPlan),
  pageCopyFromFinal: (plan: CollectionPlan) => copy(plan),
  uploadPlanMedia: async (plan: CollectionPlan) => { state.events.push(`upload:${plan.config.slug}`); },
  verifyPlanMedia: async () => {},
  applyPlan: async (plan: CollectionPlan) => { state.events.push(`apply:${plan.config.slug}`); state.plan = plan; state.apply(plan); }
}));
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: () => ({
  from: (table: string) => {
    if (table === "wiki_pages") return { select: () => ({ or: async () => ({ data: [], error: null }) }) };
    const query = {
      select: () => query, eq: () => query, order: () => query,
      or: async () => ({ data: [], error: null }),
      single: async () => {
        const plan = state.plan!;
        if (table === "wiki_collection_pages") return { error: null, data: {
          ...copy(plan), id: "page", published_dataset_id: "revision", universe_id: 123, wiki_slug: "example", collection_slug: "pets", code: "example-pets", page_type: "database", is_published: true, item_count: 1
        } };
        if (table === "wiki_collection_datasets") return { error: null, data: { collection_page_id: "page", content_hash: "hash", schema_version: 2, item_count: 1, meta_json: {} } };
        throw new Error(`Unexpected table: ${table}`);
      },
      range: async () => ({ data: state.plan!.items, error: null })
    };
    return query;
  },
  rpc: (name: string, payload: Record<string, unknown>) => {
    state.registry(name, payload);
    return { single: async () => ({ error: null, data: {
      game_slug: "example", game_name: "Example", universe_id: 123, universe_names: ["Example"],
      collections: [{ slug: "boats", label: "Boats", sortOrder: 1010, pageType: "database" }, ...(payload.p_collections as object[])]
    } }) };
  }
}) }));

let root: string;
beforeEach(async () => {
  vi.clearAllMocks();
  state.plan = null;
  state.events = [];
  state.universe.mockImplementation(async (_db: unknown, _id: number, apply: boolean) => {
    if (apply) state.events.push("import");
    return apply ? { universe_id: 123 } : null;
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "table").mockImplementation(() => {});
  root = path.resolve(import.meta.dirname, "../../../../../tmp", `publish-selection-${randomUUID()}`);
  const folder = path.join(root, "pets");
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(root, "bundle.json"), JSON.stringify({
    contract: "roblox-wiki@1", game: { slug: "example", name: "Example", universeId: 123, universeNames: ["Example"] },
    hub: { finalJson: "unfinished-hub.json" }, collections: [
      { manifest: "pets/manifest.json", missingImages: [{ slug: "pet", reason: "No exact image available." }] },
      { manifest: "unfinished-boats.json" }, { manifest: "missing-manifest.json" }
    ]
  }));
  await fs.writeFile(path.join(root, "unfinished-boats.json"), JSON.stringify({ collection: { slug: "boats" } }));
  await fs.writeFile(path.join(folder, "manifest.json"), JSON.stringify({
    schemaVersion: 1, game: { slug: "example", name: "Example", universeId: 123 }, collection: { slug: "pets", label: "Pets", pageType: "database" },
    dataset: "dataset.json", finalJson: "final.json", mediaRoot: "media", sourceUrls: ["https://example.com/pets"]
  }));
  await fs.writeFile(path.join(folder, "dataset.json"), JSON.stringify({ meta: { schemaVersion: 2 }, items: [] }));
  await fs.writeFile(path.join(folder, "final.json"), JSON.stringify({
    universe_id: 123, wiki_slug: "example", collection_slug: "pets", code: "example-pets", title: "All {count} Pets in Example", display_name: "Pets", seo_title: "All {count} Pets in Example", meta_description: "Example pets.", intro_md: "Pets hatch from eggs.", description_md: "Choose a pet.", description_json: {}, faq_json: [], wiki_md: "Pets hatch from eggs."
  }));
});
afterEach(async () => { vi.restoreAllMocks(); await fs.rm(root, { recursive: true, force: true }); });

describe("publisher page selection", () => {
  it("dry-runs one ready page while the hub and other collections remain unfinished", async () => {
    await publishBundle({ command: "publish", target: "managed-dev", apply: false, allowProd: false, bundle: root, only: ["pets"] });
    expect(state.universe).toHaveBeenCalledTimes(1);
    expect(state.universe.mock.calls[0][2]).toBe(false);
    expect(state.events).toEqual([]);
    expect(state.apply).not.toHaveBeenCalled();
    expect(state.registry).not.toHaveBeenCalled();
  });

  it("imports before writes and applies and registers only the selected collection", async () => {
    await publishBundle({ command: "publish", target: "managed-dev", apply: true, allowProd: false, bundle: root, only: ["pets"] });
    expect(state.events).toEqual(["import", "upload:pets", "apply:pets"]);
    expect(state.apply).toHaveBeenCalledTimes(1);
    expect(state.registry).toHaveBeenCalledWith("merge_roblox_wiki_registry", expect.objectContaining({
      p_collections: [{ slug: "pets", label: "Pets", sortOrder: 1020, pageType: "database" }]
    }));
  });

  it("rejects unknown pages before any target reads or writes", async () => {
    await expect(publishBundle({ command: "publish", target: "managed-dev", apply: true, allowProd: false, bundle: root, only: ["unknown"] })).rejects.toThrow("Unknown --only");
    expect(state.universe).not.toHaveBeenCalled();
    expect(state.registry).not.toHaveBeenCalled();
    expect(state.events).toEqual([]);
  });
});
