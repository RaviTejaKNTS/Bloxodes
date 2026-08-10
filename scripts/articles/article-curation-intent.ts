const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "all", "best", "complete", "for", "from", "guide", "how", "in", "is",
  "list", "new", "of", "on", "roblox", "the", "tier", "to", "update", "what", "when", "where", "with"
]);

function normalizeToken(token: string): string {
  return token.length > 4 && token.endsWith("s") && !token.endsWith("ss") ? token.slice(0, -1) : token;
}

export function tokenList(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
    .map(normalizeToken);
}

export function tokens(value: string): Set<string> {
  return new Set(tokenList(value));
}

export function groupingSimilarity(left: string, right: string): { shared: number; jaccard: number } {
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  const union = new Set([...leftTokens, ...rightTokens]);
  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return { shared, jaccard: union.size ? shared / union.size : 0 };
}

function edgeIdentityTokens(left: string[], right: string[]): Set<string> {
  let best: string[] = [];
  for (let leftStart = 0; leftStart < left.length; leftStart += 1) {
    for (let rightStart = 0; rightStart < right.length; rightStart += 1) {
      const shared: string[] = [];
      while (
        leftStart + shared.length < left.length &&
        rightStart + shared.length < right.length &&
        left[leftStart + shared.length] === right[rightStart + shared.length]
      ) {
        shared.push(left[leftStart + shared.length]);
      }
      if (!shared.length) continue;
      const touchesLeftEdge = leftStart === 0 || leftStart + shared.length === left.length;
      const touchesRightEdge = rightStart === 0 || rightStart + shared.length === right.length;
      if (touchesLeftEdge && touchesRightEdge && shared.length > best.length) best = shared;
    }
  }
  return new Set(best);
}

/**
 * Search-intent comparison that discounts a shared game name at either title edge.
 * This prevents same-game articles from being merged while still recognizing two
 * publishers covering the same mechanic or named item.
 */
export function sameSearchIntent(left: string, right: string): boolean {
  const leftList = tokenList(left);
  const rightList = tokenList(right);
  if (leftList.join(" ") === rightList.join(" ")) return true;

  const raw = groupingSimilarity(left, right);
  if (raw.shared >= 2 && raw.jaccard === 1) return true;
  const identity = edgeIdentityTokens(leftList, rightList);
  if (!identity.size) return raw.shared >= 2 && raw.jaccard >= 0.65;

  const leftIntent = new Set(leftList.filter((token) => !identity.has(token)));
  const rightIntent = new Set(rightList.filter((token) => !identity.has(token)));
  const union = new Set([...leftIntent, ...rightIntent]);
  const sharedTokens = [...leftIntent].filter((token) => rightIntent.has(token));
  const jaccard = union.size ? sharedTokens.length / union.size : 0;
  return (
    (sharedTokens.length >= 2 && jaccard >= 0.4) ||
    (sharedTokens.some((token) => token.length >= 6) && jaccard >= 0.5)
  );
}
