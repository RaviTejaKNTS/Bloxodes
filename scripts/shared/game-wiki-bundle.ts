import fs from "node:fs/promises";
import path from "node:path";
import { reservedGameNamespaces } from "../../apps/web/src/lib/game-route-names";
import { runtimeManifestSchema, type GameWikiBundle } from "../../contracts/game-wiki/v1/schema";

export function assertGameWikiIdentity(bundle: Pick<GameWikiBundle, "namespace" | "game">) {
  const { namespace, game } = bundle;
  if (reservedGameNamespaces.has(namespace)) throw new Error(`Reserved namespace ${namespace} cannot publish a game wiki.`);
  if (game.parent) {
    if (game.parent !== namespace || game.kind !== "game") throw new Error("A child game must have kind game and parent equal to the namespace root.");
  } else if (game.slug !== namespace) throw new Error("A root game's slug must equal its namespace.");
  if (namespace === "minecraft" && !["minecraft", "minecraft-java", "minecraft-bedrock"].includes(game.slug)) throw new Error("Minecraft requires an approved edition identity; new editions need route code.");
}

export function gameWikiPath(namespace: string, slug: string, parent?: string) {
  if (namespace === "minecraft" && ["minecraft-java", "minecraft-bedrock"].includes(slug)) return `/minecraft/${slug.slice(10)}/wiki`;
  return `/${namespace}/wiki${parent ? `/${slug}` : ""}`;
}

export function assertNoRobloxIdentifiers(value: unknown, label: string) {
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    if (/^(?:(?:roblox_?)?(?:universe_?id|root_?place_?id|place_?id)|roblox_?id)$/i.test(key)) throw new Error(`${label}: Roblox identifier ${key} is not allowed in game-wiki@1.`);
    assertNoRobloxIdentifiers(entry, label);
  }
}

export async function assertGameWikiRoutes(bundle: GameWikiBundle, siteRoot: string) {
  assertGameWikiIdentity(bundle);
  // Static top-level routes take precedence over the shared registry route.
  const entries = await fs.readdir(siteRoot, { withFileTypes: true });
  if (entries.some(entry => entry.isDirectory() && entry.name === bundle.namespace) && !["gta", "red-dead", "minecraft"].includes(bundle.namespace)) {
    throw new Error(`Namespace ${bundle.namespace} has a dedicated route. It needs reviewed route code before game-wiki publication.`);
  }
  if (!bundle.game.parent && ["gta", "red-dead"].includes(bundle.namespace) && bundle.collections?.length) throw new Error(`${bundle.namespace} root collections need route code; publish collections on a child game.`);
}

export async function selectGameWikiPages(bundle: GameWikiBundle, only: string[] | undefined, readManifest: (file: string) => Promise<unknown>) {
  const requested = only?.length ? new Set(only) : null;
  const available = new Set(bundle.hub ? ["hub"] : []);
  const collections: Array<{ entry: NonNullable<GameWikiBundle["collections"]>[number]; manifest: ReturnType<typeof runtimeManifestSchema.parse> }> = [];
  const seen = new Set<string>();
  for (const entry of !requested || [...requested].some(page => page !== "hub") ? bundle.collections ?? [] : []) {
    let raw: unknown;
    try { raw = await readManifest(entry.manifest); } catch (error) { if (!requested) throw error; else continue; }
    const slug = (raw as { collection?: { slug?: string } } | null)?.collection?.slug;
    if (typeof slug === "string") available.add(slug);
    if (requested && (!slug || !requested.has(slug))) continue;
    const manifest = runtimeManifestSchema.parse(raw);
    if (seen.has(manifest.collection.slug) || manifest.collection.slug === "hub") throw new Error(`Duplicate or reserved collection slug: ${manifest.collection.slug}.`);
    seen.add(manifest.collection.slug);
    if (entry.manifest !== `collections/${manifest.collection.slug}/runtime-manifest.json`) throw new Error("Collection manifests must use collections/<slug>/runtime-manifest.json.");
    collections.push({ entry, manifest });
  }
  const unknown = [...(requested ?? [])].filter(page => !available.has(page));
  if (unknown.length) throw new Error(`Unknown --only page(s): ${unknown.join(", ")}. Available pages: ${[...available].join(", ")}. Finish the requested manifest if it is unreadable.`);
  return { hub: !requested || requested.has("hub") ? bundle.hub : undefined, collections };
}

// UUIDs in authoring exports belong to their source database. Preserve target
// UUIDs and permanent ownership, resolving each target by its natural keys.
export function resolveGameWikiIdentity(games: Array<Record<string, any>>, hubs: Array<Record<string, any>>, namespace: string, identity: { slug: string; kind: string; parent?: string }) {
  const root = games.find(row => row.slug === namespace && row.parent_id == null);
  const matches = games.filter(row => row.slug === identity.slug && row.kind === identity.kind);
  if (matches.length > 1) throw new Error("Ambiguous game slug in target registry.");
  const game = matches[0];
  if (!game && games.some(row => row.slug === identity.slug && (row.parent_id == null) === !identity.parent)) throw new Error("Game kind conflicts with permanent target identity.");
  if (identity.parent && (!root || !root.is_published || root.kind !== "franchise")) throw new Error("Publish the owning franchise root before its child game.");
  const parentId = identity.parent ? root!.id : null;
  if (game && (game.kind !== identity.kind || (game.parent_id ?? null) !== parentId)) throw new Error("Game kind or parent conflicts with permanent target identity. Use a reviewed migration.");
  if (!identity.parent && root && root.id !== game?.id) throw new Error("Namespace already has another root identity.");
  const hubMatches = game ? hubs.filter(row => row.game_id === game.id) : [];
  if (hubMatches.length > 1) throw new Error("Multiple hubs belong to the target game.");
  const hub = hubMatches[0];
  const hubSlug = hub?.slug ?? identity.slug;
  if (hubs.some(row => row.slug === hubSlug && row.id !== hub?.id)) throw new Error("Hub slug belongs to a different game in this target.");
  return { root, game, hub, hubSlug, parentId };
}

