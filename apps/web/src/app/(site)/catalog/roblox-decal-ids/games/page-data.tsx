import Link from "next/link";
import { CatalogAdSlot } from "@/components/CatalogAdSlot";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { ContentFaq } from "@/components/ContentFaq";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import type { CatalogPageContent } from "@/lib/catalog";
import { DECAL_GAME_ID_PAGES, type DecalGameIdPage } from "@/lib/game-specific-id-pages";
import { buildPageContentHtml, renderPageContentNodes, type PageContentHtml } from "@/lib/page-content";
import { breadcrumbJsonLd, SITE_URL, webPageJsonLd } from "@/lib/seo";
import { DecalIdsBrowser } from "../DecalIdsBrowser";
import {
  BASE_PATH,
  buildDecalItemListSchema,
  DecalCatalogNav,
  type DecalRow
} from "../page-data";

export const DECAL_GAMES_PATH = `${BASE_PATH}/games`;

function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

function newestDecalDate(decals: DecalRow[], contentHtml: PageContentHtml | null): string | null {
  if (contentHtml?.updatedAt) return contentHtml.updatedAt;
  return decals.reduce<string | null>((latest, decal) => {
    const value = decal.verified_at ?? decal.last_seen_at ?? decal.thumbnail_checked_at;
    if (!value) return latest;
    return !latest || Date.parse(value) > Date.parse(latest) ? value : latest;
  }, null);
}

export async function buildDecalGameContentHtml(catalog: CatalogPageContent | null) {
  return buildPageContentHtml(catalog);
}

export function renderDecalGamesHub({ contentHtml }: { contentHtml: PageContentHtml | null }) {
  const title = contentHtml?.title?.trim() || "Game-Specific Roblox Decal IDs";
  const description = "Choose a Roblox game to find image IDs for its crosshairs, faces, pictures, billboards, and custom-image tools.";
  const intro = contentHtml?.introHtml ? renderPageContentNodes(contentHtml.introHtml, "decal-games-intro") : <p>{description}</p>;
  const updatedAt = contentHtml?.updatedAt ?? null;
  const canonical = `${SITE_URL.replace(/\/$/, "")}${DECAL_GAMES_PATH}`;
  const pageSchema = serializeJsonLd(webPageJsonLd({
    siteUrl: SITE_URL,
    slug: DECAL_GAMES_PATH.replace(/^\//, ""),
    title,
    description,
    image: `${SITE_URL}/Bloxodes.png`,
    author: null,
    publishedAt: contentHtml?.publishedAt ?? undefined,
    updatedAt: updatedAt ?? undefined
  }));

  return (
    <div className="catalog-surface space-y-10">
      <header className="space-y-4">
        <PageBreadcrumb items={[
          { label: "Home", href: "/" },
          { label: "Catalog", href: "/catalog" },
          { label: "Roblox Decal IDs", href: BASE_PATH },
          { label: title, href: null }
        ]} />
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{title}</h1>
        <UpdatedTimestamp value={updatedAt} />
      </header>
      <section id="article-body" itemProp="articleBody" className="article-content md-copy-scope copy-with-sidebar-space space-y-8">
        {intro}
        <DecalCatalogNav active="games" />
        <div className="grid gap-4 md:grid-cols-2">
          {DECAL_GAME_ID_PAGES.map((game) => (
            <Link key={game.slug} href={`${DECAL_GAMES_PATH}/${game.slug}`} className="block">
              <article data-journey-item className="h-full rounded-lg border border-border/70 bg-surface p-5 transition hover:border-accent/55">
                <h2 className="text-xl font-semibold leading-snug text-foreground">{game.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{game.description}</p>
              </article>
            </Link>
          ))}
        </div>
      </section>
      {contentHtml?.id ? <CommentsSection entityType="catalog" entityId={contentHtml.id} /> : null}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd([
        { name: "Home", url: SITE_URL },
        { name: "Catalog", url: `${SITE_URL.replace(/\/$/, "")}/catalog` },
        { name: "Roblox Decal IDs", url: `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}` },
        { name: title, url: canonical }
      ])) }} />
    </div>
  );
}

