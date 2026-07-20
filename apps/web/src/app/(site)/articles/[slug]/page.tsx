import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { FiClock } from "react-icons/fi";
import "@/styles/article-content.css";
import { AuthorCard } from "@/components/AuthorCard";
import { SocialShare } from "@/components/SocialShare";
import { GameDiscoverySidebar } from "@/components/game-sidebar/GameDiscoverySidebar";
import { MoreArticles } from "@/components/more-content";
import { CodeBlockEnhancer } from "@/components/CodeBlockEnhancer";
import { ContentFaq } from "@/components/ContentFaq";
import { renderMarkdown, markdownToPlainText } from "@/lib/markdown";
import { renderHtmlAsReactNodes } from "@/lib/html-to-react";
import { processHtmlLinks } from "@/lib/link-utils";
import { buildImageGalleries } from "@/lib/article-galleries";
import { authorAvatarUrl } from "@/lib/avatar";
import { collectAuthorSocials } from "@/lib/author-socials";
import {
  ARTICLES_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  breadcrumbJsonLd,
  howToJsonLd,
  resolveSeoTitle,
  buildAlternates,
} from "@/lib/seo";
import {
  getArticleBySlug,
  type ArticleWithRelations,
  type Author,
  listPublishedArticleSlugs,
} from "@/lib/db";
import { extractHowToSteps } from "@/lib/how-to";
import { ContentSlot } from "@/components/ContentSlot";
import { ArticleImageLightbox } from "@/components/ArticleImageLightbox";
import { ArticleTierList } from "@/components/ArticleTierList";
import { ArticleChecklist } from "@/components/ArticleChecklist";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { resolveModifiedAt, resolvePublishedAt } from "@/lib/content-dates";
import { ROBLOX_ARTICLE_GAME_SLUG, articleGameSlugFromUniverse } from "@/lib/slug";
import { parseArticleContentBlocks } from "@/lib/article-blocks";

export const revalidate = 86400;
const MAX_STATIC_ARTICLE_SLUGS = 150;

type Params = { params: Promise<{ slug: string }> };

type RenderedArticleBlock =
  | { kind: "markdown"; html: string }
  | { kind: "tier-list"; data: Parameters<typeof ArticleTierList>[0]["data"] }
  | { kind: "article-checklist"; data: Parameters<typeof ArticleChecklist>[0]["data"] }
  | { kind: "invalid" };

async function renderArticleContent(contentMd: string): Promise<RenderedArticleBlock[]> {
  const blocks = parseArticleContentBlocks(contentMd);
  return Promise.all(
    blocks.map(async (block) => {
      if (block.kind === "markdown") {
        const html = await renderMarkdown(block.markdown);
        const processed = processHtmlLinks(html);
        return { kind: "markdown" as const, html: buildImageGalleries(processed.__html) };
      }
      if (block.kind === "invalid") {
        console.error(`Invalid ${block.language} article block: ${block.message}`);
        return { kind: "invalid" as const };
      }
      return block;
    })
  );
}

export async function generateStaticParams() {
  return [];
}

function collectAuthorSameAs(author?: Author | null): string[] {
  if (!author) return [];
  const socials = collectAuthorSocials(author);
  return Array.from(new Set(socials.map((link) => link.url)));
}

function normalizeArticleFaqEntries(value: ArticleWithRelations["faq_json"]) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => ({
      q: typeof entry?.q === "string" ? entry.q.trim() : "",
      a: typeof entry?.a === "string" ? entry.a.trim() : ""
    }))
    .filter((entry) => entry.q && entry.a);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return {};

  const canonicalUrl = `${SITE_URL}/articles/${article.slug}`;
  const coverImage = article.cover_image?.startsWith("http")
    ? article.cover_image
    : article.cover_image
    ? `${SITE_URL.replace(/\/$/, "")}/${article.cover_image.replace(/^\//, "")}`
    : `${SITE_URL}/Bloxodes.png`;
  const description =
    (article.meta_description || markdownToPlainText(article.content_md)).trim() || ARTICLES_DESCRIPTION;
  const title = resolveSeoTitle(article.seo_title) ?? article.title;
  const universeName = article.universe?.display_name ?? article.universe?.name ?? null;
  const authorName = article.author?.name?.trim() || article.author?.name || null;
  const publishedAt = resolvePublishedAt(article);
  const modifiedAt = resolveModifiedAt(article);

  return {
    title,
    description,
    alternates: buildAlternates(canonicalUrl),
    category: universeName ?? "Gaming",
    openGraph: {
      type: "article",
      url: canonicalUrl,
      title,
      description,
      siteName: SITE_NAME,
      images: [coverImage],
      publishedTime: publishedAt ? new Date(publishedAt).toISOString() : undefined,
      modifiedTime: modifiedAt ? new Date(modifiedAt).toISOString() : undefined,
      authors: authorName ? [authorName] : undefined
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [coverImage]
    }
  };
}

