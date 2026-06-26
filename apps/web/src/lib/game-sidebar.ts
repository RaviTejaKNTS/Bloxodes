import "server-only";
import {
  getEventsPageByUniverseId,
  listCodePagesWithActiveCountsByUniverseId,
  listPublishedArticles,
  listPublishedArticlesByUniverseId,
  listPublishedChecklistsByUniverseId
} from "@/lib/db";
import { getUniverseEventSummary } from "@/lib/events-summary";
import { getWikiByUniverseId } from "@/lib/wiki";
import { getQuizByUniverseId, loadQuizData } from "@/lib/quizzes";
import { buildServerQuizAttempt } from "@/lib/quiz-attempts";
import { getUniverseStatsSummary } from "@/lib/stats";
import { listPublishedToolsByUniverseId, type ToolListEntry } from "@/lib/tools";
import { buildWikiCollectionPath, listPublishedWikiCollectionPagesByUniverseId } from "@/lib/wiki-collections";
import { listPublishedTopLevelCatalogPages } from "@/lib/catalog";
import { resolveCatalogCardMeta, type CatalogIconKey } from "@/lib/catalog-card-meta";

/** The card types the sidebar can render. The current page's own type is excluded by the renderer. */
export type SidebarType = "wiki" | "codes" | "checklist" | "quiz" | "events" | "articles";

export type SidebarArticle = { slug: string; title: string; coverImage: string | null };

export type SidebarCatalogLink = { href: string; title: string; count: number | null };

export type SidebarGlobalCatalog = {
  href: string;
  title: string;
  count: number | null;
  iconKey: CatalogIconKey | null;
  tone: "indigo" | "emerald" | "amber";
};

export type GameSidebarData = {
  universeIcon: string | null;
  wiki: { slug: string; title: string; iconUrl: string | null } | null;
  catalogs: SidebarCatalogLink[];
  stats: { rank: number | null; playing: number | null; slug: string | null; iconUrl: string | null } | null;
  event: {
    slug: string;
    eventName: string;
    startUtc: string | null;
    endUtc: string | null;
    status: "upcoming" | "current";
    coverImage: string | null;
  } | null;
  codes: { slug: string; name: string; activeCount: number; coverImage: string | null } | null;
  checklist: { slug: string; title: string; itemsCount: number; coverImage: string | null } | null;
  quiz: {
    code: string;
    firstQuestion: {
      id: string;
      question: string;
      image: string | null;
      options: { id: string; text: string }[];
      correctOptionId: string;
    };
  } | null;
  tools: ToolListEntry[];
  articles: SidebarArticle[];
  /** Populated only when the game has fewer than 3 of its own cards. */
  fallback: { articles: SidebarArticle[]; catalogs: SidebarGlobalCatalog[] } | null;
};

const CATALOG_TONES = ["indigo", "amber", "emerald"] as const;

function mapArticle(row: { slug?: string | null; title?: string | null; cover_image?: string | null }): SidebarArticle | null {
  if (!row.slug || !row.title) return null;
  return { slug: row.slug, title: row.title, coverImage: row.cover_image ?? null };
}

