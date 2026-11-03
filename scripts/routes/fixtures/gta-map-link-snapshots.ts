import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file: string) => JSON.parse(readFileSync(new URL(file, import.meta.url), "utf8"));

// Frozen leaf edits from the reviewed production inventory. The original guard
// proves the reconstructed before values; canonical inputs prove repeat imports.
export function gtaMapLinkSnapshots() {
  const inventory = read("./gta-map-link-snapshots.json") as {
    id: string; slug: string; renderer: string; before_hash: string; after_hash: string;
    edits: { path: (string | number)[]; before: string; after: string }[];
  }[];
  assert.equal(inventory.length, 9);
  const source = (file: string) => read(`../../../apps/web/src/data/${file}`);
  const registry = source("gta-maps/registry.json");
  return inventory.map(entry => {
    const after = entry.slug === "gta5" ? {
      points: source("gta5-map-points.json"), places: source("gta5-map-places.json"),
      markerSnapshot: source("gta5-map-marker-snapshot.json"),
    } : {
      definition: registry.find((d: { slug: string }) => d.slug === entry.slug),
      points: source(`gta-maps/${entry.slug}.json`).points,
    };
    const before = structuredClone(after);
    for (const edit of entry.edits) {
      let parent: any = before;
      for (const key of edit.path.slice(0, -1)) parent = parent[key];
      const key = edit.path.at(-1)!;
      assert.equal(parent[key], edit.after, `${entry.slug}: canonical importer leaf changed`);
      parent[key] = edit.before;
    }
    return { ...entry, before, after };
  });
}
