import type { Metadata } from "next";
import { formatDistanceToNow } from "date-fns";
import { notFound } from "next/navigation";
import { IndexPageStats } from "@/components/IndexPageStats";
import { PagePagination } from "@/components/PagePagination";
import { breadcrumbJsonLd, SITE_NAME, SITE_URL, webPageJsonLd, buildAlternates } from "@/lib/seo";
import {
  BASE_PATH,
  MusicBreadcrumb,
  MusicCatalogNav,
  MusicIdItems,
  buildMusicItemListSchema,
  loadArtistMusicIdsPageData,
  loadArtistOptionBySlug
} from "../../../../page-data";

export const revalidate = 21600;

type PageProps = {
  params: Promise<{ artist: string; page: string }>;
};

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { artist, page } = await params;
  const pageNumber = Number(page);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) return {};
  return {
    title: `Artist Music IDs - Page ${pageNumber} | ${SITE_NAME}`,
    robots: { index: false, follow: true },
    alternates: buildAlternates(`${BASE_PATH}/artists/${artist}/page/${pageNumber}`)
  };
}

export default async function ArtistMusicIdsPaginatedPage({ params }: PageProps) {
  const { artist: artistSlug, page } = await params;
  const pageNumber = Number(page);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) {
    notFound();
  }

  const artist = await loadArtistOptionBySlug(artistSlug);
  if (!artist) {
    notFound();
  }

  const { songs, total, totalPages } = await loadArtistMusicIdsPageData(pageNumber, artist.label);
  if (pageNumber > totalPages) {
    notFound();
  }

  const description = `Roblox music IDs credited to ${artist.label}.`;
  const latest = songs.reduce<Date | null>((latestDate, song) => {
    if (!song.last_seen_at) return latestDate;
    const candidate = new Date(song.last_seen_at);
    if (!latestDate || candidate > latestDate) return candidate;
    return latestDate;
  }, null);
  const refreshedLabel = latest ? formatDistanceToNow(latest, { addSuffix: true }) : null;
  const canonicalPath = `${BASE_PATH}/artists/${artist.slug}/page/${pageNumber}`;
  const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;
  const pageTitle = `${artist.label} Roblox music IDs - Page ${pageNumber}`;
  const updatedIso = latest?.toISOString() ?? null;
  const breadcrumbNavItems = [
    { label: "Home", href: "/" },
    { label: "Catalog", href: "/catalog" },
    { label: "Roblox music IDs", href: BASE_PATH },
    { label: "Artists", href: `${BASE_PATH}/artists` },
    { label: artist.label, href: `${BASE_PATH}/artists/${artist.slug}` },
    { label: `Page ${pageNumber}`, href: null }
  ];
  const breadcrumbSchema = JSON.stringify(
    breadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Catalog", url: `${SITE_URL.replace(/\/$/, "")}/catalog` },
      { name: "Roblox music IDs", url: `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}` },
      { name: "Artists", url: `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}/artists` },
      { name: artist.label, url: `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}/artists/${artist.slug}` },
      { name: `Page ${pageNumber}`, url: canonicalUrl }
    ])
  );
  const listSchema = buildMusicItemListSchema({
    title: pageTitle,
    description,
    url: canonicalUrl,
    songs,
    total,
    startIndex: (pageNumber - 1) * 24
  });
  const pageSchema = JSON.stringify(
    webPageJsonLd({
      siteUrl: SITE_URL,
      slug: canonicalPath.replace(/^\//, ""),
      title: pageTitle,
      description,
      image: `${SITE_URL}/og-image.png`,
      author: null,
      publishedAt: null,
      updatedAt: updatedIso
    })
  );

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <MusicBreadcrumb items={breadcrumbNavItems} />
        <h1 className="text-3xl font-semibold text-foreground">{artist.label} Roblox music IDs</h1>
        <IndexPageStats
          items={[
            { label: `${total.toLocaleString("en-US")} songs`, icon: "music", tone: "accent" },
            ...(refreshedLabel ? [{ label: `Updated ${refreshedLabel}`, icon: "clock" as const }] : []),
            { label: `Page ${pageNumber} of ${totalPages}` }
          ]}
        />
      </header>

      <section id="article-body" itemProp="articleBody" className="journey-content-stream journey-content-stream--music">
        <MusicCatalogNav active="artists" />
        <MusicIdItems songs={songs} />
        <PagePagination
          basePath={`${BASE_PATH}/artists/${artist.slug}`}
          currentPage={pageNumber}
          totalPages={totalPages}
        />
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: listSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    </div>
  );
}