export async function getGameSidebarData(universeId: number): Promise<GameSidebarData> {
  const [wiki, catalogRows, stats, eventSummary, eventsPage, codesRows, checklistRows, quizEntry, tools, articleRows] =
    await Promise.all([
      getWikiByUniverseId(universeId).catch(() => null),
      listPublishedWikiCollectionPagesByUniverseId(universeId).catch(() => []),
      getUniverseStatsSummary(universeId).catch(() => null),
      getUniverseEventSummary(universeId).catch(() => null),
      getEventsPageByUniverseId(universeId).catch(() => null),
      listCodePagesWithActiveCountsByUniverseId(universeId, 1).catch(() => []),
      listPublishedChecklistsByUniverseId(universeId, 1).catch(() => []),
      getQuizByUniverseId(universeId).catch(() => null),
      listPublishedToolsByUniverseId(universeId, 3).catch(() => []),
      listPublishedArticlesByUniverseId(universeId, 4, 0).catch(() => [])
    ]);

  // Catalogs (game-scoped) → simple "All N <title>" links.
  const catalogs: SidebarCatalogLink[] = (catalogRows ?? [])
    .filter((row) => row.wiki_slug && row.collection_slug)
    .map((row) => ({
      href: buildWikiCollectionPath(row.wiki_slug as string, row.collection_slug as string),
      title: row.display_name?.trim() || row.title,
      count: typeof row.item_count === "number" ? row.item_count : null
    }));

  // Event card only when there is a next/live event.
  let event: GameSidebarData["event"] = null;
  const featured = eventSummary?.featured ?? null;
  if (eventsPage?.slug && featured && (featured.status === "upcoming" || featured.status === "current")) {
    event = {
      slug: eventsPage.slug,
      eventName: featured.name,
      startUtc: featured.startUtc,
      endUtc: featured.endUtc,
      status: featured.status,
      coverImage: eventsPage.universe?.icon_url ?? null
    };
  }

  const codeRow = (codesRows ?? [])[0] ?? null;
  const codes = codeRow
    ? { slug: codeRow.slug, name: codeRow.name, activeCount: codeRow.active_count ?? 0, coverImage: codeRow.cover_image ?? null }
    : null;

  const checklistRow = (checklistRows ?? [])[0] ?? null;
  const checklist = checklistRow
    ? {
        slug: checklistRow.slug,
        title: checklistRow.title,
        itemsCount:
          typeof checklistRow.leaf_item_count === "number"
            ? checklistRow.leaf_item_count
            : typeof checklistRow.item_count === "number"
              ? checklistRow.item_count
              : 0,
        coverImage: checklistRow.universe?.icon_url ?? null
      }
    : null;

  // Quiz first question (deterministic, matches the quiz page's server attempt).
  let quiz: GameSidebarData["quiz"] = null;
  if (quizEntry?.code) {
    const quizData = await loadQuizData(quizEntry.code).catch(() => null);
    if (quizData) {
      const first = buildServerQuizAttempt(quizData, quizEntry.code)[0];
      if (first) {
        quiz = {
          code: quizEntry.code,
          firstQuestion: {
            id: first.id,
            question: first.question,
            image: first.image ?? null,
            options: (first.options ?? []).map((option) => ({ id: option.id, text: option.text })),
            correctOptionId: first.correctOptionId
          }
        };
      }
    }
  }

  const articles = (articleRows ?? [])
    .map((row) => mapArticle(row as { slug?: string | null; title?: string | null; cover_image?: string | null }))
    .filter((entry): entry is SidebarArticle => Boolean(entry));

  const presentCount = [
    Boolean(wiki),
    catalogs.length > 0,
    Boolean(stats),
    Boolean(event),
    Boolean(codes),
    Boolean(checklist),
    Boolean(quiz),
    tools.length > 0,
    articles.length > 0
  ].filter(Boolean).length;

  let fallback: GameSidebarData["fallback"] = null;
  if (presentCount < 3) {
    const [generalArticleRows, topCatalogs] = await Promise.all([
      listPublishedArticles(4).catch(() => []),
      listPublishedTopLevelCatalogPages().catch(() => [])
    ]);
    const generalArticles = (generalArticleRows ?? [])
      .map((row) => mapArticle(row as { slug?: string | null; title?: string | null; cover_image?: string | null }))
      .filter((entry): entry is SidebarArticle => Boolean(entry))
      .slice(0, 3);
    const globalCatalogs: SidebarGlobalCatalog[] = (
      await Promise.all(
        (topCatalogs ?? []).slice(0, 3).map(async (page, index) => {
          const meta = await resolveCatalogCardMeta(page.code).catch(() => null);
          return {
            href: `/catalog/${page.code}`,
            title: meta?.shortLabel ?? page.title,
            count: meta?.count ?? null,
            iconKey: meta?.icon ?? null,
            tone: CATALOG_TONES[index % CATALOG_TONES.length]
          };
        })
      )
    ).filter(Boolean);
    fallback = { articles: generalArticles, catalogs: globalCatalogs };
  }

  const universeIcon = stats?.iconUrl ?? wiki?.iconUrl ?? checklist?.coverImage ?? codes?.coverImage ?? null;

  return { universeIcon, wiki, catalogs, stats, event, codes, checklist, quiz, tools, articles, fallback };
}
