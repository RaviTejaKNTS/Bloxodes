import Link from "next/link";
import { CatalogAdSlot } from "@/components/CatalogAdSlot";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { ContentFaq } from "@/components/ContentFaq";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import type { CatalogPageContent } from "@/lib/catalog";
import {
  MUSIC_GAME_ID_PAGES,
  type MusicGameIdPage
} from "@/lib/game-specific-id-pages";
import { buildPageContentHtml, renderPageContentNodes, type PageContentHtml } from "@/lib/page-content";
import { breadcrumbJsonLd, SITE_URL, webPageJsonLd } from "@/lib/seo";
import {
  BASE_PATH,
  buildMusicItemListSchema,
  MusicCatalogNav,
  type MusicRow
} from "../page-data";
import { MusicIdsBrowser } from "../MusicIdsBrowser";

export const MUSIC_GAMES_PATH = `${BASE_PATH}/games`;

function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

function newestMusicDate(songs: MusicRow[], contentHtml: PageContentHtml | null): string | null {
  if (contentHtml?.updatedAt) return contentHtml.updatedAt;
  return songs.reduce<string | null>((latest, song) => {
    if (!song.last_seen_at) return latest;
    return !latest || Date.parse(song.last_seen_at) > Date.parse(latest) ? song.last_seen_at : latest;
  }, null);
}

export async function buildMusicGameContentHtml(catalog: CatalogPageContent | null) {
  return buildPageContentHtml(catalog);
}

export function renderMusicGamesHub({ contentHtml }: { contentHtml: PageContentHtml | null }) {
  const title = contentHtml?.title?.trim() || "Game-Specific Roblox Music IDs";
  const description =
    "Choose a Roblox game to find music, radio, kill-sound, and custom-audio IDs that match its in-game controls.";
  const intro = contentHtml?.introHtml
    ? renderPageContentNodes(contentHtml.introHtml, "music-games-intro")
    : <p>{description}</p>;
  const updatedAt = contentHtml?.updatedAt ?? null;
  const canonical = `${SITE_URL.replace(/\/$/, "")}${MUSIC_GAMES_PATH}`;
  const pageSchema = serializeJsonLd(webPageJsonLd({
    siteUrl: SITE_URL,
    slug: MUSIC_GAMES_PATH.replace(/^\//, ""),
    title,
    description,
    image: `${SITE_URL}/Bloxodes.png`,
    author: null,
    publishedAt: contentHtml?.publishedAt ?? undefined,
    updatedAt: updatedAt ?? undefined
  }));
  const breadcrumbSchema = serializeJsonLd(breadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: "Catalog", url: `${SITE_URL.replace(/\/$/, "")}/catalog` },
    { name: "Roblox Music IDs", url: `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}` },
    { name: title, url: canonical }
  ]));

  return (
    <div className="catalog-surface space-y-10">
      <header className="space-y-4">
        <PageBreadcrumb items={[
          { label: "Home", href: "/" },
          { label: "Catalog", href: "/catalog" },
          { label: "Roblox Music IDs", href: BASE_PATH },
          { label: title, href: null }
        ]} />
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{title}</h1>
        <UpdatedTimestamp value={updatedAt} />
      </header>

      <section id="article-body" itemProp="articleBody" className="article-content md-copy-scope copy-with-sidebar-space journey-content-stream journey-content-stream--options">
        {intro}
        <MusicCatalogNav active="games" />
        {MUSIC_GAME_ID_PAGES.map((game) => (
          <div key={game.slug} data-journey-item className="h-full">
            <Link href={`${MUSIC_GAMES_PATH}/${game.slug}`} className="group block h-full">
              <article className="h-full rounded-lg border border-border/70 bg-surface p-5 transition hover:border-accent/55">
                <h2 className="text-xl font-semibold leading-snug text-foreground">{game.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{game.description}</p>
              </article>
            </Link>
          </div>
        ))}
      </section>

      {contentHtml?.id ? <CommentsSection entityType="catalog" entityId={contentHtml.id} /> : null}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    </div>
  );
}

