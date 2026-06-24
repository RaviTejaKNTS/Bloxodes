import type { Metadata } from "next";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  listCodePagesWithActiveCounts,
  listPublishedArticles,
  listPublishedChecklists
} from "@/lib/db";
import { listPublishedQuizzes } from "@/lib/quizzes";
import { listPublishedTools } from "@/lib/tools";
import { CHECKLISTS_DESCRIPTION, QUIZZES_DESCRIPTION, SITE_DESCRIPTION, SITE_NAME, SITE_URL, buildAlternates } from "@/lib/seo";
import { listPublishedTopLevelCatalogPages } from "@/lib/catalog";
import { resolveCatalogCardMeta } from "@/lib/catalog-card-meta";
import { listPublishedWikiPages } from "@/lib/wiki";
import { GameCard } from "@/components/GameCard";
import { ArticleCard } from "@/components/ArticleCard";
import { ChecklistCard } from "@/components/ChecklistCard";
import { ToolCard } from "@/components/ToolCard";
import { EventsPageCard } from "@/components/EventsPageCard";
import { CatalogCard } from "@/components/CatalogCard";
import { QuizCard } from "@/components/QuizCard";
import { WikiCard } from "@/components/WikiCard";
import { buildEventsCards } from "./events/page-data";

const INITIAL_FEATURED_GAMES = 8;
const INITIAL_ARTICLES = 8;
const INITIAL_CHECKLISTS = 6;
const INITIAL_TOOLS = 6;
const INITIAL_WIKI = 8;
const INITIAL_EVENTS = 3;
const INITIAL_CATALOGS = 3;
const INITIAL_QUIZZES = 8;
const CATALOG_CARD_TONES = ["indigo", "amber", "emerald"] as const;

export const revalidate = 3600;

const PAGE_TITLE = `${SITE_NAME} | Roblox codes, guides, checklists, and tools`;
const PAGE_DESCRIPTION = SITE_DESCRIPTION;

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  keywords: [
    "Roblox codes",
    "Roblox promo codes",
    "free Roblox rewards",
    "Bloxodes",
    "updated Roblox codes",
    "Roblox checklists",
    "Roblox tools"
  ],
  alternates: buildAlternates(SITE_URL),
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    type: "website",
    images: [
      {
        url: `${SITE_URL}/Bloxodes.png`,
        width: 1200,
        height: 675,
        alt: PAGE_TITLE
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [`${SITE_URL}/Bloxodes.png`]
  }
};

type ChecklistCardData = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  universeName: string | null;
  coverImage: string | null;
  updatedAt: string | null;
  itemsCount: number | null;
};

type ListEntryPreview = {
  game?: { cover_image?: string | null } | null;
  universe?: { icon_url?: string | null } | null;
};

function pickThumbnail(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === "string" && entry.trim()) return entry;
      if (entry && typeof entry === "object" && "url" in entry) {
        const url = (entry as { url?: unknown }).url;
        if (typeof url === "string" && url.trim()) return url;
      }
    }
  }
  return null;
}

