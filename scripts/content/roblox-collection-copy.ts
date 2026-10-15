import { marked } from "marked";
import { load } from "cheerio";

type CopyFinding = { field: string; rule: string; excerpt: string };

const COPY_FIELDS = new Set([
  "meta_description", "intro_md", "description_md", "description_json", "faq_json", "wiki_md"
]);

// Target website instructions. Gameplay uses of cards, filters and inventories stay valid.
const PAGE_INSTRUCTIONS = [
  /\b(?:this|our)\s+(?:page|catalog|collection|list|database)\b/i,
  /\bthis\s+(?:[\w'-]+\s+){1,3}catalog\b/i,
  /\b(?:use|treat)\s+(?:the\s+|these\s+)?cards?\s+(?:to\s+(?:compare|browse|check|find|see|track)\b|as\s+(?:a\s+)?(?:quick\s+)?reference\b)/i,
  /\b(?:cards?|table|rows?)\s+(?:below|here)\b/i,
  /\b(?:the|each)\s+cards?\s+(?:show|shows|list|lists|display|displays)\b/i,
  /\b(?:the\s+)?cards?\s+(?:help\s+you\s+(?:match|compare|choose|decide)|(?:are|is)\s+meant\s+to\s+help|group\s+them\s+by)\b/i,
  /\b(?:card|list)\s+view\b/i,
  /\btracked\s+entries\b/i,
  /\buse\s+the\s+(?:[\w'-]+\s+){0,3}(?:list|sections)\s+(?:below|to\s+(?:compare|see|find))\b/i,
  /\b(?:here\s+you\s+can\s+line|here\s+every\s+[\w'-]+\s+is\s+lined)\b/i,
  /\ball\s+\d+\s+(?:[\w'-]+\s+){0,2}are\s+(?:laid\s+out|lined\s+up)\s+side\s+by\s+side\s+so\s+you\s+can\s+(?:compare|narrow|see)\b/i,
  /\b(?:listed\s+below|grouped\s+here|each\s+one\s+here\s+is\s+laid\s+out)\b/i
];

function visibleText(markdown: string): string {
  const document = load(marked.parse(markdown, { async: false }) as string);
  document("p,li,h1,h2,h3,h4,h5,h6,td,th,br").append(" ");
  return document.root().text().replace(/\s+/g, " ").trim();
}

/** Roblox collection finals only. Other page families retain their own field contracts. */
export function robloxCollectionCopyFindings(final: Record<string, unknown>): CopyFinding[] {
  const findings: CopyFinding[] = [];
  const how = final.how_it_works_md;
  if (how != null && (typeof how !== "string" || how.trim())) {
    findings.push({ field: "how_it_works_md", rule: "Roblox collection help field must be empty", excerpt: "Put useful game mechanics in description_md. Leave how_it_works_md empty." });
  }
  const visit = (value: unknown, parts: string[]) => {
    if (typeof value === "string") {
      const text = visibleText(value);
      const match = PAGE_INSTRUCTIONS.map(pattern => pattern.exec(text)).find(Boolean);
      if (match) findings.push({ field: parts.join("."), rule: "collection page instructions instead of game advice", excerpt: text.slice(Math.max(0, match.index - 40), match.index + 150) });
    } else if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, [...parts, String(index)]));
    } else if (value && typeof value === "object") {
      Object.entries(value).forEach(([key, entry]) => visit(entry, [...parts, key]));
    }
  };
  for (const [field, value] of Object.entries(final)) {
    if (COPY_FIELDS.has(field)) visit(value, [field]);
  }
  return findings;
}

export function assertRobloxCollectionCopy(final: Record<string, unknown>): void {
  const findings = robloxCollectionCopyFindings(final);
  if (findings.length) throw new Error(`Roblox collection copy needs revision:\n${findings.map(f => `${f.field}: ${f.rule}. ${f.excerpt}`).join("\n")}`);
}
