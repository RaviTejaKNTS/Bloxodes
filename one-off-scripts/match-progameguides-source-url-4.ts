import { readFile, writeFile } from "node:fs/promises";

import { createTargetClient, fetchAllRows } from "./supabase-env";

const DOC_PATH = "docs/Pro Game Guides Roblox Codes Articles.md";
const OUTPUT_PATH = "docs/Pro Game Guides Source URL 4 Candidates.md";

type ProGameGuidesArticle = {
  index: number;
  indexLabel: string;
  slug: string;
  gameName: string;
  url: string;
  notes: string;
};

type GameRow = {
  id: string;
  name: string;
  slug: string;
  old_slugs: string[] | null;
  source_url: string | null;
  source_url_2: string | null;
  source_url_3: string | null;
  source_url_4: string | null;
  is_published: boolean;
};

type MatchReason = "article_slug" | "article_slug_roblox_prefix" | "game_name_slug" | "old_slug";

type CandidateMatch = {
  article: ProGameGuidesArticle;
  game: GameRow;
  reason: MatchReason;
};

type FuzzyCandidate = {
  article: ProGameGuidesArticle;
  game: GameRow;
  confidence: "high" | "review";
  reason: string;
};

const MANUAL_MATCHES: Record<string, string> = {};
const MANUAL_SKIP_MATCHES = new Set<string>();

function parseLink(cell: string): string | null {
  return cell.match(/\[Link\]\((.*?)\)/)?.[1] ?? null;
}