function summarize(descriptionMd: string | null | undefined, fallback: string): string {
  if (!descriptionMd) return fallback;
  const plain = descriptionMd.replace(/[#>*_`~[\]]/g, " ").replace(/\s+/g, " ").trim();
  if (!plain) return fallback;
  if (plain.length <= 160) return plain;
  const slice = plain.slice(0, 157);
  const lastSpace = slice.lastIndexOf(" ");
  return `${lastSpace > 120 ? slice.slice(0, lastSpace) : slice}…`;
}

export default async function HomePage() {
  const [games, articles, checklistRows, tools, wikiPages, quizzes, eventsPayload, catalogPages] = await Promise.all([
    listCodePagesWithActiveCounts(),
    listPublishedArticles(12),
    listPublishedChecklists(INITIAL_CHECKLISTS * 2),
    listPublishedTools(),
    listPublishedWikiPages(),
    listPublishedQuizzes(),
    buildEventsCards(INITIAL_EVENTS),
    listPublishedTopLevelCatalogPages()
  ]);

  const sortedGames = [...games].sort((a, b) => {
    const aTime = new Date(a.content_updated_at ?? a.updated_at).getTime();
    const bTime = new Date(b.content_updated_at ?? b.updated_at).getTime();
    if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
    if (Number.isNaN(aTime)) return 1;
    if (Number.isNaN(bTime)) return -1;
    return bTime - aTime;
  });

  const totalActiveCodes = games.reduce((sum, game) => sum + (game.active_count ?? 0), 0);
  const mostRecentGame = sortedGames[0];
  const mostRecentUpdate = mostRecentGame
    ? new Date(mostRecentGame.content_updated_at ?? mostRecentGame.updated_at)
    : null;
  const refreshedLabel = mostRecentUpdate ? formatDistanceToNow(mostRecentUpdate, { addSuffix: true }) : null;

  const featuredGames = sortedGames.slice(0, INITIAL_FEATURED_GAMES).map((game) => ({
    data: game,
    articleUpdatedAt: game.content_updated_at ?? game.updated_at ?? null
  }));

  const checklistCards: ChecklistCardData[] = await Promise.all(
    checklistRows.slice(0, INITIAL_CHECKLISTS).map(async (row) => {
      const universeName = row.universe?.display_name ?? row.universe?.name ?? null;
      const thumb = pickThumbnail(row.universe?.thumbnail_urls);
      const coverImage = row.universe?.icon_url || thumb || `${SITE_URL}/og-image.png`;
      const updatedAt = row.updated_at || row.published_at || row.created_at || null;

      const itemsCount =
        typeof row.leaf_item_count === "number"
          ? row.leaf_item_count
          : typeof row.item_count === "number"
            ? row.item_count
            : null;
      const summary = summarize(row.seo_description ?? row.description_md ?? null, CHECKLISTS_DESCRIPTION);

      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        summary,
        universeName,
        coverImage,
        updatedAt,
        itemsCount
      };
    })
  );

  const toolCards = tools.slice(0, INITIAL_TOOLS);
  const wikiCards = wikiPages.slice(0, INITIAL_WIKI);
  const quizCards = quizzes.slice(0, INITIAL_QUIZZES).map((quiz) => {
    const universeName = quiz.universe?.display_name ?? quiz.universe?.name ?? null;
    const thumb = pickThumbnail(quiz.universe?.thumbnail_urls);
    const coverImage = quiz.universe?.icon_url || thumb || `${SITE_URL}/og-image.png`;
    const updatedAt = quiz.content_updated_at || quiz.updated_at || quiz.published_at || quiz.created_at || null;
    const summary = summarize(quiz.seo_description ?? quiz.description_md ?? null, QUIZZES_DESCRIPTION);

    return {
      code: quiz.code,
      title: quiz.title,
      summary,
      universeName,
      coverImage,
      updatedAt
    };
  });
  const articleCards = articles.slice(0, INITIAL_ARTICLES);
  const eventsCards = eventsPayload.cards.slice(0, INITIAL_EVENTS);
  const catalogCards = await Promise.all(
    catalogPages.slice(0, INITIAL_CATALOGS).map(async (page, index) => {
      const updatedAt = page.content_updated_at ?? page.updated_at ?? page.published_at ?? page.created_at ?? null;
      const meta = await resolveCatalogCardMeta(page.code);
      return {
        id: page.code,
        href: `/catalog/${page.code}`,
        title: meta.shortLabel ?? page.title,
        description: summarize(page.meta_description, "Open this Roblox catalog hub for the latest published content."),
        count: meta.count,
        unit: meta.unit,
        iconKey: meta.icon,
        updatedLabel: updatedAt ? formatDistanceToNow(new Date(updatedAt), { addSuffix: true }) : null,
        coverImage: page.thumb_url ?? null,
        tone: CATALOG_CARD_TONES[index % CATALOG_CARD_TONES.length]
      };
    })
  );

  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: SITE_URL,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
    hasPart: [
      {
        "@type": "ItemList",
        name: "Catalogs",
        numberOfItems: catalogCards.length,
        itemListElement: catalogCards.map((card, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: card.title,
          url: `${SITE_URL}${card.href}`,
          description: card.description
        }))
      },
      {
        "@type": "ItemList",
        name: "Tools",
        numberOfItems: toolCards.length,
        itemListElement: toolCards.map((tool, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: tool.title,
          url: `${SITE_URL}/tools/${tool.code}`,
          description: tool.meta_description,
          dateModified: tool.content_updated_at ?? tool.updated_at ?? tool.published_at ?? undefined
        }))
      },
      {
        "@type": "ItemList",
        name: "Wiki",
        numberOfItems: wikiCards.length,
        itemListElement: wikiCards.map((page, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: page.title,
          url: `${SITE_URL}/wiki/${page.slug}`,
          description: page.meta_description ?? undefined,
          dateModified: page.content_updated_at ?? page.updated_at ?? page.published_at ?? undefined
        }))
      },
      {
        "@type": "ItemList",
        name: "Latest codes",
        numberOfItems: featuredGames.length,
        itemListElement: featuredGames.map(({ data: game }, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: `${game.name} codes`,
          url: `${SITE_URL}/codes/${game.slug}`,
          dateModified: game.content_updated_at ?? game.updated_at
        }))
      },
      {
        "@type": "ItemList",
        name: "Quizzes",
        numberOfItems: quizCards.length,
        itemListElement: quizCards.map((quiz, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: quiz.title,
          url: `${SITE_URL}/quizzes/${quiz.code}`,
          description: quiz.summary,
          dateModified: quiz.updatedAt ?? undefined
        }))
      },
      {
        "@type": "ItemList",
        name: "Checklists",
        numberOfItems: checklistCards.length,
        itemListElement: checklistCards.map((card, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: card.title,
          url: `${SITE_URL}/checklists/${card.slug}`,
          description: card.summary,
          dateModified: card.updatedAt ?? undefined
        }))
      },
      {
        "@type": "ItemList",
        name: "Events",
        numberOfItems: eventsCards.length,
        itemListElement: eventsCards.map((card, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: card.title,
          url: `${SITE_URL}/events/${card.slug}`,
          description: card.summary
        }))
      },
      {
        "@type": "ItemList",
        name: "Articles",
        numberOfItems: articleCards.length,
        itemListElement: articleCards.map((article, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: article.title,
          url: `${SITE_URL}/articles/${article.slug}`,
          image: article.cover_image ?? undefined,
          datePublished: article.published_at,
          dateModified: article.updated_at
        }))
      }
    ]
  });

  return (
    <section className="space-y-12 -mt-10 md:-mt-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />

      <header className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent/80">Roblox Hub</p>
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
          Roblox hub for guides, checklists, tools, active codes, and live game stats
        </h1>
        <p className="max-w-3xl text-base text-muted md:text-lg">
          Guides, checklists, tools, active codes, and live stats in one place. Updated throughout the day with fresh rewards,
          tips, and insights.
        </p>
      </header>

      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-foreground">Catalogs</h2>
          <Link
            href="/catalog"
            data-analytics-event="view_all_click"
            data-analytics-section="catalogs"
            className="text-sm font-semibold text-accent underline-offset-2 hover:underline"
          >
            View all catalogs
          </Link>
        </div>
        {catalogCards.length ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {catalogCards.map(({ id, ...card }, index) => (
              <div
                key={id}
                className="contents"
                data-analytics-event="select_item"
                data-analytics-item-list-name="home_catalogs"
                data-analytics-item-id={id}
                data-analytics-item-name={card.title}
                data-analytics-position={index + 1}
                data-analytics-content-type="catalog"
              >
                <CatalogCard {...card} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No catalog pages are live yet. Check back soon.</p>
        )}
      </section>

      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-foreground">Tools</h2>
          <Link
            href="/tools"
            data-analytics-event="view_all_click"
            data-analytics-section="tools"
            className="text-sm font-semibold text-accent underline-offset-2 hover:underline"
          >
            View all tools
          </Link>
        </div>
        {toolCards.length ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {toolCards.map((tool, index) => (
              <div
                key={tool.id ?? tool.code}
                className="contents"
                data-analytics-event="select_item"
                data-analytics-item-list-name="home_tools"
                data-analytics-item-id={tool.code}
                data-analytics-item-name={tool.title}
                data-analytics-position={index + 1}
                data-analytics-content-type="tool"
              >
                <ToolCard tool={tool} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No tools have been published yet. Check back soon.</p>
        )}
      </section>

      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-foreground">Wiki</h2>
          <Link
            href="/wiki"
            data-analytics-event="view_all_click"
            data-analytics-section="wiki"
            className="text-sm font-semibold text-accent underline-offset-2 hover:underline"
          >
            View all wiki
          </Link>
        </div>
        {wikiCards.length ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {wikiCards.map((page, index) => (
              <div
                key={page.id}
                className="contents"
                data-analytics-event="select_item"
                data-analytics-item-list-name="home_wiki"
                data-analytics-item-id={page.slug}
                data-analytics-item-name={page.title}
                data-analytics-position={index + 1}
                data-analytics-content-type="wiki"
              >
                <WikiCard page={page} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No wiki pages have been published yet. Check back soon.</p>
        )}
      </section>

      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-foreground">Codes</h2>
          <Link
            href="/codes"
            data-analytics-event="view_all_click"
            data-analytics-section="codes"
            className="text-sm font-semibold text-accent underline-offset-2 hover:underline"
          >
            View all codes
          </Link>
        </div>
        {featuredGames.length ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {featuredGames.map(({ data: game, articleUpdatedAt }, index) => (
              <div
                key={game.id}
                className="contents"
                data-analytics-event="select_item"
                data-analytics-item-list-name="home_latest_codes"
                data-analytics-item-id={game.slug}
                data-analytics-item-name={game.name}
                data-analytics-position={index + 1}
                data-analytics-content-type="codes"
              >
                <GameCard game={game} priority={index === 0} articleUpdatedAt={articleUpdatedAt} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No code pages have been published yet. Check back soon.</p>
        )}
      </section>

      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-foreground">Quizzes</h2>
          <Link
            href="/quizzes"
            data-analytics-event="view_all_click"
            data-analytics-section="quizzes"
            className="text-sm font-semibold text-accent underline-offset-2 hover:underline"
          >
            View all quizzes
          </Link>
        </div>
        {quizCards.length ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {quizCards.map((card, index) => (
              <div
                key={card.code}
                className="contents"
                data-analytics-event="select_item"
                data-analytics-item-list-name="home_quizzes"
                data-analytics-item-id={card.code}
                data-analytics-item-name={card.title}
                data-analytics-position={index + 1}
                data-analytics-content-type="quiz"
              >
                <QuizCard {...card} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No quizzes have been published yet. Check back soon.</p>
        )}
      </section>

      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-foreground">Checklists</h2>
          <Link
            href="/checklists"
            data-analytics-event="view_all_click"
            data-analytics-section="checklists"
            className="text-sm font-semibold text-accent underline-offset-2 hover:underline"
          >
            View all checklists
          </Link>
        </div>
        {checklistCards.length ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {checklistCards.map((card, index) => (
              <div
                key={card.id}
                className="contents"
                data-analytics-event="select_item"
                data-analytics-item-list-name="home_checklists"
                data-analytics-item-id={card.slug}
                data-analytics-item-name={card.title}
                data-analytics-position={index + 1}
                data-analytics-content-type="checklist"
              >
                <ChecklistCard {...card} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No public checklists yet. Check back soon.</p>
        )}
      </section>

      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-foreground">Events</h2>
          <Link
            href="/events"
            data-analytics-event="view_all_click"
            data-analytics-section="events"
            className="text-sm font-semibold text-accent underline-offset-2 hover:underline"
          >
            View all events
          </Link>
        </div>
        {eventsCards.length ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {eventsCards.map(({ id, ...card }, index) => (
              <div
                key={id}
                className="contents"
                data-analytics-event="select_item"
                data-analytics-item-list-name="home_events"
                data-analytics-item-id={card.slug}
                data-analytics-item-name={card.title}
                data-analytics-position={index + 1}
                data-analytics-content-type="event"
              >
                <EventsPageCard {...card} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No event hubs have been published yet. Check back soon.</p>
        )}
      </section>

      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-foreground">Articles</h2>
          <Link
            href="/articles"
            data-analytics-event="view_all_click"
            data-analytics-section="articles"
            className="text-sm font-semibold text-accent underline-offset-2 hover:underline"
          >
            View all articles
          </Link>
        </div>
        {articleCards.length ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {articleCards.map((article, index) => (
              <div
                key={article.id}
                className="contents"
                data-analytics-event="select_item"
                data-analytics-item-list-name="home_articles"
                data-analytics-item-id={article.slug}
                data-analytics-item-name={article.title}
                data-analytics-position={index + 1}
                data-analytics-content-type="article"
              >
                <ArticleCard article={article} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Articles will appear here after publication.</p>
        )}
      </section>
    </section>
  );
}
