// Shared franchise games are created separately in production and managed development, so the
// same game can have a different UUID in each. Release batches carry production IDs. Managed QA
// maps them to development rows by natural identity; production publication never uses this file.
export const MANAGED_TARGET = "https://bbtcaurrtyoukvjbxbbj.supabase.co";

const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const nonPageGroups = new Set(["games", "checklistItems", "codes"]);
// Page groups whose existing development row is found by the publisher's conflict key: namespace and
// slug, or game. Wiki and code pages are unique per game (unique(game_id)) and publish_game_content_batch
// upserts them on game_id, so production replaces the same single page this lookup finds.
const slugPages = { tools: "game_tool_pages", maps: "game_map_pages", articles: "game_article_pages", quizzes: "game_quiz_pages", catalog: "game_catalog_pages" };
const gamePages = { wiki: "game_wiki_pages", codesPages: "game_code_pages" };

/** @param {unknown} value */
function validIdentity(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) &&
    uuid.test(value.id ?? "") && slug.test(value.namespace ?? "") && slug.test(value.slug ?? "") && ["franchise", "game"].includes(value.kind) &&
    Object.keys(value).every(key => ["id", "namespace", "slug", "kind"].includes(key)));
}

/** Parse the production identities handed to managed QA. Empty input means none were resolved. */
export function parseGameIdentities(text) {
  if (text === undefined || text === null || text === "") return [];
  const value = JSON.parse(text);
  if (!Array.isArray(value) || value.some(item => !validIdentity(item)) || new Set(value.map(item => item.id)).size !== value.length) throw new Error("Invalid production game identities.");
  return value;
}

/** Game IDs a game-pages payload references but does not define in its own games rows. */
export function referencedGameIds(payload) {
  const defined = new Set((payload.games ?? []).map(row => row.id));
  const ids = new Set();
  for (const [group, rows] of Object.entries(payload)) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const id = group === "games" ? row?.parent_id : nonPageGroups.has(group) ? null : row?.game_id;
      if (typeof id === "string" && uuid.test(id) && !defined.has(id)) ids.add(id);
    }
  }
  return [...ids].sort();
}

/**
 * Production side: collect the identity of every game the selected game-pages operations reference.
 * Reads only; `fetchGames(ids)` returns production `games` rows with id, namespace, slug and kind.
 */
export async function productionGameIdentities(batch, readPayload, fetchGames) {
  const ids = new Set();
  for (const operation of batch.operations) {
    if (operation.publisher !== "game-pages") continue;
    for (const id of referencedGameIds(readPayload(operation.file))) ids.add(id);
  }
  if (!ids.size) return [];
  const rows = await fetchGames([...ids].sort());
  const identities = rows.filter(row => ids.has(row.id)).map(({ id, namespace, slug, kind }) => ({ id, namespace, slug, kind }));
  return parseGameIdentities(JSON.stringify(identities.sort((a, b) => a.id.localeCompare(b.id))));
}

/**
 * Managed side: rewrite production game and page IDs to the matching development rows.
 * `lookup.gameById(id)` returns {namespace} or null, `lookup.gameByIdentity(identity)` returns an ID or null,
 * `lookup.pageId(table, filters)` returns the existing development page ID or null.
 * A referenced game that is neither in development nor in `identities` is left unchanged, so the publisher
 * still rejects it with its ownership check.
 */
export async function managedGamePagesPayload({ payload, namespace, identities, target, lookup }) {
  if (target !== MANAGED_TARGET) throw new Error("Game ID mapping runs only against the managed development target.");
  if (!slug.test(namespace ?? "")) throw new Error("Game ID mapping needs the operation namespace.");
  const output = structuredClone(payload);
  const ids = new Map();
  const changes = [];
  const record = (group, from, to) => { if (from !== to) { ids.set(from, to); changes.push({ group, from, to }); } };
  for (const row of output.games ?? []) {
    if (typeof row?.slug !== "string" || typeof row?.kind !== "string" || typeof row?.id !== "string") continue;
    const existing = await lookup.gameByIdentity({ namespace, slug: row.slug, kind: row.kind });
    if (existing) record("games", row.id, existing);
  }
  const known = new Map(identities.map(identity => [identity.id, identity]));
  for (const id of referencedGameIds(output)) {
    if ((await lookup.gameById(id))?.namespace === namespace) continue;
    const identity = known.get(id);
    if (!identity) continue;
    if (identity.namespace !== namespace) throw new Error(`Production game ${id} belongs to namespace ${identity.namespace}, not ${namespace}.`);
    const existing = await lookup.gameByIdentity({ namespace, slug: identity.slug, kind: identity.kind });
    if (!existing) throw new Error(`No managed development game matches production game ${namespace}/${identity.slug} (${identity.kind}).`);
    record("games", id, existing);
  }
  const mapped = id => ids.get(id) ?? id;
  for (const row of output.games ?? []) {
    if (row.id !== undefined) row.id = mapped(row.id);
    if (row.parent_id != null) row.parent_id = mapped(row.parent_id);
  }
  for (const [group, rows] of Object.entries(output)) {
    if (nonPageGroups.has(group) || !Array.isArray(rows)) continue;
    for (const row of rows) if (typeof row?.game_id === "string") row.game_id = mapped(row.game_id);
  }
  // Existing development pages keep their own UUIDs; checklists are re-identified by checklist staging.
  const pages = new Map();
  for (const [group, table] of [...Object.entries(slugPages), ...Object.entries(gamePages)]) {
    const targets = new Set();
    for (const row of output[group] ?? []) {
      const key = group in gamePages ? row?.game_id : row?.slug;
      if (typeof row?.id !== "string" || typeof key !== "string") continue;
      const filters = group in gamePages ? { game_id: row.game_id } : { namespace, slug: row.slug };
      const existing = await lookup.pageId(table, filters);
      if (existing && existing !== row.id) { pages.set(row.id, existing); changes.push({ group, from: row.id, to: existing }); row.id = existing; }
      // Two reviewed rows must never collapse onto one development page.
      if (targets.has(row.id)) throw new Error(`Several ${group} rows map to development page ${row.id}.`);
      targets.add(row.id);
    }
  }
  for (const row of output.codes ?? []) if (pages.has(row?.code_page_id)) row.code_page_id = pages.get(row.code_page_id);
  return { payload: output, changes };
}
