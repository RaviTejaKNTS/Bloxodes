import { readFileSync } from "node:fs";

// Skills and script-based writers consume the same maintained house style.
export const ARTICLE_EDITORIAL_STANDARD = readFileSync(
  new URL("../../.agents/skills/bloxodes-article-writing/references/editorial-standard.md", import.meta.url),
  "utf8"
).trim();
