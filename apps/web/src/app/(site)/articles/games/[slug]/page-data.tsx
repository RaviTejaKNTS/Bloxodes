import type { Metadata } from "next";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ArticleCard } from "@/components/ArticleCard";
import { IndexPageStats } from "@/components/IndexPageStats";
import { PagePagination } from "@/components/PagePagination";
import {
  listPublishedArticlesByArticleGameSlugPage,
  type ArticleGameSummary,
  type ArticleWithRelations
} from "@/lib/db";
import { ARTICLES_DESCRIPTION, SITE_URL, breadcrumbJsonLd, buildAlternates } from "@/lib/seo";

export const ARTICLE_GAME_PAGE_SIZE = 20;

export type ArticleGamePageData = {
  game: ArticleGameSummary;
  articles: ArticleWithRelations[];
  total: number;
  totalPages: number;
};

export async function loadArticleGamePageData(slug: string, pageNumber: number): Promise<ArticleGamePageData | null> {
  return listPublishedArticlesByArticleGameSlugPage(slug, pageNumber, ARTICLE_GAME_PAGE_SIZE);
}

function articleGameDescription(game: ArticleGameSummary) {
  if (game.slug === "roblox") {
    return "Browse Roblox articles and guides that are not tied to one specific Roblox experience.";
  }
  return `Browse every ${game.title} article and guide published on Bloxodes in one place.`;
}

export function articleGameMetadata(game: ArticleGameSummary, pageNumber = 1): Metadata {
  const title =
    pageNumber > 1 ? `${game.title} Articles and Guides - Page ${pageNumber}` : `${game.title} Articles and Guides`;
  const path = pageNumber > 1 ? `/articles/games/${game.slug}/page/${pageNumber}` : `/articles/games/${game.slug}`;
  return {
    title,
    description: articleGameDescription(game),
    alternates: buildAlternates(`${SITE_URL}${path}`),
    ...(pageNumber > 1 ? { robots: { index: false, follow: true } } : {})
  };
}

export function renderArticleGamePage({
  game,
  articles,
  total,
  totalPages,
  currentPage
}: ArticleGamePageData & {
  currentPage: number;
}) {
  const latest = articles.reduce<Date | null>((latestDate, article) => {
    const candidate = article.updated_at ?? article.published_at ?? article.created_at;
    if (!candidate) return latestDate;
    const candidateDate = new Date(candidate);
    if (!latestDate || candidateDate > latestDate) return candidateDate;
    return latestDate;
  }, null);
  const refreshedLabel = latest ? formatDistanceToNow(latest, { addSuffix: true }) : null;
  const canonicalPath = currentPage > 1 ? `/articles/games/${game.slug}/page/${currentPage}` : `/articles/games/${game.slug}`;
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;
  const description = articleGameDescription(game);
  const pageTitle = `${game.title} articles`;

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <nav aria-label="Breadcrumb" className="text-xs uppercase tracking-[0.22em] text-muted">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="font-semibold transition hover:text-accent">
                Home
              </Link>
            </li>
            <li className="text-muted/60" aria-hidden>
              &gt;
            </li>
            <li>
              <Link href="/articles" className="font-semibold transition hover:text-accent">
                Articles
              </Link>
            </li>
            <li className="text-muted/60" aria-hidden>
              &gt;
            </li>
            <li className="font-semibold text-foreground/80">{pageTitle}</li>
          </ol>
        </nav>
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{pageTitle}</h1>
        <p className="max-w-2xl text-base text-muted md:text-lg">{description}</p>
        <IndexPageStats
          items={[
            { label: `${total} articles`, icon: "articles", tone: "accent" },
            ...(refreshedLabel ? [{ label: `Updated ${refreshedLabel}`, icon: "clock" as const }] : [])
          ]}
        />
      </header>

      <section className="space-y-6">
        <h2 className="text-xl font-semibold text-foreground">Latest {game.title} posts</h2>
        {articles.length ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {articles.map((article, index) => (
              <div
                key={article.id}
                className="contents"
                data-analytics-event="select_item"
                data-analytics-item-list-name="article_game_index"
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

      <PagePagination basePath={`/articles/games/${game.slug}`} currentPage={currentPage} totalPages={totalPages} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            breadcrumbJsonLd([
              { name: "Home", url: SITE_URL },
              { name: "Articles", url: `${SITE_URL}/articles` },
              { name: pageTitle, url: canonicalUrl }
            ]),
            {
              "@context": "https://schema.org",
              "@type": "CollectionPage",
              name: pageTitle,
              description,
              url: canonicalUrl,
              mainEntity: {
                "@type": "ItemList",
                numberOfItems: articles.length,
                itemListElement: articles.map((article, index) => ({
                  "@type": "ListItem",
                  position: index + 1,
                  name: article.title,
                  url: `${SITE_URL}/articles/${article.slug}`
                }))
              }
            }
          ])
        }}
      />
    </div>
  );
}
