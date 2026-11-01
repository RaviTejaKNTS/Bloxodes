import "server-only";
import { getGameRoot } from "./game-registry";
import { readRedirectSnapshot } from "./site-route-snapshot";
import { resolveSiteRoute } from "./site-route-resolver";

/** Serializable paths for navigation clients; ownership comes from registry aliases. */
export async function gameLinkPaths(): Promise<Record<string, string>> {
  const namespaces = ["gta", "red-dead", "minecraft"];
  const moved = new Set((await Promise.all(namespaces.map(async namespace =>
    (await getGameRoot(namespace).catch(() => null))?.url_style === "page_type" ? namespace : null
  ))).filter((namespace): namespace is string => namespace !== null));
  if (!moved.size) return {};
  // Every page's shell awaits this; a snapshot failure only loses the aliases.
  const snapshot = await readRedirectSnapshot().catch(() => null);
  if (!snapshot) return {};
  const paths: Record<string, string> = {};
  for (const row of snapshot.exact.values()) {
    if (!moved.has(row.path.split("/")[1])) continue;
    const target = resolveSiteRoute(snapshot, row.path)?.target;
    if (target) paths[row.path] = target;
  }
  return paths;
}
