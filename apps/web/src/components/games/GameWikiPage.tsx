import { safeJsonLd } from "@/lib/seo";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import "@/styles/article-content.css";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { WikiCollectionCta } from "@/components/wiki/WikiCollectionCta";
import { createGameReader, type SharedGameWikiPage } from "@/lib/shared-game-reader";
import { markdownToPlainText, renderMarkdown } from "@/lib/markdown";
import { renderPageContentNodes } from "@/lib/page-content";
import { breadcrumbJsonLd, buildAlternates, resolveSeoTitle, SITE_NAME, SITE_URL, webPageJsonLd } from "@/lib/seo";
export function legacyWikiCommentType(namespace: string): "gta_wiki" | "red_dead_wiki" | "minecraft_wiki" | "game_wiki" { return namespace === "gta" ? "gta_wiki" : namespace === "red-dead" ? "red_dead_wiki" : namespace === "minecraft" ? "minecraft_wiki" : "game_wiki"; }
export function gameWikiMetadata(page: SharedGameWikiPage): Metadata {
 const canonical = `${SITE_URL}${page.canonical_path}`;
 const title = resolveSeoTitle(page.seo_title) ?? page.title;
 const description = summary(page.meta_description ?? page.description_md, `Learn how ${page.game_title} works.`);
 const image = page.cover_image || page.game_cover_image || page.game_hero_image || "/Bloxodes.png";
 return { title, description, alternates: buildAlternates(canonical), openGraph: { type: "article", title, description, url: canonical, siteName: SITE_NAME, images: [image] }, twitter: { card: "summary_large_image", title, description, images: [image] } };
}
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

