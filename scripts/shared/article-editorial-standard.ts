import { readFileSync } from "node:fs";

function readSkillText(relativePath: string): string {
  // Inline prompts cannot follow links, so drop skill frontmatter and embed the text.
  return readFileSync(new URL(relativePath, import.meta.url), "utf8")
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "")
    .trim();
}

// Skills and script-based writers consume the same maintained house voice and article standard.
export const ARTICLE_EDITORIAL_STANDARD = [
  readSkillText("../../.agents/skills/bloxodes-voice/SKILL.md"),
  readSkillText("../../.agents/skills/bloxodes-article-writing/references/editorial-standard.md")
].join("\n\n");
