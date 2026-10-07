import path from "node:path";

const publishers = new Set(["events-final", "roblox-codes-page", "article-queue", "game-pages", "content-final", "roblox-wiki", "roblox-collection", "franchise-wiki", "franchise-collection", "minecraft-tools", "catalog", "tool-finals"]);
const eventTypes = new Set(["code", "article", "event", "checklist", "tool", "catalog", "quiz", "wiki", "wiki_collection", "gta_game", "gta_wiki", "gta_wiki_collection", "red_dead_game", "red_dead_wiki", "red_dead_wiki_collection", "minecraft_game", "minecraft_wiki", "minecraft_wiki_collection", "minecraft_tool", "game_content"]);

export function batchPath(input) {
  if (typeof input !== "string" || !/^content\/releases\/[a-z0-9-]+\/batch\.json$/.test(input)) throw new Error("Select an exact content/releases/<batch>/batch.json path.");
  return input;
}
export function ownedPath(base, input) {
  if (typeof input !== "string" || !input || path.isAbsolute(input) || input.includes("\\") || input.split("/").some(part => ["", ".", ".."].includes(part))) throw new Error("Unsafe batch file path.");
  return `${base}/${input}`;
}
export function parseBatch(input) {
  if (!input || input.version !== 1 || !Array.isArray(input.operations) || input.operations.length > 20 || !Array.isArray(input.urls) || !input.urls.length || input.urls.length > 20 || !Array.isArray(input.events) || input.events.length > 100) throw new Error("Invalid content batch.");
  for (const operation of input.operations) {
    if (!operation || !publishers.has(operation.publisher)) throw new Error("Unknown content publisher.");
    if (operation.publisher === "article-queue" && !/^[0-9a-f-]{36}$/i.test(operation.queueId ?? "")) throw new Error("Article releases need an exact queue ID.");
    if (operation.file !== undefined) ownedPath("batch", operation.file);
    if (operation.workspace !== undefined) ownedPath("batch", operation.workspace);
    if (!operation.file && !operation.workspace) throw new Error("Each publisher needs its own reviewed input.");
    if (operation.namespace !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(operation.namespace)) throw new Error("Invalid namespace.");
    if (operation.games !== undefined && (!Array.isArray(operation.games) || !operation.games.length || operation.games.some(game => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(game)))) throw new Error("Invalid game allowlist.");
    if (operation.publisher === "franchise-wiki" && (!operation.workspace || !operation.games?.length || !operation.namespace)) throw new Error("Franchise hubs need an exact workspace, namespace and game allowlist.");
    if (["game-pages", "franchise-collection"].includes(operation.publisher) && !operation.namespace) throw new Error("A game namespace is required.");
    if (operation.publisher !== "franchise-wiki" && !operation.file) throw new Error("A reviewed file is required.");
    if (Object.keys(operation).some(key => !["publisher", "file", "workspace", "namespace", "games", "queueId"].includes(key))) throw new Error("Extra publisher arguments are not allowed.");
  }
  for (const url of input.urls) {
    if (!url || typeof url.path !== "string" || !/^\/[a-z0-9/-]*$/.test(url.path) || url.path.includes("//") || url.path.includes("..") || typeof url.contains !== "string" || !url.contains.trim()) throw new Error("Each public URL needs an exact path and expected text.");
  }
  for (const event of input.events) if (!eventTypes.has(event.type) || !/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(event.slug)) throw new Error("Invalid exact revalidation event.");
  if (input.operations.length && !input.events.length) throw new Error("Publication requires explicit cache events.");
  return input;
}