export function renderMusicGamePage({
  game,
  songs,
  total,
  totalPages,
  currentPage,
  contentHtml
}: {
  game: MusicGameIdPage;
  songs: MusicRow[];
  total: number;
  totalPages: number;
  currentPage: number;
  contentHtml: PageContentHtml | null;
}) {
  const baseTitle = game.title;
  const title = currentPage > 1 ? `${baseTitle} - Page ${currentPage}` : baseTitle;
  const basePath = `${MUSIC_GAMES_PATH}/${game.slug}`;
  const path = currentPage > 1 ? `${basePath}/page/${currentPage}` : basePath;
  const canonical = `${SITE_URL.replace(/\/$/, "")}${path}`;
  const updatedAt = newestMusicDate(songs, contentHtml);
  const introNodes = currentPage === 1 && contentHtml?.introHtml
    ? renderPageContentNodes(contentHtml.introHtml, `${game.slug}-music-intro`)
    : currentPage === 1 ? <p>{game.description}</p> : null;
  const descriptionNodes = currentPage === 1
    ? (contentHtml?.descriptionHtml ?? []).flatMap((entry) =>
        renderPageContentNodes(entry.html, `${game.slug}-music-description-${entry.key}`)
      )
    : [];
  const howNodes = currentPage === 1 && contentHtml?.howHtml
    ? renderPageContentNodes(contentHtml.howHtml, `${game.slug}-music-how`)
    : null;
  const faqNodes = currentPage === 1
    ? (contentHtml?.faqHtml ?? []).map((faq, index) => ({
        id: `${faq.q}-${index}`,
        question: faq.q,
        answer: renderPageContentNodes(faq.a, `${game.slug}-music-faq-${index}`)
      }))
    : [];
  const pageSchema = serializeJsonLd(webPageJsonLd({
    siteUrl: SITE_URL,
    slug: path.replace(/^\//, ""),
    title,
    description: game.description,
    image: songs[0]?.thumbnail_url || `${SITE_URL}/Bloxodes.png`,
    author: null,
    publishedAt: contentHtml?.publishedAt ?? undefined,
    updatedAt: updatedAt ?? undefined
  }));
  const breadcrumbItems = [
    { name: "Home", url: SITE_URL },
    { name: "Catalog", url: `${SITE_URL.replace(/\/$/, "")}/catalog` },
    { name: "Roblox Music IDs", url: `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}` },
    { name: "Game Specific", url: `${SITE_URL.replace(/\/$/, "")}${MUSIC_GAMES_PATH}` },
    { name: title, url: canonical }
  ];

  return (
    <div className="catalog-surface space-y-10">
      <header className="space-y-4">
        <PageBreadcrumb items={[
          { label: "Home", href: "/" },
          { label: "Catalog", href: "/catalog" },
          { label: "Roblox Music IDs", href: BASE_PATH },
          { label: "Game Specific", href: MUSIC_GAMES_PATH },
          { label: title, href: null }
        ]} />
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{title}</h1>
        <UpdatedTimestamp value={updatedAt} />
      </header>

      <section id="article-body" itemProp="articleBody" className="article-content md-copy-scope copy-with-sidebar-space journey-content-stream journey-content-stream--music">
        {introNodes}
        {currentPage === 1 ? <MusicCatalogNav active="games" /> : null}
        <MusicIdsBrowser
          initialSongs={songs}
          initialTotalPages={totalPages}
          currentPage={currentPage}
          basePath={basePath}
          preset={game.datasetPreset}
          idLabel={game.idLabel}
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
      {songs.length ? <script type="application/ld+json" dangerouslySetInnerHTML={{
        __html: buildMusicItemListSchema({
          title,
          description: game.description,
          url: canonical,
          songs,
          total,
          startIndex: (currentPage - 1) * 24
        })
      }} /> : null}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd(breadcrumbItems)) }} />
    </div>
  );
}
