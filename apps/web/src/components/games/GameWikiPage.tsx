import { WikiControls } from "@/components/wiki/WikiControls";
import { SocialShare } from "@/components/SocialShare";
import { ContentCard } from "@/components/ContentCard";
import type { GameDirectoryPage } from "@/lib/game-registry";
import { resolveGameCoverImage } from "@/lib/game-images";
import { PageSidebar } from "@/components/PageSidebar";
import { safeJsonLd } from "@/lib/seo";
import { gameBreadcrumbs, gameWikiCanonicalPath, type GameWikiPresentationPage } from "@/lib/game-root-page";
import type { Metadata } from "next";
import { Fragment, type ReactNode } from "react";
import { ContentCopyNodes } from "./ContentCopyNodes";
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
export function gameWikiMetadata(page: GameWikiPresentationPage): Metadata {
 const canonical = `${SITE_URL}${gameWikiCanonicalPath(page)}`;
 const title = resolveSeoTitle(page.seo_title) ?? page.title;
 const description = summary(page.meta_description ?? page.description_md, `Learn how ${page.game_title} works.`);
 const image = resolveGameCoverImage(page);
 return { title, description, alternates: buildAlternates(canonical), openGraph: { type: "article", title, description, url: canonical, siteName: SITE_NAME, images: image ? [image] : [] }, twitter: { card: "summary_large_image", title, description, images: image ? [image] : [] } };
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

export type GameWikiPageProps = {
  page: GameWikiPresentationPage;
  namespace: string;
  namespaceTitle: string;
  extraLinks?: Array<{ href: string; title: string }>;
  directoryPages?: GameDirectoryPage[];
  sidebarContent?: ReactNode;
  landingPath?: string;
};

export async function renderGameWikiPage({ page, namespace, namespaceTitle, extraLinks = [], directoryPages = [], sidebarContent, landingPath = `/${namespace}` }: GameWikiPageProps) {
  const reader = createGameReader(namespace);

  const isFranchiseHub = page.game_kind === "franchise";
  const collections = isFranchiseHub ? [] : await reader.listPublishedSharedGameWikiCollectionsByWikiSlug(page.slug);
  const directory = isFranchiseHub || page.canonical_path === `/${namespace}`
    ? directoryPages.filter(link => link.href !== page.canonical_path
      && (!isFranchiseHub || (link.kind === "game_wiki_pages_view" && link.href !== `/${namespace}` && link.href !== `/${namespace}/wiki`))
      && !(page.canonical_path === `/${namespace}` && link.href === `/${namespace}/wiki`)
      && !collections.some(collection => collection.canonical_path === link.href))
    : [];
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
  const canonicalPath = gameWikiCanonicalPath(page);
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;
  const breadcrumbs = gameBreadcrumbs([
    { label: "Home", href: "/" },
    { label: namespaceTitle, href: landingPath },
    ...([`/${namespace}`, `/${namespace}/wiki`].includes(page.canonical_path) ? [] : [{ label: "Wiki", href: `/${namespace}/wiki` }]),
    { label: page.game_short_title || page.game_title, href: null }
  ], canonicalPath);
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
  const listedPages = [
    ...directory.map(link => ({ name: link.title, path: link.href })),
    ...collectionGroups.flatMap(group => group.entries.map(({ collection }) => ({ name: collection.display_name, path: collection.canonical_path })))
  ];

  const structuredData = [
    {
      ...webPageJsonLd({ siteUrl: SITE_URL, slug: canonicalPath.slice(1), title: page.title, description, image: coverImage || undefined, author: null, publishedAt: page.published_at, updatedAt }),
      ...(isFranchiseHub || listedPages.length ? {
        "@type": "CollectionPage",
        mainEntity: {
          "@type": "ItemList",
          name: isFranchiseHub || directory.length ? page.title : `${page.game_title} collections`,
          numberOfItems: listedPages.length,
          itemListElement: listedPages.map((entry, index) => ({
            "@type": "ListItem", position: index + 1, name: entry.name, url: `${SITE_URL}${entry.path}`
          }))
        }
      } : {})
    },
    breadcrumbJsonLd(breadcrumbs.map(item => ({ name: item.label, url: item.href === "/" ? SITE_URL : `${SITE_URL}${item.href || canonicalPath}` })))
  ];

  return (
    <div className="space-y-9">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd({ "@context": "https://schema.org", "@graph": structuredData }) }} />
      <header className="space-y-6">
        <PageBreadcrumb items={breadcrumbs} />
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
            {thumbnailImage ? <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl border border-border/70 bg-surface-muted shadow-soft sm:h-28 sm:w-28">
              <Image src={thumbnailImage} alt={`${page.game_title} artwork`} fill className="object-cover" sizes="112px" priority />
            </div> : null}
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
      <div className="grid gap-8 content-sidebar-grid">
        <article id="article-body" itemProp="articleBody" className={`min-w-0 journey-content-stream ${isFranchiseHub ? "content-start gap-5 sm:grid-cols-2 lg:grid-cols-3" : "space-y-9 journey-content-stream--prose"}`}>
          {descriptionHtml ? (
            <ContentCopyNodes nodes={renderPageContentNodes(descriptionHtml, `${page.slug}-description`)} group="game-wiki-intro" className="game-copy max-w-3xl min-w-0 text-foreground" />
          ) : null}

          {hasGameDetails ? (
            <section aria-label="Game details" className="lg:hidden">
              <GameDetails page={page} releases={releases} platforms={platforms} />
            </section>
          ) : null}

          {directory.map(link => <div key={link.href} data-journey-item><ContentCard type="wiki" variant="overlay" href={link.href} title={link.title} image={link.image ? { src: link.image, alt: link.title, ratio: "1200/675" } : undefined} /></div>)}
          {collectionGroups.map((group) => (
            <Fragment key={group.key}>
              <h2 id={`${namespace}-${group.key}-heading`} className="ads-content-section-heading ads-content-game-section-heading text-2xl font-semibold leading-tight text-foreground">{group.label}</h2>
                {group.entries.map(({ collection, copyHtml, imageUrls }) => (
                  <section key={collection.id} className="ads-content-collection ads-content-game-collection space-y-4" data-journey-item>
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
            </Fragment>
          ))}

          <WikiControls value={page.controls_json} heading={`${page.game_short_title || page.game_title} Controls`} />
          {tipsHtml ? (
            <>
              <div className="ads-content-tips-heading article-content md-copy-scope game-copy min-w-0"><h2>{page.game_short_title || page.game_title} {isPrelaunch ? "pre-launch notes" : "gameplay tips"}</h2></div>
              <ContentCopyNodes nodes={renderPageContentNodes(tipsHtml, `${page.slug}-tips`)} group="game-wiki-tips" className="game-copy min-w-0" />
            </>
          ) : null}
        </article>

        <PageSidebar>
          <SocialShare url={canonicalUrl} title={page.title} heading="Share this wiki" />
          {sidebarContent}
          {hasGameDetails ? <section aria-label="Game details" className="hidden lg:block">
            <GameDetails page={page} releases={releases} platforms={platforms} />
          </section> : null}
        </PageSidebar>

        <div className="min-w-0 lg:col-start-1">
          {page.id !== page.game_id ? <CommentsSection entityType={legacyWikiCommentType(namespace)} entityId={page.id} /> : null}
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
