import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CollectionPlan, CollectionSource } from "../../../../../scripts/collections/sync-game-collection-runtime";
import { publishBundle } from "../../../../../scripts/content/roblox-wiki-publish";

const state = vi.hoisted(() => ({ plan: null as CollectionPlan | null, events: [] as string[], registry: vi.fn(), universe: vi.fn(), previewUniverse: vi.fn(), groups: vi.fn(), apply: vi.fn() }));
const copy = (plan: CollectionPlan) => ({ title: "All 1 Pets in Example", seo_title: "All 1 Pets in Example", wiki_sort_order: plan.config.sortOrder });

vi.mock("server-only", () => ({}));
vi.mock("../../../../../scripts/shared/load-env", () => ({}));
vi.mock("../../../../../scripts/shared/local-content-publication-guard", () => ({ assertLocalContentPublication: vi.fn() }));
vi.mock("../../../../../scripts/shared/roblox-wiki-universe", () => ({
  ensureContentUniverse: (...args: unknown[]) => state.universe(...args),
  previewContentUniverse: (...args: unknown[]) => state.previewUniverse(...args)
}));
vi.mock("../../../../../scripts/content/check-public-copy", () => ({ publicCopyFindings: () => [] }));
vi.mock("../../../../../scripts/content/roblox-collection-copy", () => ({ assertRobloxCollectionCopy: () => {} }));
vi.mock("../../../../../scripts/collections/audit-game-collection-datasets-v2", () => ({ auditDataset: () => {} }));
vi.mock("../../../../../scripts/collections/sync-game-wiki-runtime", () => ({ readFinal: () => { throw new Error("Unselected hub was read"); } }));
vi.mock("../../../../../scripts/shared/r2-client", () => ({ loadR2ClientConfig: () => ({ bucket: "bloxodes-wiki" }), R2Client: class {} }));
vi.mock("@/lib/game-collections/registry", () => ({ readGameCollectionGroups: () => state.groups() }));
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
  vi.stubEnv("WIKI_MEDIA_PUBLIC_BASE_URL", "");
  state.groups.mockResolvedValue([{
    gameSlug: "example", gameName: "Example", universeId: 123, universeNames: ["Example"], sortOrder: 1000, collections: ["boats"],
    collectionConfigs: [{ slug: "boats", sortOrder: 1010 }]
  }]);
  state.previewUniverse.mockResolvedValue({ universe_id: 123, root_place_id: 456, name: "Example", slug: "example-stats" });
  state.universe.mockImplementation(async (_db: unknown, _id: number, apply: boolean) => {
    if (apply) state.events.push("import");
    return apply ? { universe_id: 123, root_place_id: 456, name: "Example", slug: "example-stats" } : null;
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "table").mockImplementation(() => {});
  root = path.resolve(import.meta.dirname, "../../../../../tmp", `publish-selection-${randomUUID()}`);
  const folder = path.join(root, "pets");
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(root, "bundle.json"), JSON.stringify({
    contract: "roblox-wiki@1", game: { slug: "example", name: "Example", universeId: 123, universeNames: ["Example"] },
    hub: { finalJson: "unfinished-hub.json" }, collections: [
      { manifest: "pets/manifest.json" },
      { manifest: "unfinished-boats.json" }, { manifest: "missing-manifest.json" }
    ]
  }));
  await fs.writeFile(path.join(root, "unfinished-boats.json"), JSON.stringify({ collection: { slug: "boats" }, missingImages: [{ slug: "boat", reason: "" }] }));
  await fs.writeFile(path.join(folder, "manifest.json"), JSON.stringify({
    schemaVersion: 1, game: { slug: "example", name: "Example", universeId: 123 }, collection: { slug: "pets", label: "Pets", pageType: "database" },
    dataset: "dataset.json", finalJson: "final.json", mediaRoot: "media", sourceUrls: ["https://example.com/pets"],
    missingImages: [{ slug: "pet", reason: "No exact image available." }]
  }));
  await fs.writeFile(path.join(folder, "dataset.json"), JSON.stringify({ meta: { schemaVersion: 2 }, items: [] }));
  await fs.writeFile(path.join(folder, "final.json"), JSON.stringify({
    universe_id: 123, wiki_slug: "example", collection_slug: "pets", code: "example-pets", title: "All {count} Pets in Example", display_name: "Pets", seo_title: "All {count} Pets in Example", meta_description: "Example pets.", intro_md: "Pets hatch from eggs.", description_md: "Choose a pet.", description_json: {}, faq_json: [], wiki_md: "Pets hatch from eggs."
  }));
});
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); await fs.rm(root, { recursive: true, force: true }); });

