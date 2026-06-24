import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { FiClock } from "react-icons/fi";
import "@/styles/article-content.css";
import { QuizRunner } from "@/components/QuizRunner";
import { GameDiscoverySidebar } from "@/components/game-sidebar/GameDiscoverySidebar";
import { GameCard } from "@/components/GameCard";
import { ArticleCard } from "@/components/ArticleCard";
import { ToolCard } from "@/components/ToolCard";
import { getQuizPageByCode, listPublishedQuizCodes, loadQuizData } from "@/lib/quizzes";
import { listCodePagesWithActiveCountsByUniverseId, listPublishedArticlesByUniverseId } from "@/lib/db";
import { listPublishedToolsByUniverseId } from "@/lib/tools";
import { buildWikiCatalogPath, listPublishedWikiCatalogPagesByUniverseId } from "@/lib/wiki-catalog";
import { markdownToPlainText, renderMarkdown } from "@/lib/markdown";
import { buildServerQuizAttempt } from "@/lib/quiz-attempts";
import type { QuizData } from "@/lib/quiz-types";
import { QUIZZES_DESCRIPTION, SITE_NAME, SITE_URL, resolveSeoTitle, buildAlternates } from "@/lib/seo";

export const revalidate = 21600;

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateStaticParams() {
  return [];
}

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

function summarize(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const normalized = markdownToPlainText(value).replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  if (normalized.length <= 140) return normalized;
  const slice = normalized.slice(0, 137);
  const lastSpace = slice.lastIndexOf(" ");
  return `${lastSpace > 80 ? slice.slice(0, lastSpace) : slice}…`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getQuizPageByCode(slug);
  if (!page) return {};

  const titleBase = resolveSeoTitle(page.seo_title) ?? page.title;
  const description =
    page.seo_description ||
    (page.description_md ? markdownToPlainText(page.description_md).slice(0, 160) : QUIZZES_DESCRIPTION);
  const canonical = `${SITE_URL}/quizzes/${page.code}`;
  const thumb = pickThumbnail(page.universe?.thumbnail_urls);
  const image = thumb || page.universe?.icon_url || `${SITE_URL}/og-image.png`;

  return {
    title: `${titleBase} | ${SITE_NAME}`,
    description,
    alternates: buildAlternates(canonical),
    openGraph: {
      type: "website",
      url: canonical,
      title: titleBase,
      description,
      siteName: SITE_NAME,
      images: [image]
    },
    twitter: {
      card: "summary_large_image",
      title: titleBase,
      description,
      images: [image]
    }
  };
}