export async function renderGameWikiPage({ page, namespace, namespaceTitle, extraLinks = [] }: { page: SharedGameWikiPage; namespace: string; namespaceTitle: string; extraLinks?: Array<{ href: string; title: string }> }) {
  const reader = createGameReader(namespace);

  const collections = await reader.listPublishedSharedGameWikiCollectionsByWikiSlug(page.slug);
  const [descriptionHtml, tipsHtml] = await Promise.all([
    page.description_md ? renderMarkdown(page.description_md) : Promise.resolve(""),
    page.tips_md ? renderMarkdown(page.tips_md) : Promise.resolve("")
  ]);
  const coverImage = reader.resolveSharedGameWikiCoverImage(page);
  const thumbnailImage = reader.resolveSharedGameWikiThumbnailImage(page);
  const platforms = stringList(page.game_platforms_json);
  const releases = releaseLabels(page.game_release_dates_json);
  const isPrelaunch = page.game_status === "upcoming" || page.game_status === "announced";
  const hasGameDetails = isPrelaunch || releases.length || platforms.length || page.game_developer || page.game_publisher;
  const canonicalPath = page.canonical_path;
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;
  const description = summary(page.meta_description ?? page.description_md, `Learn how ${page.game_title} works.`);
  const updatedAt = page.content_updated_at || page.updated_at || page.published_at;
  const collectionBlocks = await Promise.all(collections.map(async (collection) => {
    const [copyHtml, imageUrls] = await Promise.all([
      collection.wiki_md ? renderMarkdown(collection.wiki_md, { paragraphizeLineBreaks: true }) : Promise.resolve(""),
      reader.listPublishedSharedGameWikiCollectionImageUrls(collection, 6)
    ]);
    return { collection, copyHtml, imageUrls };
  }));
  const collectionGroups = [
    { key: "database" as const, label: isPrelaunch ? "Pre-launch coverage" : "Game data", entries: collectionBlocks.filter(({ collection }) => collection.page_type !== "collectible") },
    { key: "collectible" as const, label: "Collectibles", entries: collectionBlocks.filter(({ collection }) => collection.page_type === "collectible") }
  ].filter((group) => group.entries.length);
  const controls = Array.isArray(page.controls_json) ? page.controls_json.filter((row): row is Record<string,string> => Boolean(row) && typeof row === "object" && typeof row.action === "string") : [];
  const structuredData = [
    {
      ...webPageJsonLd({ siteUrl: SITE_URL, slug: canonicalPath.slice(1), title: page.title, description, image: coverImage, author: null, publishedAt: page.published_at, updatedAt }),
      ...(collectionBlocks.length ? {
        "@type": "CollectionPage",
        mainEntity: {
          "@type": "ItemList",
          name: `${page.game_title} collections`,
          numberOfItems: collectionBlocks.length,
          itemListElement: collectionBlocks.map(({ collection }, index) => ({
            "@type": "ListItem", position: index + 1, name: collection.display_name, url: `${SITE_URL}${collection.canonical_path}`
          }))
        }
      } : {})
    },
    breadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: namespaceTitle, url: `${SITE_URL}/${namespace}` },
      ...(canonicalPath === `/${namespace}/wiki` ? [] : [{ name: `${namespaceTitle} Wiki`, url: `${SITE_URL}/${namespace}/wiki` }]),
      { name: page.title, url: canonicalUrl }
    ])
  ];

  return (
    <div className="space-y-9">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd({ "@context": "https://schema.org", "@graph": structuredData }) }} />
      <header className="space-y-6">
        <PageBreadcrumb items={[{ label: "Home", href: "/" }, { label: namespaceTitle, href: `/${namespace}` }, ...(canonicalPath === `/${namespace}/wiki` ? [] : [{ label: "Wiki", href: `/${namespace}/wiki` }]), { label: page.game_short_title || page.game_title, href: null }]} />
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
            <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl border border-border/70 bg-surface-muted shadow-soft sm:h-28 sm:w-28">
              <Image src={thumbnailImage} alt={`${page.game_title} artwork`} fill className="object-cover" sizes="112px" priority />
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

      {extraLinks.map(link => <p key={link.href}><Link href={link.href} className="text-accent underline underline-offset-4">{link.title}</Link></p>)}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,2.2fr)_minmax(20rem,1fr)]">
        <article id="article-body" itemProp="articleBody" className="min-w-0 space-y-9 journey-content-stream journey-content-stream--prose">
          {descriptionHtml ? (
            <section className="article-content md-copy-scope game-copy max-w-3xl min-w-0 text-foreground">
              {renderPageContentNodes(descriptionHtml, `${page.slug}-description`)}
            </section>
          ) : null}

          {hasGameDetails ? (
            <section aria-label="Game details" className="lg:hidden">
              <GameDetails page={page} releases={releases} platforms={platforms} />
            </section>
          ) : null}

          {collectionGroups.map((group) => (
            <section key={group.key} className="space-y-6" aria-labelledby={`${namespace}-${group.key}-heading`}>
              <h2 id={`${namespace}-${group.key}-heading`} className="text-2xl font-semibold leading-tight text-foreground">{group.label}</h2>
              <div className="space-y-6">
                {group.entries.map(({ collection, copyHtml, imageUrls }) => (
                  <section key={collection.id} className="space-y-4" data-journey-item>
                    <h3 className="text-xl font-semibold leading-snug text-foreground">{collection.display_name}</h3>
                    {copyHtml ? (
                      <div className="article-content md-copy-scope text-sm leading-7 text-foreground">
                        {renderPageContentNodes(copyHtml, `${collection.code}-wiki-copy`)}
                      </div>
                    ) : null}
                    <WikiCollectionCta
                      href={collection.canonical_path}
                      title={collection.title}
                      imageUrls={imageUrls}
                    />
                  </section>
                ))}
              </div>
            </section>
          ))}

          {controls.length ? <section className="max-w-3xl space-y-4"><h2 className="text-2xl font-semibold">Controls</h2><dl className="space-y-3">{controls.map((row,i) => <div key={i} className="grid gap-1 sm:grid-cols-2"><dt className="font-medium">{row.action}</dt><dd>{Object.entries(row).filter(([key,value]) => key !== "action" && typeof value === "string" && value.trim()).map(([key,value]) => `${key}: ${value}`).join("; ")}</dd></div>)}</dl></section> : null}
          {tipsHtml ? (
            <section className="article-content md-copy-scope game-copy min-w-0">
              <h2>{page.game_short_title || page.game_title} {isPrelaunch ? "pre-launch notes" : "gameplay tips"}</h2>
              {renderPageContentNodes(tipsHtml, `${page.slug}-tips`)}
            </section>
          ) : null}
        </article>

        <aside className="space-y-4">
          {hasGameDetails ? <section aria-label="Game details" className="hidden lg:block">
            <GameDetails page={page} releases={releases} platforms={platforms} />
          </section> : null}
        </aside>

        <div className="min-w-0 lg:col-start-1">
          <CommentsSection entityType={legacyWikiCommentType(namespace)} entityId={page.id} />
        </div>
      </div>
    </div>
  );
}

function GameDetails({ page, releases, platforms }: { page: SharedGameWikiPage; releases: string[]; platforms: string[] }) {
  const isPrelaunch = page.game_status === "upcoming" || page.game_status === "announced";
  const items = [
    isPrelaunch ? { label: "Status", value: page.game_status === "upcoming" ? "Upcoming" : "Announced" } : null,
    page.game_developer ? { label: "Developer", value: page.game_developer } : null,
    page.game_publisher ? { label: "Publisher", value: page.game_publisher } : null,
    releases.length ? { label: isPrelaunch ? "Announced release" : "Release", value: releases.join(" · ") } : null,
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
