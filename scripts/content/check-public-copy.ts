import fs from "node:fs/promises";
import path from "node:path";
import { scanPublicCopy, type PublicCopyFinding } from "./public-copy-rules";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function scanQuizOptionBalance(value: unknown, file: string): PublicCopyFinding[] {
  const root = isRecord(value) && "quizData" in value ? value.quizData : value;
  if (!isRecord(root)) return [];

  const findings: PublicCopyFinding[] = [];

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

async function scanFile(file: string): Promise<PublicCopyFinding[]> {
  const absolute = path.resolve(file);
  const parsed = await readJson(absolute);
  return [
    ...scanPublicCopy(parsed, file),
    ...scanQuizOptionBalance(parsed, file),
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
