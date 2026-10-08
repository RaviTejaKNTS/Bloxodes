// Public copy must not talk about where facts came from or how the page was made.
// Match process-voice phrases, not bare words: games use "Research" and "Source" as real terms.
const PUBLIC_PROVENANCE_PATTERNS = [
  /\b(?:our|my|cited|approved|trusted|reliable|verified|primary)\s+sources?\b/i,
  /\baccording\s+to\s+(?:the\s+|our\s+|my\s+|available\s+|community\s+|official\s+)?sources?\b/i,
  /\bsources?\s+(?:say|says|said|suggest|suggests|confirm|confirms|confirmed|indicate|indicates|report|reports|show|shows|claim|claims|agree|disagree|differ|vary)\b/i,
  /\bsource[- ](?:backed|list|data|page|pages|notes?|route|proof|links?)\b/i,
  /\b(?:our|my|further|additional)\s+research\b/i,
  /\bresearch\s+(?:shows|showed|suggests|suggested|found|finds|confirms|confirmed|indicates|indicated|notes)\b/i,
  /\bbased\s+on\s+(?:our\s+|my\s+)?research\b/i,
  /\bwe\s+(?:researched|verified|cross-checked|sourced)\b/i,
  /\bmanifest\b/i,
  /\bworkflow\b/i
];

export function publicProvenanceMatch(value: string): RegExpExecArray | null {
  for (const pattern of PUBLIC_PROVENANCE_PATTERNS) {
    const match = pattern.exec(value);
    if (match) return match;
  }
  return null;
}
