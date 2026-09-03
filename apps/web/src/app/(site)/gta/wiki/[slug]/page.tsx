import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import "@/styles/article-content.css";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { WikiCollectionCta } from "@/components/wiki/WikiCollectionCta";
import {
  buildGtaCollectionPath,
  getGtaWikiPageBySlug,
  listPublishedGtaWikiCollectionImageUrls,
  listPublishedGtaWikiCollectionsByWikiSlug,
  type GtaWikiPage
} from "@/lib/gta";
import { markdownToPlainText, renderMarkdown } from "@/lib/markdown";
import { renderPageContentNodes } from "@/lib/page-content";
import { breadcrumbJsonLd, buildAlternates, resolveSeoTitle, SITE_NAME, SITE_URL, webPageJsonLd } from "@/lib/seo";

export const revalidate = 21600;

type PageProps = { params: Promise<{ slug: string }> };

function summary(value: string | null | undefined, fallback: string): string {
  const plain = markdownToPlainText(value ?? "").replace(/\s+/g, " ").trim();
  if (!plain) return fallback;
  return plain.length <= 180 ? plain : `${plain.slice(0, 177).replace(/\s+\S*$/, "")}…`;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean);
}

function releaseLabels(value: Record<string, unknown> | null): string[] {
  if (!value) return [];
  return Object.entries(value).flatMap(([label, raw]) => {
    if (typeof raw === "string" && raw.trim()) return [`${label}: ${raw.trim()}`];
    if (Array.isArray(raw)) {
      const values = stringList(raw);
      return values.length ? [`${label}: ${values.join(", ")}`] : [];
    }
    return [];
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getGtaWikiPageBySlug(slug);
  const canonical = `${SITE_URL}/gta/wiki/${slug}`;
  if (!page) return { alternates: buildAlternates(canonical) };
  const title = resolveSeoTitle(page.seo_title) ?? page.title;
  const description = summary(page.meta_description ?? page.description_md, `Learn how ${page.game_title} works.`);
  const image = page.cover_image || page.game_hero_image || page.game_cover_image || `${SITE_URL}/Bloxodes.png`;
  return {
    title,
    description,
    alternates: buildAlternates(canonical),
    openGraph: { type: "article", title, description, url: canonical, siteName: SITE_NAME, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] }
  };
}

export default async function GtaWikiDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await getGtaWikiPageBySlug(slug);
  if (!page) notFound();
  const collections = await listPublishedGtaWikiCollectionsByWikiSlug(page.slug);
  const [descriptionHtml, tipsHtml] = await Promise.all([
    page.description_md ? renderMarkdown(page.description_md) : Promise.resolve(""),
    page.tips_md ? renderMarkdown(page.tips_md) : Promise.resolve("")
  ]);
  const image = page.cover_image || page.game_hero_image || page.game_cover_image || "/Bloxodes.png";
  const platforms = stringList(page.game_platforms_json);
  const releases = releaseLabels(page.game_release_dates_json);
  const canonicalPath = `/gta/wiki/${page.slug}`;
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;
  const description = summary(page.meta_description ?? page.description_md, `Learn how ${page.game_title} works.`);
  const updatedAt = page.content_updated_at || page.updated_at || page.published_at;
  const collectionBlocks = await Promise.all(collections.map(async (collection) => {
    const [copyHtml, imageUrls] = await Promise.all([
      collection.wiki_md ? renderMarkdown(collection.wiki_md, { paragraphizeLineBreaks: true }) : Promise.resolve(""),
      listPublishedGtaWikiCollectionImageUrls(collection, 6)
    ]);
    return { collection, copyHtml, imageUrls };
  }));
  const structuredData = [
    webPageJsonLd({ siteUrl: SITE_URL, slug: canonicalPath.slice(1), title: page.title, description, image, author: null, publishedAt: page.published_at, updatedAt }),
    breadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "GTA", url: `${SITE_URL}/gta` },
      { name: "GTA Wiki", url: `${SITE_URL}/gta/wiki` },
      { name: page.title, url: canonicalUrl }
    ])
  ];

  return (
    <div className="space-y-9">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": structuredData }) }} />
      <header className="space-y-6">
        <PageBreadcrumb items={[{ label: "Home", href: "/" }, { label: "GTA", href: "/gta" }, { label: "Wiki", href: "/gta/wiki" }, { label: page.game_short_title || page.game_title, href: null }]} />
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
            <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl border border-border/70 bg-surface-muted shadow-soft sm:h-28 sm:w-28">
              <Image src={image} alt={`${page.game_title} artwork`} fill className="object-cover" sizes="112px" priority />
            </div>
            <div className="min-w-0 max-w-3xl space-y-3">
              <h1 className="mb-0 text-4xl font-semibold leading-tight text-foreground md:text-5xl">{page.title}</h1>
              <UpdatedTimestamp value={updatedAt} className="inline-flex items-center gap-1.5 text-sm leading-5 text-muted" />
              {page.game_official_url ? (
                <div className="pt-2 lg:hidden">
                  <Link href={page.game_official_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-background transition hover:opacity-90">
                    Official game page <ExternalLink className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
          {page.game_official_url ? (
            <div className="hidden flex-wrap gap-3 lg:flex lg:shrink-0 lg:justify-end">
              <Link href={page.game_official_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-background transition hover:opacity-90">
                Official game page <ExternalLink className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          ) : null}
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,2.2fr)_minmax(20rem,1fr)]">
        <article id="article-body" itemProp="articleBody" className="min-w-0 space-y-9 journey-content-stream journey-content-stream--prose">
          {descriptionHtml ? (
            <section className="article-content md-copy-scope game-copy max-w-3xl min-w-0 text-foreground">
              {renderPageContentNodes(descriptionHtml, `${page.slug}-description`)}
            </section>
          ) : null}

          {releases.length || platforms.length || page.game_developer || page.game_publisher ? (
            <section aria-label="Game details" className="lg:hidden">
              <GtaGameDetails page={page} releases={releases} platforms={platforms} />
            </section>
          ) : null}

          {collectionBlocks.map(({ collection, copyHtml, imageUrls }) => (
            <section key={collection.id} className="space-y-4" data-journey-item>
              <h3 className="text-xl font-semibold leading-snug text-foreground">{collection.display_name}:</h3>
              {copyHtml ? (
                <div className="article-content md-copy-scope text-sm leading-7 text-foreground">
                  {renderPageContentNodes(copyHtml, `${collection.code}-wiki-copy`)}
                </div>
              ) : null}
              <WikiCollectionCta
                href={buildGtaCollectionPath(collection.wiki_slug, collection.collection_slug)}
                title={collection.title}
                imageUrls={imageUrls}
              />
            </section>
          ))}

          {tipsHtml ? (
            <section className="article-content md-copy-scope game-copy min-w-0">
              <h2>{page.game_short_title || page.game_title} gameplay tips</h2>
              {renderPageContentNodes(tipsHtml, `${page.slug}-tips`)}
            </section>
          ) : null}
        </article>

        <aside className="space-y-4">
          <section aria-label="Game details" className="hidden lg:block">
            <GtaGameDetails page={page} releases={releases} platforms={platforms} />
          </section>
        </aside>

        <div className="min-w-0 lg:col-start-1">
          <CommentsSection entityType="gta_wiki" entityId={page.id} />
        </div>
      </div>
    </div>
  );
}

function GtaGameDetails({ page, releases, platforms }: { page: GtaWikiPage; releases: string[]; platforms: string[] }) {
  const items = [
    page.game_developer ? { label: "Developer", value: page.game_developer } : null,
    page.game_publisher ? { label: "Publisher", value: page.game_publisher } : null,
    releases.length ? { label: "Release", value: releases.join(" · ") } : null,
    platforms.length ? { label: "Platforms", value: platforms.join(", ") } : null
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  return (
    <dl className="grid max-w-3xl gap-1">
      {items.map((item) => (
        <div key={item.label} className="grid grid-cols-[8rem_minmax(0,1fr)] items-start gap-3 rounded-lg py-2.5">
          <dt className="text-sm font-medium leading-6 text-muted">{item.label}</dt>
          <dd className="min-w-0 break-words pt-0.5 text-sm font-medium leading-6 text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
