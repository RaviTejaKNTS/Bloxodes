import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { marked } from "marked";
import { AuthorSocialLinks } from "@/components/AuthorSocialLinks";
import { ArticleCard } from "@/components/ArticleCard";
import { authorAvatarUrl } from "@/lib/avatar";
import {
  getAuthorBySlug,
  listAuthorSlugs,
  listPublishedArticlesByAuthor
} from "@/lib/db";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  authorJsonLd,
  breadcrumbJsonLd,
  buildAlternates,
} from "@/lib/seo";

// Cache author pages for a month; on-demand revalidation keeps them fresh
export const revalidate = 2592000; // monthly

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const slugs = await listAuthorSlugs();
  return slugs.map((slug) => ({ slug }));
}

function markdownToPlain(text?: string | null): string {
  if (!text) return "";
  return text
    .replace(/\[(.+?)\]\((.*?)\)/g, "$1")
    .replace(/[*_`>#~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const author = await getAuthorBySlug(slug);
  if (!author) {
    return {};
  }

  const title = `${author.name} Roblox Guides & Articles`;
  const description = markdownToPlain(author.bio_md) || SITE_DESCRIPTION;
  const canonical = `${SITE_URL}/authors/${author.slug}`;
  const avatar = authorAvatarUrl(author, 256);

  return {
    title,
    description,
    alternates: buildAlternates(canonical),
    authors: [{ name: author.name, url: canonical }],
    openGraph: {
      type: "profile",
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      images: [avatar || `${SITE_URL}/og-image.png`]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [avatar || `${SITE_URL}/og-image.png`]
    }
  };
}

export default async function AuthorPage({ params }: Params) {
  const { slug } = await params;
  const author = await getAuthorBySlug(slug);
  if (!author) {
    return notFound();
  }

  const articles = await listPublishedArticlesByAuthor(author.id, 12, 0, author.slug);
  const avatar = authorAvatarUrl(author, 120);
  const bioHtml = author.bio_md ? await marked.parse(author.bio_md) : "";
  const bioText = markdownToPlain(author.bio_md) || `${author.name} shares the latest Roblox guides and articles on ${SITE_NAME}.`;
  const canonical = `${SITE_URL}/authors/${author.slug}`;
  const breadcrumbData = JSON.stringify(
    breadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Authors", url: `${SITE_URL}/authors` },
      { name: author.name, url: canonical }
    ])
  );
  const authorData = JSON.stringify(
    authorJsonLd({
      siteUrl: SITE_URL,
      author,
      avatar,
      description: bioText
    })
  );

  return (
    <div className="space-y-12">
      <header className="border-b border-border/60 pb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <img
            src={avatar || "https://www.gravatar.com/avatar/?d=mp"}
            alt={author.name}
            className="h-20 w-20 shrink-0 rounded-md border border-border/60 object-cover"
            loading="lazy"
          />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">{author.name}</h1>
              {author.slug ? (
                <p className="mt-2 text-sm text-muted">@{author.slug}</p>
              ) : null}
            </div>
            {bioHtml ? (
              <div
                className="max-w-3xl text-sm leading-7 text-muted md:text-base md:leading-8 [&_a]:font-semibold [&_a]:text-accent [&_a]:underline-offset-4 [&_a:hover]:text-accent [&_p]:m-0 [&_p+p]:mt-3"
                dangerouslySetInnerHTML={{ __html: bioHtml }}
              />
            ) : (
              <p className="max-w-3xl text-sm leading-7 text-muted md:text-base md:leading-8">{bioText}</p>
            )}
            <AuthorSocialLinks author={author} size="sm" />
          </div>
        </div>
      </header>

      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Articles & Deep Dives</h2>
          <p className="text-sm text-muted">
            Long-form Roblox guides and commentary written by {author.name}.
          </p>
        </div>
        {articles.length ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">
            {author.name} hasn't published any articles yet. Check back soon!
          </p>
        )}
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbData }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: authorData }} />
    </div>
  );
}
