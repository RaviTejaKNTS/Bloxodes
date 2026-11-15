/** Compact catalog counts always round down so a title never overstates the total. */
export function formatCatalogTitleCount(count: number): string {
  return count >= 1000 ? `${Math.floor(count / 1000)}K+` : String(Math.floor(count));
}

export function catalogTitleCount(title: string, count: number | null | undefined): string {
  if (count == null || !Number.isFinite(count) || count < 1) return title;
  const number = "\\d+(?:,\\d{3})*(?:K\\+?|\\+)?";
  // Counts start a bracketed list description or a leading list phrase.
  // Bare bracket numbers remain supported; bare parentheses may be years.
  const bracket = new RegExp(`(?:\\[|\\()(${number})(?=\\s+[^\\]\\)]*\\b(?:items?|codes?|ids?|commands?|terms?|assets?|images?|pictures?|textures?|posters?|decals?|meshes|mesh|fonts?|emotes?|bundles?|songs?|sounds?|slang|acronyms?|entries)\\b[^\\]\\)]*[\\]\\)]|\\])`, "gi");
  const leading = new RegExp(`^(${number})(?=\\s+(?:Roblox\\b|Music IDs\\b|songs\\b|sounds\\b|items\\b))`, "i");
  for (const match of [...title.matchAll(bracket), ...title.matchAll(new RegExp(leading, "gi"))].sort((a, b) => a.index! - b.index!)) {
    const token = match[1];
    if (match.index === 0 && /^(?:19|20)\d{2}$/.test(token)) continue;
    if (match.index === 0 && /^\d{4,}$/.test(token) && /^\s+Music IDs\b/i.test(title.slice(token.length))) continue;
    const index = match.index! + match[0].indexOf(token);
    // A four digit year and ISO date are never counts without explicit count wording.
    const rest = title.slice(index + token.length);
    if (/^\d{4}$/.test(token) && /^(?:[-/]\d|\s*[)\]])/.test(rest)) continue;
    return title.slice(0, index) + formatCatalogTitleCount(count) + rest;
  }
  return title;
}
