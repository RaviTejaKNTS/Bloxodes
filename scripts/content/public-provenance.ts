// Public copy must not talk about where facts came from or how the page was made.
// Match process-voice phrases, not bare words: games use "Research" and "Source" as real terms.
const MANIFEST_PATTERN = /\bmanifest\b/i;

const PUBLIC_PROVENANCE_PATTERNS = [
  /\b(?:our|my|cited|approved|trusted|reliable|verified)\s+sources?\b/i,
  /\baccording\s+to\s+(?:the\s+|our\s+|my\s+|available\s+|community\s+|official\s+)?sources?\b/i,
  /\bsources?\s+(?:say|says|said|suggest|suggests|confirm|confirms|confirmed|indicate|indicates|report|reports|show|shows|claim|claims|agree|disagree|differ|vary)\b/i,
  /\bsources?\s+(?:do|does)\s+not\s+list\b/i,
  /\bsource[- ](?:backed|list|data|page|pages|notes?|route|proof|links?)\b/i,
  /\b(?:our|my)\s+research\b/i,
  /\bresearch\s+(?:shows|showed|suggests|suggested|found|finds|confirms|confirmed|indicates|indicated|notes)\b/i,
  /\bbased\s+on\s+(?:our\s+|my\s+)?research\b/i,
  /\bwe\s+(?:have\s+)?(?:researched|verified|cross-checked|sourced)\b/i,
  MANIFEST_PATTERN,
  /\bworkflow\b/i
];

export function publicProvenanceMatch(value: string): RegExpExecArray | null {
  for (const pattern of PUBLIC_PROVENANCE_PATTERNS) {
    // Mask only case-exact game titles for the manifest check, preserving diagnostic offsets.
    const candidate = pattern === MANIFEST_PATTERN
      ? value.replace(/\b(?:Cargo|Courier) Manifest\b/g, title => " ".repeat(title.length))
      : value;
    const match = pattern.exec(candidate);
    if (match) {
      match.input = value;
      return match;
    }
  }
  return null;
}
