import type { Metadata } from "next";
import { formatDistanceToNow } from "date-fns";
import { listPublishedArticlesPage, type ArticleWithRelations } from "@/lib/db";
import { ARTICLES_DESCRIPTION, SITE_URL, buildAlternates } from "@/lib/seo";
import { ArticleCard } from "@/components/ArticleCard";
import { IndexPageStats } from "@/components/IndexPageStats";
import { PagePagination } from "@/components/PagePagination";

export const ARTICLES_PAGE_SIZE = 20;

export type ArticlesPageData = {
  articles: ArticleWithRelations[];
  total: number;
  totalPages: number;
};

export async function loadArticlesPageData(pageNumber: number): Promise<ArticlesPageData> {
  const { articles, total } = await listPublishedArticlesPage(pageNumber, ARTICLES_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / ARTICLES_PAGE_SIZE));
  return { articles, total, totalPages };
}

function ArticlesPageView({
  articles,
  totalPages,
  totalArticles,
  currentPage,
  showHero
}: {
  articles: ArticleWithRelations[];
  totalPages: number;
  totalArticles: number;
  currentPage: number;
  showHero: boolean;
}) {
  const latest = articles.reduce<Date | null>((latestDate, article) => {
    const candidate = article.updated_at ?? article.published_at ?? article.created_at;
    if (!candidate) return latestDate;
    const candidateDate = new Date(candidate);
    if (!latestDate || candidateDate > latestDate) return candidateDate;
    return latestDate;
  }, null);
  const refreshedLabel = latest ? formatDistanceToNow(latest, { addSuffix: true }) : null;

  return (
    <div className="space-y-10">
      {showHero ? (
        <header className="space-y-4">
          <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
            Fresh Roblox guides, tips, and updates from Bloxodes
          </h1>
          <p className="max-w-2xl text-base text-muted md:text-lg">
            Long-form guides, recommendations, and redemption walkthroughs updated regularly to help you get more from every Roblox game.
          </p>
          <IndexPageStats
            items={[
              { label: `${totalArticles} articles published`, icon: "articles", tone: "accent" },
              ...(refreshedLabel ? [{ label: `Updated ${refreshedLabel}`, icon: "clock" as const }] : [])
            ]}
          />
        </header>
      ) : (
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/80">Bloxodes Articles</p>
          <h1 className="text-3xl font-semibold text-foreground">Bloxodes articles</h1>
          {refreshedLabel ? (
            <p className="text-sm text-muted">Updated {refreshedLabel} · Page {currentPage} of {totalPages}</p>
          ) : null}
        </header>
      )}

      <section id="article-body" itemProp="articleBody" className="journey-content-stream journey-content-stream--index">
        <h2 className="text-xl font-semibold text-foreground">Latest posts</h2>
        {articles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-surface/60 p-8 text-center text-sm text-muted">
            Articles will appear here after publication.
          </div>
        ) : (
          articles.map((article, index) => (
            <div
              key={article.id}
              data-journey-item
              className="h-full"
                data-analytics-event="select_item"
                data-analytics-item-list-name="articles_index"
                data-analytics-item-id={article.slug}
                data-analytics-item-name={article.title}
                data-analytics-position={index + 1}
                data-analytics-content-type="article"
            >
              <ArticleCard article={article} />
            </div>
          ))
        )}

        <PagePagination basePath="/articles" currentPage={currentPage} totalPages={totalPages} />
      </section>

      {showHero ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "CollectionPage",
              name: "Articles & Guides",
              description: ARTICLES_DESCRIPTION,
              url: `${SITE_URL}/articles`
            })
          }}
        />
      ) : null}
    </div>
  );
}

export function renderArticlesPage(props: Parameters<typeof ArticlesPageView>[0]) {
  return <ArticlesPageView {...props} />;
}

export const articlesMetadata: Metadata = {
  title: "Articles & Guides",
  description: ARTICLES_DESCRIPTION,
  alternates: buildAlternates(`${SITE_URL}/articles`)
};
