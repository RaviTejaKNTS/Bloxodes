import { readFile, writeFile } from "node:fs/promises";

import { createTargetClient, fetchAllRows } from "./supabase-env";

const DOC_PATH = "docs/Destructoid Roblox Codes Articles.md";
const OUTPUT_PATH = "docs/Destructoid Source URL 3 Candidates.md";

type DestructoidArticle = {
  index: number;
  title: string;
  slug: string;
  gameName: string;
  url: string;
};

type GameRow = {
  id: string;
  name: string;
  slug: string;
  old_slugs: string[] | null;
  source_url: string | null;
  source_url_2: string | null;
  source_url_3: string | null;
  is_published: boolean;
};

type MatchReason = "article_slug" | "article_slug_roblox_prefix" | "game_name_slug" | "old_slug";

type CandidateMatch = {
  article: DestructoidArticle;
  game: GameRow;
  reason: MatchReason;
};

type FuzzyCandidate = {
  article: DestructoidArticle;
  game: GameRow;
  confidence: "high" | "review";
  reason: string;
};

const MANUAL_MATCHES: Record<string, string> = {
  "anime-clash-codes": "anime-clash",
  "huzz-rng-codes": "anime-girl-rng",
  "rng-anime-rarities-codes": "rng-anime-rarities",
  "ultimate-football-codes": "nfl-universe-football",
  "the-time-of-ninja-codes": "ninja-time",
  "pls-donate-codes": "pls-donate-but-infinite-robux",
  "anime-rangers-x-codes": "re-rangers-x",
  "skibidi-toilet-battle-codes": "skibidi-toilet-battle",
  "warrior-simulator-codes": "weapon-warrior-simulator"
};

const MANUAL_SKIP_MATCHES = new Set([
  "anime-fantasy-codes:anime-fantasy",
  "just-brainrot-tower-defense-codes:brainrot-tower-defense",
  "paradox-codes:paradox"
]);

function parseLink(cell: string): string | null {
  return cell.match(/\[Link\]\((.*?)\)/)?.[1] ?? null;
}

function parseDestructoidDoc(markdown: string): DestructoidArticle[] {
  const rows: DestructoidArticle[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^\|\s*(\d+)\s*\|\s*(.*?)\s*\|\s*`([^`]+)`\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|$/);
    if (!match) continue;
    const [, index, title, slug, gameName, urlCell] = match;
    const url = parseLink(urlCell);
    if (!url) continue;
    rows.push({
      index: Number(index),
      title: title.trim().replace(/\\\|/g, "|"),
      slug: slug.trim(),
      gameName: gameName.trim().replace(/\\\|/g, "|"),
      url
    });
  }
  return rows;
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
    .replace(/-dynamic_date-formatf-y$/, "")
    .replace(/-are-there-any$/, "")
    .replace(/-and-how-to-use-them$/, "")
    .replace(/-private-servers-codes$/, "-private-server")
    .replace(/-server-codes$/, "-server")
    .replace(/-codes?$/, "");

  cleaned = cleaned
    .replace(/-may-\d{4}$/, "")
    .replace(/-april-\d{4}$/, "")
    .replace(/-march-\d{4}$/, "")
    .replace(/-february-\d{4}$/, "")
    .replace(/-january-\d{4}$/, "");

  return cleaned;
}

function articleSlugVariants(article: DestructoidArticle): string[] {
  const stripped = stripKnownSlugNoise(article.slug);
  const variants = [
    stripped,
    stripped.replace(/^roblox-/, ""),
    slugify(article.gameName),
    slugify(stripParentheticalAcronyms(article.gameName))
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

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
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
  const local = createTargetClient("dev");
  return fetchAllRows<GameRow>(
    local,
    "games",
    "id,name,slug,old_slugs,source_url,source_url_2,source_url_3,is_published",
    "id"
  );
}

function buildMatches(articles: DestructoidArticle[], games: GameRow[]): CandidateMatch[][] {
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

function buildFuzzyCandidates(articles: DestructoidArticle[], games: GameRow[], alreadyResolved: Set<string>): FuzzyCandidate[] {
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
    if (game.source_url_3 === article.url) continue;
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
  return `| ${index} | ${mdEscape(match.game.name)} | \`${match.game.slug}\` | ${mdEscape(match.article.title)} | \`${match.article.slug}\` | ${sourceLink(match.article.url)} | ${reasonLabel(match.reason)} | ${sourceLink(match.game.source_url_3)} |`;
}

function renderAmbiguousRow(index: number, article: DestructoidArticle, matches: CandidateMatch[]): string {
  const games = matches.map((match) => `${match.game.name} (\`${match.game.slug}\`, ${reasonLabel(match.reason)})`).join("<br>");
  return `| ${index} | ${mdEscape(article.gameName)} | ${mdEscape(article.title)} | \`${article.slug}\` | ${sourceLink(article.url)} | ${mdEscape(games)} |`;
}