function splitMarkdownRow(line: string): string[] | null {
  if (!line.startsWith("|")) return null;
  const cells: string[] = [];
  let current = "";

  for (let index = 1; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\\" && next === "|") {
      current += "|";
      index += 1;
      continue;
    }
    if (char === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  return cells;
}

function parseProGameGuidesDoc(markdown: string): ProGameGuidesArticle[] {
  const rows: ProGameGuidesArticle[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const cells = splitMarkdownRow(line);
    if (!cells || cells.length !== 6 || !/^\d+$/.test(cells[0])) continue;
    const [index, indexLabel, slugCell, gameName, urlCell, notes] = cells;
    const slug = slugCell.match(/^`([^`]+)`$/)?.[1];
    const url = parseLink(urlCell);
    if (!url || !slug) continue;
    rows.push({
      index: Number(index),
      indexLabel,
      slug,
      gameName,
      url,
      notes
    });
  }
  return rows;
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/([a-zA-Z])['’]s\b/g, "$1s")
    .replace(/&/g, " and ")
    .replace(/\+/g, " plus ")
    .replace(/['’]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .toLowerCase();
}

function stripParentheticalAcronyms(value: string): string {
  return value.replace(/\s*\(([A-Z0-9]{2,8})\)\s*/g, " ").replace(/\s+/g, " ").trim();
}

function acronymSuffixes(value: string): string[] {
  const suffixes = Array.from(value.matchAll(/\(([A-Z0-9]{2,8})\)/g)).map((match) => slugify(match[1]));
  return unique(suffixes.filter(Boolean));
}

function stripKnownSlugNoise(slug: string): string {
  let cleaned = slug
    .replace(/^roblox-/, "")
    .replace(/-codes?$/, "")
    .replace(/-do-they-exist.*$/, "")
    .replace(/-do-any-exist.*$/, "")
    .replace(/-are-there-any.*$/, "")
    .replace(/-is-there.*$/, "")
    .replace(/-and-how-to-use-them$/, "")
    .replace(/-private-servers-codes$/, "-private-server")
    .replace(/-server-codes$/, "-server");

  cleaned = cleaned
    .replace(/-may-\d{4}.*$/, "")
    .replace(/-april-\d{4}.*$/, "")
    .replace(/-march-\d{4}.*$/, "")
    .replace(/-february-\d{4}.*$/, "")
    .replace(/-january-\d{4}.*$/, "")
    .replace(/-june-\d{4}.*$/, "")
    .replace(/-july-\d{4}.*$/, "")
    .replace(/-august-\d{4}.*$/, "")
    .replace(/-september-\d{4}.*$/, "")
    .replace(/-october-\d{4}.*$/, "")
    .replace(/-november-\d{4}.*$/, "")
    .replace(/-december-\d{4}.*$/, "");

  return cleaned;
}

function articleSlugVariants(article: ProGameGuidesArticle): string[] {
  const stripped = stripKnownSlugNoise(article.slug);
  const gameNameSlug = slugify(article.gameName);
  const acronymStrippedGameNameSlug = slugify(stripParentheticalAcronyms(article.gameName));
  const variants = [
    stripped,
    stripped.replace(/^roblox-/, ""),
    gameNameSlug,
    acronymStrippedGameNameSlug
  ];

  for (const suffix of acronymSuffixes(article.gameName)) {
    for (const base of [...variants]) {
      if (base.endsWith(`-${suffix}`)) {
        variants.push(base.slice(0, -suffix.length - 1));
      }
    }
  }

  return unique(variants.filter(Boolean));
}

function sourceLink(url: string | null | undefined): string {
  return url ? `[Link](${url})` : "";
}

function mdEscape(value: string): string {
  return value.replace(/\|/g, "\\|");
}

function reasonLabel(reason: MatchReason): string {
  switch (reason) {
    case "article_slug":
      return "article slug";
    case "article_slug_roblox_prefix":
      return "article slug without roblox prefix";
    case "game_name_slug":
      return "game name";
    case "old_slug":
      return "old slug";
  }
}

async function loadLocalGames(): Promise<GameRow[]> {
  const local = createTargetClient("local");
  return fetchAllRows<GameRow>(
    local,
    "games",
    "id,name,slug,old_slugs,source_url,source_url_2,source_url_3,source_url_4,is_published",
    "id"
  );
}

function buildMatches(articles: ProGameGuidesArticle[], games: GameRow[]): CandidateMatch[][] {
  const bySlug = new Map<string, GameRow[]>();
  const byNameSlug = new Map<string, GameRow[]>();
  const byOldSlug = new Map<string, GameRow[]>();

  const add = (map: Map<string, GameRow[]>, key: string, game: GameRow) => {
    if (!key) return;
    const rows = map.get(key) ?? [];
    rows.push(game);
    map.set(key, rows);
  };

  for (const game of games) {
    add(bySlug, game.slug, game);
    add(byNameSlug, slugify(game.name), game);
    for (const oldSlug of game.old_slugs ?? []) {
      add(byOldSlug, oldSlug, game);
    }
  }

  return articles.map((article) => {
    const variants = articleSlugVariants(article);
    const stripped = variants[0] ?? "";
    const noRobloxPrefix = stripped.replace(/^roblox-/, "");
    const gameNameSlug = slugify(stripParentheticalAcronyms(article.gameName));
    const matches: CandidateMatch[] = [];

    for (const variant of variants) {
      for (const game of bySlug.get(variant) ?? []) matches.push({ article, game, reason: "article_slug" });
      for (const game of byOldSlug.get(variant) ?? []) matches.push({ article, game, reason: "old_slug" });
    }
    if (noRobloxPrefix !== stripped) {
      for (const game of bySlug.get(noRobloxPrefix) ?? []) {
        matches.push({ article, game, reason: "article_slug_roblox_prefix" });
      }
    }
    for (const game of byNameSlug.get(gameNameSlug) ?? []) matches.push({ article, game, reason: "game_name_slug" });

    const seen = new Set<string>();
    return matches.filter((match) => {
      if (MANUAL_SKIP_MATCHES.has(`${article.slug}:${match.game.slug}`)) {
        return false;
      }
      const key = `${match.game.id}:${match.reason}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });
}

function buildFuzzyCandidates(
  articles: ProGameGuidesArticle[],
  games: GameRow[],
  alreadyResolved: Set<string>
): FuzzyCandidate[] {
  const candidates: FuzzyCandidate[] = [];
  const gamesBySimpleName = new Map<string, GameRow[]>();

  for (const game of games) {
    const key = slugify(stripParentheticalAcronyms(game.name));
    const rows = gamesBySimpleName.get(key) ?? [];
    rows.push(game);
    gamesBySimpleName.set(key, rows);
  }

  for (const article of articles) {
    if (alreadyResolved.has(article.url)) continue;
    const variants = articleSlugVariants(article);
    const localMatches = unique(variants.flatMap((variant) => gamesBySimpleName.get(variant) ?? []));
    if (localMatches.length !== 1) continue;
    const game = localMatches[0];
    if (MANUAL_SKIP_MATCHES.has(`${article.slug}:${game.slug}`)) continue;
    if (game.source_url_4 === article.url) continue;
    candidates.push({
      article,
      game,
      confidence: "high",
      reason: "normalized name or acronym-stripped slug"
    });
  }

  return candidates;
}