export default async function ArticlePage({ params }: Params) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) {
    notFound();
  }
  return renderArticlePage(article);
}

async function renderArticlePage(article: ArticleWithRelations) {
  const canonicalUrl = `${SITE_URL}/articles/${article.slug}`;
  const coverImage = article.cover_image?.startsWith("http")
    ? article.cover_image
    : article.cover_image
    ? `${SITE_URL.replace(/\/$/, "")}/${article.cover_image.replace(/^\//, "")}`
    : null;
  const descriptionPlain = (article.meta_description || markdownToPlainText(article.content_md)).trim();
  const faqEntries = normalizeArticleFaqEntries(article.faq_json);
  const [articleBlocks, authorBioHtml, faqHtml] = await Promise.all([
    renderArticleContent(article.content_md),
    article.author?.bio_md ? renderMarkdown(article.author.bio_md) : Promise.resolve(""),
    Promise.all(faqEntries.map((entry) => renderMarkdown(entry.a, { paragraphizeLineBreaks: true })))
  ]);
  const faqItems = faqEntries.map((entry, index) => ({
    id: `${article.slug}-faq-${index}`,
    question: entry.q,
    answer: (
      <>
        {renderHtmlAsReactNodes(processHtmlLinks(faqHtml[index] ?? "").__html, {
          keyPrefix: `${article.slug}-faq-${index}`
        })}
      </>
    )
  }));

  const universeId = (article as any).universe_id ?? null;
  const universeLabel = article.universe?.display_name ?? article.universe?.name ?? article.title;
  const authorAvatar = article.author ? authorAvatarUrl(article.author, 72) : null;
  const authorName = article.author?.name?.trim() || article.author?.name || null;
  const publishedAt = resolvePublishedAt(article) ?? article.created_at;
  const modifiedAt = resolveModifiedAt(article) ?? article.updated_at ?? publishedAt;
  const publishedDate = new Date(publishedAt);
  const updatedDate = new Date(modifiedAt);
  const formattedUpdated = updatedDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
  const updatedRelativeLabel = formatDistanceToNow(updatedDate, { addSuffix: true });
  const publishedIso = publishedDate.toISOString();
  const updatedIso = updatedDate.toISOString();
  const authorProfileUrl = article.author?.slug ? `${SITE_URL.replace(/\/$/, "")}/authors/${article.author.slug}` : null;
  const authorSameAs = collectAuthorSameAs(article.author);
  const authorBioPlain = article.author?.bio_md ? markdownToPlainText(article.author.bio_md) : null;
  const universeName = article.universe?.display_name ?? article.universe?.name ?? null;
  const articleGameTitle = universeName ?? "Roblox";
  const articleGameSlug = article.universe ? articleGameSlugFromUniverse(article.universe) : ROBLOX_ARTICLE_GAME_SLUG;
  const articleGameHref = `/articles/games/${articleGameSlug}`;
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Articles", href: "/articles" },
    { label: `${articleGameTitle} articles`, href: articleGameHref }
  ];
  const breadcrumbData = JSON.stringify(
    breadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Articles", url: `${SITE_URL}/articles` },
      { name: `${articleGameTitle} articles`, url: `${SITE_URL}${articleGameHref}` }
    ])
  );
  const howToSteps = extractHowToSteps(article.content_md);
  const articleHowToData = howToSteps.length
    ? JSON.stringify(
        howToJsonLd({
          siteUrl: SITE_URL,
          subject: { name: article.title, slug: `articles/${article.slug}` },
          steps: howToSteps,
          title: article.title,
          description: `Step-by-step guide derived from "${article.title}".`
        })
      )
    : null;
  const faqData = faqEntries.length
    ? JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqEntries.map((entry) => ({
          "@type": "Question",
          name: entry.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: markdownToPlainText(entry.a)
          }
        }))
      })
    : null;

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    mainEntityOfPage: canonicalUrl,
    headline: article.title,
    articleSection: universeName ?? undefined,
    description: descriptionPlain,
    datePublished: publishedIso,
    dateModified: updatedIso,
    image: coverImage ?? `${SITE_URL}/Bloxodes.png`,
    author: article.author
      ? {
          '@type': 'Person',
          name: authorName ?? article.author.name,
          url: authorProfileUrl ?? undefined,
          sameAs: authorSameAs.length ? authorSameAs : undefined
        }
      : {
          '@type': 'Organization',
          name: SITE_NAME
        },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/Bloxodes-dark.png`
      }
    }
  };

  const processedAuthorBioHtml = authorBioHtml ? processHtmlLinks(authorBioHtml) : null;

  return (
    <div className="space-y-12">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,1.25fr)]">
      <article className="min-w-0">
        <header className="mb-6 space-y-3">
          <nav aria-label="Breadcrumb" className="text-xs uppercase tracking-[0.25em] text-muted">
            <ol className="flex flex-wrap items-center gap-2">
              {breadcrumbItems.map((item, index) => (
                <li key={`${item.label}-${index}`} className="flex items-center gap-2">
                  {item.href ? (
                    <Link href={item.href} className="font-semibold text-muted transition hover:text-accent">
                      {item.label}
                    </Link>
                  ) : (
                    <span className="font-semibold text-foreground/80">{item.label}</span>
                  )}
                  {index < breadcrumbItems.length - 1 ? <span className="text-muted/60">&gt;</span> : null}
                </li>
              ))}
            </ol>
          </nav>
          <h1 className="text-4xl font-bold text-foreground md:text-5xl" itemProp="headline">
            {article.title}
          </h1>
          <div className="flex flex-col gap-3 text-sm text-muted">
            <div className="flex flex-wrap items-center gap-2">
              {article.author ? (
                <div className="flex items-center gap-2" itemProp="author" itemScope itemType="https://schema.org/Person">
                  {authorProfileUrl ? <link itemProp="url" href={authorProfileUrl} /> : null}
                  {authorBioPlain ? <meta itemProp="description" content={authorBioPlain} /> : null}
                  {authorSameAs.map((url) => (
                    <link key={url} itemProp="sameAs" href={url} />
                  ))}
                  <img
                    src={authorAvatar || "https://www.gravatar.com/avatar/?d=mp"}
                    alt={authorName ?? article.author.name}
                    className="h-9 w-9 rounded-full border border-border/40 object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <span>
                    Authored by {article.author.slug ? (
                      <Link
                        href={`/authors/${article.author.slug}`}
                        className="font-semibold text-foreground transition hover:text-accent"
                        itemProp="name"
                        data-analytics-event="author_click"
                        data-analytics-codes-url={canonicalUrl}
                        data-analytics-author-url={`/authors/${article.author.slug}`}
                      >
                        {authorName ?? article.author.name}
                      </Link>
                    ) : (
                      <span className="font-semibold text-foreground" itemProp="name">
                        {authorName ?? article.author.name}
                      </span>
                    )}
                  </span>
                </div>
              ) : (
                <span className="font-semibold text-foreground" itemProp="author">
                  Published by {SITE_NAME}
                </span>
              )}
              <span aria-hidden="true">•</span>
              <span className="inline-flex items-center gap-1.5 text-foreground/80">
                <FiClock className="h-4 w-4 shrink-0" aria-hidden />
                Updated on <span className="font-semibold text-foreground">{formattedUpdated}</span>
                {updatedRelativeLabel ? <span>{' '}({updatedRelativeLabel})</span> : null}
              </span>
            </div>
          </div>
        </header>

        <section
          id="article-body"
          itemProp="articleBody"
          className="article-content prose dark:prose-invert max-w-none game-copy"
        >
          {articleBlocks.map((block, index) => {
            if (block.kind === "markdown") {
              return (
                <Fragment key={`markdown-${index}`}>
                  {renderHtmlAsReactNodes(block.html, { keyPrefix: `article-${index}` })}
                </Fragment>
              );
            }
            if (block.kind === "tier-list") {
              return <ArticleTierList key={`tier-list-${block.data.id}`} data={block.data} />;
            }
            if (block.kind === "article-checklist") {
              return (
                <ArticleChecklist
                  key={`article-checklist-${block.data.id}`}
                  articleSlug={article.slug}
                  data={block.data}
                />
              );
            }
            return (
              <div
                key={`invalid-${index}`}
                role="status"
                className="my-6 rounded-xl border border-border/70 bg-surface/60 px-4 py-3 text-sm text-muted-foreground"
              >
                Embedded article content is temporarily unavailable.
              </div>
            );
          })}
        </section>
        <ArticleImageLightbox />

        {faqItems.length ? <ContentFaq items={faqItems} className="mt-10 border-t border-border/60 pt-6" /> : null}

        {article.author ? (
          <AuthorCard author={article.author} bioHtml={processedAuthorBioHtml ?? ""} />
        ) : null}

        <div className="mt-10">
          <CommentsSection entityType="article" entityId={article.id} />
        </div>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
        {articleHowToData ? (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleHowToData }} />
        ) : null}
        {faqData ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqData }} /> : null}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbData }} />
      <CodeBlockEnhancer />
      </article>

      <aside className="space-y-4">
        <section className="space-y-3">
          <SocialShare
            url={canonicalUrl}
            title={article.title}
            heading="Share this article"
            analytics={{ contentType: "article", itemId: article.slug }}
          />
        </section>
        <ContentSlot
          slot="4767824441"
          className="w-full"
          adLayout={null}
          adFormat="auto"
          fullWidthResponsive
          minHeight="clamp(280px, 40vw, 600px)"
        />

        <GameDiscoverySidebar universeId={universeId} universeName={universeLabel} currentType="articles" />
      </aside>
      </div>
      <MoreArticles excludeSlug={article.slug} />
    </div>
  );
}