describe("publisher page selection", () => {
  it("dry-runs with selected manifest image decisions while other pages and decisions remain unfinished", async () => {
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

  it.each(["bundle only", "matching reasons"])("supports %s image decisions for --only", async mode => {
    const bundlePath = path.join(root, "bundle.json");
    const bundle = JSON.parse(await fs.readFile(bundlePath, "utf8"));
    bundle.collections[0].missingImages = [{ slug: "pet", reason: "  No exact image available.  " }];
    await fs.writeFile(bundlePath, JSON.stringify(bundle));
    if (mode === "bundle only") {
      const manifestPath = path.join(root, "pets/manifest.json");
      const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
      delete manifest.missingImages;
      await fs.writeFile(manifestPath, JSON.stringify(manifest));
    }
    await publishBundle({ command: "publish", target: "managed-dev", apply: false, allowProd: false, bundle: root, only: ["pets"] });
    expect(state.events).toEqual([]);
  });

  it.each([
    { decisions: [{ slug: "pet", reason: "A conflicting reason." }], bundleDecision: true, error: /Conflicting missingImages reasons for pet/ },
    { decisions: [{ slug: "pet", reason: "No exact image available." }, { slug: "absent", reason: "No image." }], bundleDecision: false, error: /stale missingImages decisions: absent/ },
    { decisions: [], bundleDecision: false, error: /pet has no image/ }
  ])("rejects invalid selected decisions before apply: $error", async ({ decisions, bundleDecision, error }) => {
    const file = path.join(root, bundleDecision ? "bundle.json" : "pets/manifest.json");
    const document = JSON.parse(await fs.readFile(file, "utf8"));
    if (bundleDecision) document.collections[0].missingImages = decisions;
    else document.missingImages = decisions;
    await fs.writeFile(file, JSON.stringify(document));
    const loggedError = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(publishBundle({ command: "publish", target: "managed-dev", apply: true, allowProd: false, bundle: root, only: ["pets"] })).rejects.toThrow("preflight check(s) failed");
    expect(loggedError).toHaveBeenCalledWith(expect.stringMatching(error));
    expect(state.events).toEqual([]);
    expect(state.apply).not.toHaveBeenCalled();
    expect(state.registry).not.toHaveBeenCalled();
    expect(state.universe).toHaveBeenCalledTimes(1);
    expect(state.universe.mock.calls[0][2]).toBe(false);
  });

  it("rejects unknown pages before any target reads or writes", async () => {
    await expect(publishBundle({ command: "publish", target: "managed-dev", apply: true, allowProd: false, bundle: root, only: ["unknown"] })).rejects.toThrow("Unknown --only");
    expect(state.universe).not.toHaveBeenCalled();
    expect(state.registry).not.toHaveBeenCalled();
    expect(state.events).toEqual([]);
  });

  it("keeps publisher registry reads strict", async () => {
    state.groups.mockRejectedValueOnce(new Error("Registry unavailable"));
    await expect(publishBundle({ command: "publish", target: "managed-dev", apply: true, allowProd: false, bundle: root, only: ["pets"] })).rejects.toThrow("Registry unavailable");
    expect(state.events).toEqual([]);
  });

  it.each(["https://media.bloxodes.com/wrong", "https://media.bloxodes.com", "https://media.bloxodes.com/wiki/nested", "https://media.bloxodes.com/wiki?x=1", "https://other.example/wiki"])("rejects the incorrect media base %s before writes", async base => {
    vi.stubEnv("WIKI_MEDIA_PUBLIC_BASE_URL", base);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(publishBundle({ command: "publish", target: "managed-dev", apply: true, allowProd: false, bundle: root, only: ["pets"] })).rejects.toThrow("preflight check(s) failed");
    expect(logged).toHaveBeenCalledWith(expect.stringContaining("publication uses https://media.bloxodes.com/wiki"));
    expect(state.events).toEqual([]);
  });

  it("accepts the normalized exact media base", async () => {
    vi.stubEnv("WIKI_MEDIA_PUBLIC_BASE_URL", "  https://media.bloxodes.com/wiki///  ");
    await publishBundle({ command: "publish", target: "managed-dev", apply: false, allowProd: false, bundle: root, only: ["pets"] });
    expect(state.events).toEqual([]);
  });

  it.each([false, true])("rejects a new editorial slug equal to the previewed stats slug, apply=%s", async apply => {
    state.groups.mockResolvedValue([]);
    state.previewUniverse.mockResolvedValue({ universe_id: 123, root_place_id: 456, name: "Example", slug: "example" });
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(publishBundle({ command: "publish", target: "managed-dev", apply, allowProd: false, bundle: root, only: ["pets"] })).rejects.toThrow("preflight check(s) failed");
    expect(logged).toHaveBeenCalledWith(expect.stringContaining("stats identity"));
    expect(state.previewUniverse).toHaveBeenCalledWith(123);
    expect(state.universe).toHaveBeenCalledTimes(1);
    expect(state.events).toEqual([]);
  });

  it.each([
    { universe_id: 123, root_place_id: 456, name: "Example", slug: "example" },
    { universe_id: 999, root_place_id: 456, name: "Example", slug: "example-stats" },
    { universe_id: 123, root_place_id: 999, name: "Example", slug: "example-stats" },
    { universe_id: 123, root_place_id: 456, name: "Example", slug: "" }
  ])("rechecks imported identity and stats slug before media or page writes: %j", async imported => {
    state.groups.mockResolvedValue([]);
    state.universe.mockImplementation(async (_db: unknown, _id: number, apply: boolean) => {
      if (apply) state.events.push("import");
      return apply ? imported : null;
    });
    await expect(publishBundle({ command: "publish", target: "managed-dev", apply: true, allowProd: false, bundle: root, only: ["pets"] })).rejects.toThrow(/stats identity|Imported universe identity/);
    expect(state.events).toEqual(["import"]);
    expect(state.apply).not.toHaveBeenCalled();
    expect(state.registry).not.toHaveBeenCalled();
  });

  it("uses the stored stats identity without previewing an existing universe", async () => {
    state.universe.mockResolvedValue({ universe_id: 123, root_place_id: 456, name: "Example", slug: "example-stats" });
    await publishBundle({ command: "publish", target: "managed-dev", apply: false, allowProd: false, bundle: root, only: ["pets"] });
    expect(state.previewUniverse).not.toHaveBeenCalled();
  });

  it("stops before imports and publication when the read-only universe fetch fails", async () => {
    state.previewUniverse.mockRejectedValueOnce(new Error("Roblox identity unavailable"));
    await expect(publishBundle({ command: "publish", target: "managed-dev", apply: true, allowProd: false, bundle: root, only: ["pets"] })).rejects.toThrow("Roblox identity unavailable");
    expect(state.events).toEqual([]);
    expect(state.apply).not.toHaveBeenCalled();
    expect(state.registry).not.toHaveBeenCalled();
  });
});