function renderUpdateRow(index: number, match: CandidateMatch): string {
  return `| ${index} | ${mdEscape(match.game.name)} | \`${match.game.slug}\` | ${mdEscape(match.article.indexLabel)} | \`${match.article.slug}\` | ${sourceLink(match.article.url)} | ${reasonLabel(match.reason)} | ${mdEscape(match.article.notes)} | ${sourceLink(match.game.source_url_4)} |`;
}

function renderAmbiguousRow(index: number, article: ProGameGuidesArticle, matches: CandidateMatch[]): string {
  const games = matches.map((match) => `${match.game.name} (\`${match.game.slug}\`, ${reasonLabel(match.reason)})`).join("<br>");
  return `| ${index} | ${mdEscape(article.gameName)} | ${mdEscape(article.indexLabel)} | \`${article.slug}\` | ${sourceLink(article.url)} | ${mdEscape(article.notes)} | ${mdEscape(games)} |`;
}

function renderNoMatchRow(index: number, article: ProGameGuidesArticle): string {
  return `| ${index} | ${mdEscape(article.gameName)} | ${mdEscape(article.indexLabel)} | \`${article.slug}\` | ${sourceLink(article.url)} | ${mdEscape(article.notes)} |`;
}

function renderFuzzyRow(index: number, candidate: FuzzyCandidate): string {
  return `| ${index} | ${mdEscape(candidate.article.gameName)} | ${mdEscape(candidate.article.indexLabel)} | \`${candidate.article.slug}\` | ${sourceLink(candidate.article.url)} | ${mdEscape(candidate.article.notes)} | ${mdEscape(candidate.game.name)} | \`${candidate.game.slug}\` | ${candidate.confidence} | ${candidate.reason} | ${sourceLink(candidate.game.source_url_4)} |`;
}