export function renderDecalGamePage({
  game,
  decals,
  total,
  totalPages,
  currentPage,
  contentHtml
}: {
  game: DecalGameIdPage;
  decals: DecalRow[];
  total: number;
  totalPages: number;
  currentPage: number;
  contentHtml: PageContentHtml | null;
}) {
  const baseTitle = contentHtml?.title?.trim() || game.title;
  const title = currentPage > 1 ? `${baseTitle} - Page ${currentPage}` : baseTitle;
  const basePath = `${DECAL_GAMES_PATH}/${game.slug}`;
  const path = currentPage > 1 ? `${basePath}/page/${currentPage}` : basePath;
  const canonical = `${SITE_URL.replace(/\/$/, "")}${path}`;
  const updatedAt = newestDecalDate(decals, contentHtml);
  const introNodes = currentPage === 1 && contentHtml?.introHtml
    ? renderPageContentNodes(contentHtml.introHtml, `${game.slug}-decal-intro`)
    : currentPage === 1 ? <p>{game.description}</p> : null;
  const descriptionNodes = currentPage === 1
    ? (contentHtml?.descriptionHtml ?? []).flatMap((entry) =>
        renderPageContentNodes(entry.html, `${game.slug}-decal-description-${entry.key}`)
      )
    : [];
  const howNodes = currentPage === 1 && contentHtml?.howHtml
    ? renderPageContentNodes(contentHtml.howHtml, `${game.slug}-decal-how`)
    : null;
  const faqNodes = currentPage === 1
    ? (contentHtml?.faqHtml ?? []).map((faq, index) => ({
        id: `${faq.q}-${index}`,
        question: faq.q,
        answer: renderPageContentNodes(faq.a, `${game.slug}-decal-faq-${index}`)
      }))
    : [];
  const pageSchema = serializeJsonLd(webPageJsonLd({
    siteUrl: SITE_URL,
    slug: path.replace(/^\//, ""),
    title,
    description: game.description,
    image: decals[0]?.thumbnail_url || `${SITE_URL}/Bloxodes.png`,
    author: null,
    publishedAt: contentHtml?.publishedAt ?? undefined,
    updatedAt: updatedAt ?? undefined
  }));
  const breadcrumbSchema = serializeJsonLd(breadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: "Catalog", url: `${SITE_URL.replace(/\/$/, "")}/catalog` },
    { name: "Roblox Decal IDs", url: `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}` },
    { name: "Game Specific", url: `${SITE_URL.replace(/\/$/, "")}${DECAL_GAMES_PATH}` },
    { name: title, url: canonical }
  ]));

  return (
    <div className="catalog-surface space-y-10">
      <header className="space-y-4">
        <PageBreadcrumb items={[
          { label: "Home", href: "/" },
          { label: "Catalog", href: "/catalog" },
          { label: "Roblox Decal IDs", href: BASE_PATH },
          { label: "Game Specific", href: DECAL_GAMES_PATH },
          { label: title, href: null }
        ]} />
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{title}</h1>
        <UpdatedTimestamp value={updatedAt} />
      </header>
      <section id="article-body" itemProp="articleBody" className="article-content md-copy-scope copy-with-sidebar-space space-y-8">
        {introNodes}
        {currentPage === 1 ? <DecalCatalogNav active="games" /> : null}
        <DecalIdsBrowser
          initialDecals={decals}
          initialTotalPages={totalPages}
          currentPage={currentPage}
          basePath={basePath}
          section="game"
          preset={game.datasetPreset}
          idLabel={game.idLabel}
          copyTextureId={game.copyTextureId}
          gameSlug={game.slug}
        />
        {currentPage === 1 ? (
          <>
            <CatalogAdSlot />
            {descriptionNodes}
            {howNodes}
            {faqNodes.length ? <ContentFaq items={faqNodes} title={`${baseTitle} FAQ`} /> : null}
            <CatalogAdSlot />
          </>
        ) : null}
      </section>
      {currentPage === 1 && contentHtml?.id ? <CommentsSection entityType="catalog" entityId={contentHtml.id} /> : null}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      {decals.length ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: buildDecalItemListSchema({
        title,
        description: game.description,
        url: canonical,
        decals,
        total,
        startIndex: (currentPage - 1) * 24
      }) }} /> : null}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    </div>
  );
}
