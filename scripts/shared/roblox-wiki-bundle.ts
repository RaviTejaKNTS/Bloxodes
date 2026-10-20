import fs from "node:fs/promises";
import path from "node:path";
import { runtimeManifestSchema, type RobloxWikiBundle } from "../../contracts/roblox-wiki/v1/schema";
import type { RegisteredGameCollectionGroup } from "../../apps/web/src/lib/game-collections/registry";

export async function bundlePath(root: string, input: string): Promise<string> {
  const realRoot = await fs.realpath(root);
  const resolved = await fs.realpath(path.resolve(root, input));
  const relative = path.relative(realRoot, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`Bundle path escapes its folder: ${input}. Move the file inside the bundle.`);
  return resolved;
}

export function assertEditorialSlug(slug: string, universeId: number, statsSlug: string | null, existingSlug?: string | null) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`Invalid editorial slug ${slug}. Use lowercase words separated by hyphens.`);
  // Existing editorial identities remain valid even if a stats slug happens to match.
  if (slug !== existingSlug && (slug === statsSlug || slug.endsWith(`-${universeId}`))) {
    throw new Error(`Editorial slug ${slug} copies the stats identity. Choose the game's readable editorial slug without its universe ID; never copy roblox_universes.slug.`);
  }
}

// Unselected pages may still be under construction. Only their slug is needed.
export async function selectBundlePages(bundle: RobloxWikiBundle, only: string[] | undefined, readManifest: (file: string) => Promise<unknown>) {
  const requested = only?.length ? new Set(only) : null;
  const available = new Set(bundle.hub ? ["hub"] : []);
  const collections: Array<{ entry: NonNullable<RobloxWikiBundle["collections"]>[number]; manifest: ReturnType<typeof runtimeManifestSchema.parse> }> = [];
  const unreadable: string[] = [];
  if (!requested || [...requested].some(page => page !== "hub")) {
    for (const entry of bundle.collections ?? []) {
      let raw: unknown;
      try { raw = await readManifest(entry.manifest); }
      catch (error) {
        if (!requested) throw error;
        unreadable.push(entry.manifest);
        continue;
      }
      const slug = raw && typeof raw === "object" && "collection" in raw
        ? (raw.collection as { slug?: unknown } | null)?.slug : undefined;
      if (typeof slug === "string") available.add(slug);
      if (requested && (typeof slug !== "string" || !requested.has(slug))) continue;
      collections.push({ entry, manifest: runtimeManifestSchema.parse(raw) });
    }
  }
  const unknown = [...(requested ?? [])].filter(page => !available.has(page));
  if (unknown.length) throw new Error(`Unknown --only page(s): ${unknown.join(", ")}. Available pages: ${[...available].join(", ") || "none"}.${unreadable.length ? ` Could not identify slugs in: ${unreadable.join(", ")}. Finish the requested page's manifest.` : ""}`);
  return { hub: !requested || requested.has("hub") ? bundle.hub : undefined, collections };
}

export function resolveCollectionOrders(
  collections: Array<{ slug: string; sortOrder?: number }>,
  existing: Pick<RegisteredGameCollectionGroup, "sortOrder" | "collectionConfigs"> | undefined,
  gameOrder: number
) {
  const orders = new Map(existing?.collectionConfigs.map(entry => [entry.slug, entry.sortOrder]) ?? []);
  let last = orders.size ? Math.max(...orders.values()) : existing?.sortOrder ?? gameOrder;
  const reserved = new Set([...orders.values(), ...collections.flatMap(entry => entry.sortOrder == null ? [] : [entry.sortOrder])]);
  const resolved = new Map<string, number>();
  for (const entry of collections) {
    let order = entry.sortOrder ?? orders.get(entry.slug);
    if (order == null) {
      do { last += 10; } while (reserved.has(last));
      order = last;
      reserved.add(order);
    }
    if (!Number.isSafeInteger(order)) throw new Error(`Collection sort order is outside the supported integer range: ${entry.slug}.`);
    resolved.set(entry.slug, order);
  }
  return resolved;
}

export function assertCollectionFinalOrder(finalOrder: number | undefined, resolvedOrder: number) {
  if (finalOrder != null && finalOrder !== resolvedOrder) throw new Error(`final.json wiki_sort_order must equal the resolved collection sort order, ${resolvedOrder}. Omit it to use the assigned order.`);
}

export function assertCollectionMissingImages(
  items: Array<{ item_slug: string; image_key?: string | null }>,
  bundleDecisions: Array<{ slug: string; reason: string }> = [],
  manifestDecisions: Array<{ slug: string; reason: string }> = []
) {
  const accepted = new Map<string, string>();
  for (const [source, decisions] of [["bundle entry", bundleDecisions], ["runtime manifest", manifestDecisions]] as const) {
    const seen = new Set<string>();
    for (const { slug, reason } of decisions) {
      if (seen.has(slug)) throw new Error(`Remove duplicate missingImages decisions for ${slug} in the ${source}.`);
      seen.add(slug);
      if (accepted.has(slug) && accepted.get(slug) !== reason) throw new Error(`Conflicting missingImages reasons for ${slug} in the bundle entry and runtime manifest. Use the same reason or keep the decision in one place.`);
      accepted.set(slug, reason);
    }
  }
  for (const item of items) {
    if (!item.image_key && !accepted.delete(item.item_slug)) throw new Error(`${item.item_slug} has no image. Add a verified image or record {slug, reason} in this collection's runtime-manifest.json missingImages array or bundle entry.`);
  }
  if (accepted.size) throw new Error(`Remove stale missingImages decisions: ${[...accepted.keys()].join(", ")}.`);
}
