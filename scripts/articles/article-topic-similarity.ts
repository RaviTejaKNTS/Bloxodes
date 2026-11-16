import type { ProductionInventoryItem } from "./production-editorial-inventory";
import { inventoryPublicPath } from "./production-editorial-inventory";

export type ArticleScope = { universeId?: number | null; namespace?: string; gameSlug?: string; kind?: string; game?: string };
export type TopicCandidate = { title: string; url: string; page_type: string; id?: string; status?: string; score?: number; duplicate?: boolean };
const stem = (word: string) => word.length > 4 ? word.replace(/ies$/, "y").replace(/ing$/, "").replace(/s$/, "") : word.replace(/s$/, word.length > 3 ? "" : "s");
const words = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
const stopWords = new Set("a an the in on at for of to and or with without by from".split(" "));
const actions: Record<string, string> = { get: "acquire", obtain: "acquire", unlock: "acquire", find: "acquire", farm: "acquire", acquire: "acquire", beat: "defeat", defeat: "defeat", kill: "defeat", use: "use", work: "use", upgrade: "upgrade", install: "install", modding: "install" };

function topic(title: string, game: string) {
  let text = title.toLowerCase().normalize("NFKD")
    .replace(/\b(?:frames? per second|frame[ -]rate|fps)\b/g, " framerate ");
  // Remove the game name as a phrase, rather than deleting matching item words.
  const gamePhrase = words(game).join("[\\s-]+");
  if (gamePhrase) text = text.replace(new RegExp(`\\b(?:(?:in|on|for|with)\\s+)?${gamePhrase}\\b`, "g"), " ");
  if (/grand theft auto vi|gta.?6/i.test(game)) text = text.replace(/\b(?:gta[ -]?6|grand theft auto vi)\b/g, " ");
  text = text.replace(/^\s*roblox\b/, "").replace(/^[\s:!?-]+|[\s!?]+$/g, "").trim();
  let action = "explain";
  // Task words belong to the leading phrase. The remaining item name is kept.
  const question = text.match(/^(when(?: does?| is| are)?|where(?: to| does?| is| are)?|what (?:is|are))\b\s*/);
  if (question) {
    action = question[1].startsWith("when") ? "when" : question[1].startsWith("where") ? "where" : "what-is";
    text = text.slice(question[0].length);
  } else text = text.replace(/^how (?:to|do you|does? (?:one|it))\b\s*/, "");
  text = text.replace(/^(?:(?:best|top|fastest|easiest)\s+)?(?:ways?|methods?|tips?)\s+(?:(?:to|for)\s+)?/, "");
  const task = (action === "explain" || question?.[1] === "where to") && text.match(/^(make money|earn (?:money|cash)|money farming|farm (?:money|cash)|money making|level[ -]up|levelling|leveling|add(?= mods)|get|obtain|unlock|find|farm|acquire|beat|defeat|kill|use|work|upgrade|install|modding)\b\s*/);
  if (task) {
    const verb = task[1];
    const taskAction = /money|cash/.test(verb) ? "money" : /level/.test(verb) ? "upgrade" : verb === "add" ? "install" : actions[verb];
    if (action === "explain") action = taskAction;
    text = text.slice(task[0].length).trim().replace(/(?:^|\s)(?:fast|fastest|quickly|easily)$/, "");
    if (["money", "upgrade"].includes(action)) text = text.replace(/(?:^|\s)(?:guide|explained)$/, "");
  } else if (action === "explain") {
    // Only an editorial frame may remove guide/rank/best, never a subject token.
    const headline = text.split(/[:!?]/).find(part => /\b(?:tier[ -]list|rankings?|ranked|best|top|strongest)\b/.test(part)) ?? text;
    const ranked = headline.match(/^(.*?)\s+tier[ -]list\b/)?.[1] ??
      headline.match(/^(.*?)\s+ranked\b/)?.[1] ??
      headline.trim().match(/^(?:best|top(?:\s+\d+)?|strongest|rankings?|tier[ -]list)\s+(.*)/)?.[1];
    if (ranked) {
      action = "rank";
      text = ranked.replace(/^all\s+/, "").split(/\b(?:for|in|with|on|at)\b/)[0];
    } else text = text.replace(/(?:^|\s)(?:guide|guides|explained|explanation)$/, "");
  }
  const subjects = new Set(words(text).map(stem).filter(w => !stopWords.has(w)));
  const qualifiers = new Set([...subjects].filter(w => ["fragment","shard","recipe","location","spawn","time","schedule","material","ingredient","blueprint","drop","requirement"].includes(w)));
  return { action, subjects, rankedSubjects: subjects, qualifiers };
}
export function compareArticleTopics(left: string, right: string, game = "") {
  const a = topic(left, game), b = topic(right, game);
  const shared = [...a.subjects].filter(w => b.subjects.has(w)).length;
  const minimum = Math.min(a.subjects.size, b.subjects.size);
  const union = new Set([...a.subjects, ...b.subjects]).size;
  const containment = minimum ? shared / minimum : 0;
  const jaccard = union ? shared / union : 0;
  const compatible = a.action === b.action || [a.action,b.action].every(action => ["explain","what-is"].includes(action));
  const qualifierConflict = [...new Set([...a.qualifiers,...b.qualifiers])].some(w => a.qualifiers.has(w) !== b.qualifiers.has(w));
  const bareTask = a.action === b.action && ["money","upgrade"].includes(a.action) && !a.subjects.size && !b.subjects.size;
  const score = bareTask ? 1 : compatible ? 0.65 * containment + 0.35 * jaccard : 0.35 * jaccard;
  const sameSubjects = shared > 0 && shared === a.subjects.size && shared === b.subjects.size;
  const sameRankedSubjects = a.rankedSubjects.size > 0 && a.rankedSubjects.size === b.rankedSubjects.size && [...a.rankedSubjects].every(w => b.rankedSubjects.has(w));
  const duplicate = a.action === b.action && (a.action === "rank" ? sameRankedSubjects : bareTask || sameSubjects);
  return { score: Math.round(score * 1000) / 1000, duplicate, shared, jaccard, containment, compatible, qualifierConflict, actions: [a.action, b.action] };
}
export function scopeMatches(scope: ArticleScope, item: ProductionInventoryItem) {
  if (scope.namespace) return item.namespace === scope.namespace && item.slug === scope.gameSlug && (!scope.kind || item.kind === scope.kind);
  return scope.universeId != null && !item.namespace && (item.universe_id === scope.universeId ||
    Boolean(scope.game && item.family === "article" && ` ${words(item.title).join(" ")} `.includes(` ${words(scope.game).join(" ")} `)));
}
export function inferArticleScope(title: string, inventory: ProductionInventoryItem[]): ArticleScope | null {
  // Curated Roblox topics historically have no universe ID. Resolve a unique hub name in the title.
  const titleWords = ` ${words(title).join(" ")} `;
  const candidates = inventory.filter(i => !i.namespace && ["wiki","codes"].includes(i.family) && i.universe_id != null)
    .map(i => ({ i, name: i.key.replaceAll("-", " ") }))
    .filter(({name}) => titleWords.includes(` ${name} `)).sort((a,b) => b.name.length - a.name.length);
  if (!candidates.length) return null;
  const top = candidates[0];
  if (candidates.some(c => c.name.length === top.name.length && c.i.universe_id !== top.i.universe_id)) return null;
  return { universeId: top.i.universe_id, game: top.name };
}
export function gameNameForScope(scope: ArticleScope, inventory: ProductionInventoryItem[]) {
  return scope.game ?? scope.gameSlug?.replaceAll("-", " ") ?? inventory.find(i => scopeMatches(scope, i) && i.family === "wiki")?.key.replaceAll("-", " ") ?? inventory.find(i=>scopeMatches(scope,i)&&i.family==="codes")?.key.replaceAll("-"," ") ?? "";
}
export function similarArticleTopics(title: string, scope: ArticleScope, inventory: ProductionInventoryItem[], queue: any[] = []): TopicCandidate[] {
  const game = gameNameForScope(scope, inventory);
  const pages: TopicCandidate[] = inventory.filter(i => scopeMatches(scope, i)).flatMap(i => {
    const route=inventoryPublicPath(i,inventory);return route ? [{title:i.title,page_type:i.family,url:new URL(route,"https://bloxodes.com").href}] : [];
  });
  for (const row of queue) {
    if (!["pending", "processing", "blocked", "completed", "published", "rejected"].includes(row.status)) continue;
    const rowScope: ArticleScope | null = row.namespace ? { namespace: row.namespace, gameSlug: row.game_slug, kind: row.game_kind } : row.universe_id ? { universeId: row.universe_id } : inferArticleScope(row.article_title, inventory);
    const same = scope.namespace && !row.namespace && row.game && words(row.game).join(" ")===words(game).join(" ") || rowScope && (scope.namespace ? rowScope.namespace === scope.namespace && rowScope.gameSlug === scope.gameSlug && (!scope.kind || !rowScope.kind || rowScope.kind === scope.kind) : rowScope.universeId === scope.universeId);
    if(same)pages.push({title:row.article_title,url:row.production_url??`https://www.notion.so/${row.id.replaceAll("-","")}`,page_type:"queue",id:row.id,status:row.status});
  }
  const distinctPages=[...new Map(pages.map(p=>[`${p.page_type}:${p.url}`,p])).values()];
  return distinctPages.map(p=>({...p,...compareArticleTopics(title,p.title,game)})).filter(p=>p.score!>0)
    .sort((a,b)=>b.score!-a.score!);
}