export default async function QuizPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const resolvedSearch = (await searchParams) ?? {};
  const startAnswerOptionId = typeof resolvedSearch.qa === "string" ? resolvedSearch.qa : undefined;
  const page = await getQuizPageByCode(slug);
  if (!page) {
    notFound();
  }

  const quizData = await loadQuizData(page.code);
  if (!quizData) {
    notFound();
  }
  const initialAttempt = buildServerQuizAttempt(quizData, page.code);

  const description = page.description_md
    ? markdownToPlainText(page.description_md).replace(/\s+/g, " ").trim()
    : null;
  const descriptionHtml = page.description_md
    ? await renderMarkdown(page.description_md, { paragraphizeLineBreaks: true })
    : "";
  const heroImage = pickThumbnail(page.universe?.thumbnail_urls) || page.universe?.icon_url || null;
  const gameName = page.universe?.display_name ?? page.universe?.name ?? page.title;
  const heroAlt = `${gameName} Quiz Thumbnail`;
  const canonical = `${SITE_URL}/quizzes/${page.code}`;
  const publishedTime = page.published_at || page.created_at || null;
  const modifiedTime = page.content_updated_at || page.updated_at || publishedTime || null;
  const updatedDateValue = modifiedTime;
  const updatedDate = updatedDateValue ? new Date(updatedDateValue) : null;
  const formattedUpdated = updatedDate
    ? updatedDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;
  const updatedRelativeLabel = updatedDate ? formatDistanceToNow(updatedDate, { addSuffix: true }) : null;
  const universeId = page.universe_id ?? null;
  const universeLabel = page.universe?.display_name ?? page.universe?.name ?? page.title;

  const [relatedCodes, relatedArticles, relatedTools, relatedCatalogPagesRaw] = universeId
    ? await Promise.all([
        listCodePagesWithActiveCountsByUniverseId(universeId, 2),
        listPublishedArticlesByUniverseId(universeId, 3, 0),
        listPublishedToolsByUniverseId(universeId, 2),
        listPublishedWikiCatalogPagesByUniverseId(universeId, 2)
      ])
    : [[], [], [], []];

  const relatedCatalogPages = relatedCatalogPagesRaw.slice(0, 2);
  const showRecommendations =
    relatedCodes.length > 0 ||
    relatedArticles.length > 0 ||
    relatedTools.length > 0 ||
    relatedCatalogPages.length > 0;

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: page.title,
        description: description ?? QUIZZES_DESCRIPTION,
        url: canonical,
        datePublished: publishedTime ? new Date(publishedTime).toISOString() : undefined,
        dateModified: modifiedTime ? new Date(modifiedTime).toISOString() : undefined,
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Quizzes", item: `${SITE_URL}/quizzes` },
            { "@type": "ListItem", position: 3, name: page.title }
          ]
        },
        mainEntity: { "@id": `${canonical}#quizapp` }
      },
      {
        "@type": "WebApplication",
        "@id": `${canonical}#quizapp`,
        name: page.title,
        description: description ?? QUIZZES_DESCRIPTION,
        url: canonical,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        inLanguage: "en",
        image: heroImage ? [heroImage] : undefined,
        isPartOf: {
          "@type": "WebSite",
          name: SITE_NAME,
          url: SITE_URL
        }
      }
    ]
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,1.25fr)]">
      <div className="min-w-0">
      <nav aria-label="Breadcrumb" className="mb-6 text-xs uppercase tracking-[0.25em] text-muted">
        <ol className="flex flex-wrap items-center gap-2">
          <li className="flex items-center gap-2">
            <a href="/" className="font-semibold text-muted transition hover:text-accent">
              Home
            </a>
            <span className="text-muted/60">&gt;</span>
          </li>
          <li className="flex items-center gap-2">
            <a href="/quizzes" className="font-semibold text-muted transition hover:text-accent">
              Quizzes
            </a>
            <span className="text-muted/60">&gt;</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="font-semibold text-foreground/80">{page.title}</span>
          </li>
        </ol>
      </nav>
      <header className="mb-6 space-y-3">
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{page.title}</h1>
        {formattedUpdated ? (
          <p className="inline-flex items-center gap-1.5 text-sm text-foreground/80">
            <FiClock className="h-4 w-4 shrink-0" aria-hidden />
            Updated on <span className="font-semibold text-foreground">{formattedUpdated}</span>
            {updatedRelativeLabel ? <span>{' '}({updatedRelativeLabel})</span> : null}
          </p>
        ) : null}
        {descriptionHtml ? (
          <div
            className="article-content prose dark:prose-invert game-copy max-w-3xl"
            dangerouslySetInnerHTML={{ __html: descriptionHtml }}
          />
        ) : description ? (
          <p className="max-w-3xl text-sm text-muted md:text-base">{description}</p>
        ) : null}
      </header>
      <QuizRunner
        quizCode={page.code}
        questions={quizData}
        initialAttempt={initialAttempt}
        heroImage={heroImage}
        heroAlt={heroAlt}
        startAnswerOptionId={startAnswerOptionId}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      </div>
      <aside className="space-y-4">
        <GameDiscoverySidebar universeId={universeId} universeName={universeLabel} currentType="quiz" />
      </aside>
    </div>
  );
}
