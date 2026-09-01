import fs from "node:fs/promises";
import path from "node:path";

type Finding = {
  file: string;
  field: string;
  rule: string;
  excerpt: string;
};

const PUBLIC_COPY_KEYS = new Set([
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
  "description"
]);

const HARD_PATTERNS: Array<{ rule: string; pattern: RegExp }> = [
  {
    rule: "self-referential catalog CTA",
    pattern: /\b(use|check|open|browse|visit|see)\s+(?:the|this|our|[a-z0-9' -]{1,60})?\s*catalog\b/i
  },
  {
    rule: "self-referential page/catalog wording",
    pattern: /\bthis\s+(catalog|page|guide|dataset|database)\b/i
  },
  {
    rule: "public dataset reference",
    pattern: /\bdataset\b/i
  },
  {
    rule: "Bloxodes self-reference",
    pattern: /\bBloxodes\b/
  },
  {
    rule: "field-command copy",
    pattern: /\b(read|check|use)\s+(?:the\s+)?(category|rarity|source|availability|effect|price|cost|requirement|requirements|field|fields)\s+first\b/i
  },
  {
    rule: "AI-ish contrast filler",
    pattern: /\bnot\s+(just|only)\b/i
  }
];

function isPublicCopyPath(parts: string[]): boolean {
  return parts.some((part) => PUBLIC_COPY_KEYS.has(part));
}

function excerpt(value: string, index: number): string {
  const start = Math.max(0, index - 50);
  const end = Math.min(value.length, index + 130);
  return value.slice(start, end).replace(/\s+/g, " ").trim();
}

function scanString(value: string, file: string, field: string): Finding[] {
  const findings: Finding[] = [];

  for (const rule of HARD_PATTERNS) {
    const match = rule.pattern.exec(value);
    if (!match) continue;
    findings.push({
      file,
      field,
      rule: rule.rule,
      excerpt: excerpt(value, match.index)
    });
  }

  if (field.endsWith("wiki_md") && /^\s*(use|check|open|browse|visit|see)\b/i.test(value)) {
    findings.push({
      file,
      field,
      rule: "wiki_md starts as a CTA instead of a game-system explanation",
      excerpt: excerpt(value, 0)
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

function scanRepeatedStarts(strings: Array<{ field: string; value: string }>, file: string): Finding[] {
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

  const findings: Finding[] = [];
  for (const [start, entries] of starts.entries()) {
    if (entries.length < 4) continue;
    if (!/^(compare|use|check|start|the)\b/.test(start)) continue;
    findings.push({
      file,
      field: entries.map((entry) => entry.field).slice(0, 5).join(", "),
      rule: "repeated public-copy opening pattern",
      excerpt: `${entries.length} fields start with "${start}"`
    });
  }
  return findings;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function scanQuizOptionBalance(value: unknown, file: string): Finding[] {
  const root = isRecord(value) && "quizData" in value ? value.quizData : value;
  if (!isRecord(root)) return [];

  const findings: Finding[] = [];

  for (const level of ["easy", "medium", "hard"]) {
    const questions = root[level];
    if (!Array.isArray(questions)) continue;

    questions.forEach((entry, index) => {
      if (!isRecord(entry)) return;
      const questionId = typeof entry.id === "string" && entry.id.trim() ? entry.id : `${level}[${index}]`;
      const correctOptionId = typeof entry.correctOptionId === "string" ? entry.correctOptionId : null;
      const rawOptions = Array.isArray(entry.options) ? entry.options : [];
      const options = rawOptions
        .filter(isRecord)
        .map((option) => ({
          id: typeof option.id === "string" ? option.id : "",
          text: typeof option.text === "string" ? option.text : ""
        }))
        .filter((option) => option.id && option.text);

      if (!correctOptionId || options.length !== 4) return;

      const counts = options.map((option) => ({
        ...option,
        words: countWords(option.text)
      }));
      const sorted = [...counts].sort((a, b) => b.words - a.words);
      const [longest, secondLongest] = sorted;
      const max = longest?.words ?? 0;
      const min = Math.min(...counts.map((option) => option.words));
      const summary = counts.map((option) => `${option.id}:${option.words}w`).join(", ");

      if (longest && secondLongest && longest.id === correctOptionId && longest.words - secondLongest.words >= 3) {
        findings.push({
          file,
          field: `quizData.${level}.${questionId}.options`,
          rule: "quiz answer length tell",
          excerpt: `Correct option ${correctOptionId} is uniquely longest (${summary})`
        });
      }

      if (max - min > 8) {
        findings.push({
          file,
          field: `quizData.${level}.${questionId}.options`,
          rule: "quiz option length imbalance",
          excerpt: `Option word counts are too spread out (${summary})`
        });
      }
    });
  }

  return findings;
}

async function readJson(file: string): Promise<unknown> {
  const raw = await fs.readFile(file, "utf8");
  return JSON.parse(raw);
}

async function scanFile(file: string): Promise<Finding[]> {
  const absolute = path.resolve(file);
  const parsed = await readJson(absolute);
  const strings = collectPublicStrings(parsed);
  return [
    ...strings.flatMap((entry) => scanString(entry.value, file, entry.field)),
    ...scanRepeatedStarts(strings, file),
    ...scanQuizOptionBalance(parsed, file)
  ];
}

async function main() {
  const files = process.argv.slice(2).filter((value) => !value.startsWith("--"));
  if (!files.length) {
    throw new Error("Usage: tsx scripts/content/check-public-copy.ts <final.json> [...final.json]");
  }

  const findings = (await Promise.all(files.map(scanFile))).flat();
  if (!findings.length) {
    console.log(`Public copy check passed for ${files.length} file${files.length === 1 ? "" : "s"}.`);
    return;
  }

  console.error(`Public copy check failed with ${findings.length} finding${findings.length === 1 ? "" : "s"}:`);
  for (const finding of findings) {
    console.error(`- ${finding.file} :: ${finding.field} :: ${finding.rule}`);
    console.error(`  ${finding.excerpt}`);
  }
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