async function main() {
  const articles = parseProGameGuidesDoc(await readFile(DOC_PATH, "utf8"));
  const games = await loadLocalGames();
  const matchGroups = buildMatches(articles, games);
  const pggUrlsInDb = new Set(games.map((game) => game.source_url_4).filter((url): url is string => Boolean(url)));

  const ready: CandidateMatch[] = [];
  const alreadyPresent: CandidateMatch[] = [];
  const ambiguous: Array<{ article: ProGameGuidesArticle; matches: CandidateMatch[] }> = [];
  const noMatch: ProGameGuidesArticle[] = [];
  const resolvedArticleUrls = new Set<string>();
  const duplicateLocalTargets = new Map<string, CandidateMatch[]>();

  for (let i = 0; i < articles.length; i += 1) {
    const article = articles[i];
    const matches = matchGroups[i];
    const manualSlug = MANUAL_MATCHES[article.slug];
    const manualMatch = manualSlug ? matches.find((match) => match.game.slug === manualSlug) : undefined;
    if (manualSlug && !manualMatch) {
      throw new Error(`Manual match target not found for ${article.slug}: ${manualSlug}`);
    }
    if (manualMatch) {
      if (manualMatch.game.source_url_4 === article.url) {
        alreadyPresent.push(manualMatch);
      } else {
        ready.push(manualMatch);
      }
      resolvedArticleUrls.add(article.url);
      continue;
    }

    const uniqueGames = unique(matches.map((match) => match.game.id));
    if (matches.length === 0) {
      noMatch.push(article);
      continue;
    }
    if (uniqueGames.length > 1) {
      ambiguous.push({ article, matches });
      resolvedArticleUrls.add(article.url);
      continue;
    }

    const best =
      matches.find((match) => match.reason === "article_slug") ??
      matches.find((match) => match.reason === "article_slug_roblox_prefix") ??
      matches.find((match) => match.reason === "old_slug") ??
      matches[0];

    if (best.game.source_url_4 === article.url) {
      alreadyPresent.push(best);
      resolvedArticleUrls.add(article.url);
    } else if (best.game.source_url_4) {
      ready.push(best);
      resolvedArticleUrls.add(article.url);
    } else if (!pggUrlsInDb.has(article.url)) {
      ready.push(best);
      resolvedArticleUrls.add(article.url);
      const bucket = duplicateLocalTargets.get(best.game.id) ?? [];
      bucket.push(best);
      duplicateLocalTargets.set(best.game.id, bucket);
    }
  }

  const targetConflicts = Array.from(duplicateLocalTargets.values()).filter((items) => items.length > 1);
  const readyWithoutTargetConflicts = ready.filter((match) => (duplicateLocalTargets.get(match.game.id)?.length ?? 1) === 1);
  const fuzzyCandidates = buildFuzzyCandidates(articles, games, resolvedArticleUrls);

  const lines = [
    "# Pro Game Guides Source URL 4 Candidates",
    "",
    "Source: local `public.games` plus `docs/Pro Game Guides Roblox Codes Articles.md`.",
    "Purpose: review Pro Game Guides URLs that can be placed in `games.source_url_4`.",
    "",
    `Local games checked: ${games.length}`,
    `Pro Game Guides articles checked: ${articles.length}`,
    `Ready high-confidence updates: ${readyWithoutTargetConflicts.length}`,
    `Already present in source_url_4: ${alreadyPresent.length}`,
    `Ambiguous article matches: ${ambiguous.length}`,
    `Possible fuzzy matches: ${fuzzyCandidates.length}`,
    `Multiple Pro Game Guides URLs matched the same empty local game: ${targetConflicts.length}`,
    `No local match: ${noMatch.length}`,
    "",
    "## Ready to Update Source URL 4",
    "",
    "| # | Game Name | Local Slug | PGG Index Label | PGG Slug | Source URL 4 | Match Reason | PGG Notes | Current Source URL 4 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...readyWithoutTargetConflicts.map((match, index) => renderUpdateRow(index + 1, match)),
    "",
    "## Already Present",
    "",
    "| # | Game Name | Local Slug | PGG Index Label | PGG Slug | Source URL 4 | Match Reason | PGG Notes | Current Source URL 4 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...alreadyPresent.map((match, index) => renderUpdateRow(index + 1, match)),
    "",
    "## Multiple URLs For Same Empty Game",
    "",
    "| # | Local Game | Local Slug | Candidate URLs |",
    "| --- | --- | --- | --- |",
    ...targetConflicts.map((matches, index) => {
      const game = matches[0].game;
      const links = matches.map((match) => `${mdEscape(match.article.indexLabel)} ${sourceLink(match.article.url)}`).join("<br>");
      return `| ${index + 1} | ${mdEscape(game.name)} | \`${game.slug}\` | ${links} |`;
    }),
    "",
    "## Ambiguous Article Matches",
    "",
    "| # | PGG Game Name | PGG Index Label | PGG Slug | URL | PGG Notes | Local Candidates |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...ambiguous.map(({ article, matches }, index) => renderAmbiguousRow(index + 1, article, matches)),
    "",
    "## Possible Fuzzy Matches",
    "",
    "Review-only. These are not included in ready updates until approved.",
    "",
    "| # | PGG Game Name | PGG Index Label | PGG Slug | URL | PGG Notes | Local Game | Local Slug | Confidence | Reason | Current Source URL 4 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...fuzzyCandidates.map((candidate, index) => renderFuzzyRow(index + 1, candidate)),
    "",
    "## No Local Match",
    "",
    "| # | PGG Game Name | PGG Index Label | PGG Slug | URL | PGG Notes |",
    "| --- | --- | --- | --- | --- | --- |",
    ...noMatch.map((article, index) => renderNoMatchRow(index + 1, article)),
    ""
  ];

  await writeFile(OUTPUT_PATH, lines.join("\n"));
  console.log(JSON.stringify({
    outputPath: OUTPUT_PATH,
    localGames: games.length,
    proGameGuidesArticles: articles.length,
    readyHighConfidenceUpdates: readyWithoutTargetConflicts.length,
    alreadyPresent: alreadyPresent.length,
    ambiguousArticleMatches: ambiguous.length,
    possibleFuzzyMatches: fuzzyCandidates.length,
    multipleUrlsForSameEmptyGame: targetConflicts.length,
    noLocalMatch: noMatch.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