function renderNoMatchRow(index: number, article: DestructoidArticle): string {
  return `| ${index} | ${mdEscape(article.gameName)} | ${mdEscape(article.title)} | \`${article.slug}\` | ${sourceLink(article.url)} |`;
}

function renderFuzzyRow(index: number, candidate: FuzzyCandidate): string {
  return `| ${index} | ${mdEscape(candidate.article.gameName)} | ${mdEscape(candidate.article.title)} | \`${candidate.article.slug}\` | ${sourceLink(candidate.article.url)} | ${mdEscape(candidate.game.name)} | \`${candidate.game.slug}\` | ${candidate.confidence} | ${candidate.reason} | ${sourceLink(candidate.game.source_url_3)} |`;
}

async function main() {
  const articles = parseDestructoidDoc(await readFile(DOC_PATH, "utf8"));
  const games = await loadLocalGames();
  const matchGroups = buildMatches(articles, games);
  const destructoidUrlsInDb = new Set(games.map((game) => game.source_url_3).filter((url): url is string => Boolean(url)));

  const ready: CandidateMatch[] = [];
  const alreadyPresent: CandidateMatch[] = [];
  const ambiguous: Array<{ article: DestructoidArticle; matches: CandidateMatch[] }> = [];
  const noMatch: DestructoidArticle[] = [];
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
      if (manualMatch.game.source_url_3 === article.url) {
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

    if (best.game.source_url_3 === article.url) {
      alreadyPresent.push(best);
      resolvedArticleUrls.add(article.url);
    } else if (best.game.source_url_3) {
      ready.push(best);
      resolvedArticleUrls.add(article.url);
    } else if (!destructoidUrlsInDb.has(article.url)) {
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
    "# Destructoid Source URL 3 Candidates",
    "",
    "Source: local `public.code_pages` plus `docs/Destructoid Roblox Codes Articles.md`.",
    "Purpose: review Destructoid URLs that can be placed in `code_pages.source_url_3`.",
    "",
    `Local games checked: ${games.length}`,
    `Destructoid articles checked: ${articles.length}`,
    `Ready high-confidence updates: ${readyWithoutTargetConflicts.length}`,
    `Already present in source_url_3: ${alreadyPresent.length}`,
    `Ambiguous article matches: ${ambiguous.length}`,
    `Possible fuzzy matches: ${fuzzyCandidates.length}`,
    `Multiple Destructoid URLs matched the same empty local game: ${targetConflicts.length}`,
    `No local match: ${noMatch.length}`,
    "",
    "## Ready to Update Source URL 3",
    "",
    "| # | Game Name | Local Slug | Destructoid Title | Destructoid Slug | Source URL 3 | Match Reason | Current Source URL 3 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...readyWithoutTargetConflicts.map((match, index) => renderUpdateRow(index + 1, match)),
    "",
    "## Already Present",
    "",
    "| # | Game Name | Local Slug | Destructoid Title | Destructoid Slug | Source URL 3 | Match Reason | Current Source URL 3 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...alreadyPresent.map((match, index) => renderUpdateRow(index + 1, match)),
    "",
    "## Multiple URLs For Same Empty Game",
    "",
    "| # | Local Game | Local Slug | Candidate URLs |",
    "| --- | --- | --- | --- |",
    ...targetConflicts.map((matches, index) => {
      const game = matches[0].game;
      const links = matches.map((match) => `${mdEscape(match.article.title)} ${sourceLink(match.article.url)}`).join("<br>");
      return `| ${index + 1} | ${mdEscape(game.name)} | \`${game.slug}\` | ${links} |`;
    }),
    "",
    "## Ambiguous Article Matches",
    "",
    "| # | Destructoid Game Name | Destructoid Title | Destructoid Slug | URL | Local Candidates |",
    "| --- | --- | --- | --- | --- | --- |",
    ...ambiguous.map(({ article, matches }, index) => renderAmbiguousRow(index + 1, article, matches)),
    "",
    "## Possible Fuzzy Matches",
    "",
    "Review-only. These are not included in ready updates until approved.",
    "",
    "| # | Destructoid Game Name | Destructoid Title | Destructoid Slug | URL | Local Game | Local Slug | Confidence | Reason | Current Source URL 3 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...fuzzyCandidates.map((candidate, index) => renderFuzzyRow(index + 1, candidate)),
    "",
    "## No Local Match",
    "",
    "| # | Destructoid Game Name | Destructoid Title | Destructoid Slug | URL |",
    "| --- | --- | --- | --- | --- |",
    ...noMatch.map((article, index) => renderNoMatchRow(index + 1, article)),
    ""
  ];

  await writeFile(OUTPUT_PATH, lines.join("\n"));
  console.log(JSON.stringify({
    outputPath: OUTPUT_PATH,
    localGames: games.length,
    destructoidArticles: articles.length,
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
