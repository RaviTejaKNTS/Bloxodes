export type PublicCopyFinding = {
  file: string;
  field: string;
  rule: string;
  excerpt: string;
};

const PUBLIC_COPY_KEYS = new Set([
  "title",
  "meta_description",
  "intro_md",
  "description_md",
  "description_json",
  "how_it_works_md",
  "faq_json",
  "wiki_md",
  "tips_md",
  "content_md",
  "seo_description",
  "description",
]);

const HARD_PATTERNS: Array<{ rule: string; pattern: RegExp }> = [
  {
    rule: "self-referential catalog CTA",
    pattern: /\b(use|check|open|browse|visit|see)\s+(?:the|this|our|[a-z0-9' -]{1,60})?\s*catalog\b/i,
  },
  {
    rule: "self-referential page wording",
    pattern: /\bthis\s+(article|catalog|page|guide|dataset|database)\b/i,
  },
  {
    rule: "public dataset reference",
    pattern: /\bdataset\b/i,
  },
  {
    rule: "Bloxodes self-reference",
    pattern: /\bBloxodes\b/,
  },
  {
    rule: "field-command copy",
    pattern: /\b(read|check|use)\s+(?:the\s+)?(category|rarity|source|availability|effect|price|cost|requirement|requirements|field|fields)\s+first\b/i,
  },
  {
    rule: "AI-ish contrast filler",
    pattern: /\bnot\s+(just|only)\b/i,
  },
  {
    rule: "public source attribution",
    pattern: /\b(?:according to|as (?:reported|listed|ranked|ordered|covered) by|reported by)\b/i,
  },
  {
    rule: "public source or research workflow",
    pattern: /\b(?:source gathering|source material|source-backed|research workflow|database checks?|internal notes?|cross[- ]check(?:ed|ing)?|brief\.md|media\.json|final\.json|ranking lens)\b/i,
  },
  {
    rule: "public editorial disclaimer",
    pattern: /\b(?:editorial recommendation|universal consensus|community consensus|consensus ranking)\b/i,
  },
  {
    rule: "public competitor/source name",
    pattern: /\b(?:PGG|Pro Game Guides|Sportskeeda|TechWiser|Beebom|Game\s?Rant|Gamezebo|Try Hard Guides|Destructoid|Eurogamer|IGN|Fandom)\b/i,
  },
  {
    rule: "public research narration",
    pattern: /\b(?:our|the)\s+(?:research|sources?)\s+(?:shows?|showed|says?|said|reports?|reported|confirms?|confirmed|indicates?|indicated|lists?|listed|supports?|supported|suggests?|suggested|found)\b/i,
  },
  {
    rule: "public guide/report attribution",
    pattern: /\b(?:the same report|guide report|event guides?\s+(?:report|say|list|show)|guide-reported|single\s+[^.!?]{0,60}\s+report|no second\s+[^.!?]{0,60}\s+source)\b/i,
  },
];

function isPublicCopyPath(parts: string[]): boolean {
  return parts.some((part) => PUBLIC_COPY_KEYS.has(part));
}

function excerpt(value: string, index: number): string {
  const start = Math.max(0, index - 50);
  const end = Math.min(value.length, index + 130);
  return value.slice(start, end).replace(/\s+/g, " ").trim();
}

function scanString(value: string, file: string, field: string): PublicCopyFinding[] {
  const findings: PublicCopyFinding[] = [];

  for (const rule of HARD_PATTERNS) {
    const match = rule.pattern.exec(value);
    if (!match) continue;
    findings.push({
      file,
      field,
      rule: rule.rule,
      excerpt: excerpt(value, match.index),
    });
  }

  if (field.endsWith("wiki_md") && /^\s*(use|check|open|browse|visit|see)\b/i.test(value)) {
    findings.push({
      file,
      field,
      rule: "wiki_md starts as a CTA instead of a game-system explanation",
      excerpt: excerpt(value, 0),
    });
  }

  return findings;
}

function collectPublicStrings(value: unknown, parts: string[] = []): Array<{ field: string; value: string }> {
  if (typeof value === "string") {
    return isPublicCopyPath(parts) ? [{ field: parts.join("."), value }] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectPublicStrings(entry, [...parts, String(index)]));
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) =>
      collectPublicStrings(entry, [...parts, key])
    );
  }

  return [];
}

function scanRepeatedStarts(
  strings: Array<{ field: string; value: string }>,
  file: string
): PublicCopyFinding[] {
  const starts = new Map<string, Array<{ field: string; value: string }>>();

  for (const item of strings) {
    const firstWords = item.value
      .trim()
      .toLowerCase()
      .replace(/[`*_]/g, "")
      .split(/\s+/)
      .slice(0, 3)
      .join(" ");
    if (!firstWords) continue;
    const entries = starts.get(firstWords) ?? [];
    entries.push(item);
    starts.set(firstWords, entries);
  }

  const findings: PublicCopyFinding[] = [];
  for (const [start, entries] of starts.entries()) {
    if (entries.length < 4) continue;
    if (!/^(compare|use|check|start|the)\b/.test(start)) continue;
    findings.push({
      file,
      field: entries.map((entry) => entry.field).slice(0, 5).join(", "),
      rule: "repeated public-copy opening pattern",
      excerpt: `${entries.length} fields start with "${start}"`,
    });
  }
  return findings;
}

export function scanPublicCopy(value: unknown, file: string): PublicCopyFinding[] {
  const strings = collectPublicStrings(value);
  return [
    ...strings.flatMap((entry) => scanString(entry.value, file, entry.field)),
    ...scanRepeatedStarts(strings, file),
  ];
}
