import type { Metadata } from "next";
import { formatDistanceToNow } from "date-fns";
import { notFound } from "next/navigation";
import { CatalogAdSlot } from "@/components/CatalogAdSlot";
import { IndexPageStats } from "@/components/IndexPageStats";
import { PagePagination } from "@/components/PagePagination";
import { breadcrumbJsonLd, SITE_NAME, SITE_URL, webPageJsonLd } from "@/lib/seo";
import {
  BASE_PATH,
  MusicBreadcrumb,
  MusicCatalogNav,
  MusicIdGrid,
  buildMusicItemListSchema,
  loadGenreMusicIdsPageData,
  loadGenreOptionBySlug
} from "../../page-data";

export const revalidate = 21600;

export const metadata: Metadata = {
  title: `Genre Music IDs | ${SITE_NAME}`,
  description: "Roblox music IDs filtered by genre.",
  robots: { index: false, follow: true }
};

type PageProps = {
  params: Promise<{ genre: string }>;
};

export async function generateStaticParams() {
  return [];
}

export default async function GenreMusicIdsPage({ params }: PageProps) {
  const { genre: genreSlug } = await params;
  const genre = await loadGenreOptionBySlug(genreSlug);
  if (!genre) {
    notFound();
  }

  const { songs, total, totalPages } = await loadGenreMusicIdsPageData(1, genre.label);
  const description = `Roblox music IDs tagged with ${genre.label}.`;
  const latest = songs.reduce<Date | null>((latestDate, song) => {
    if (!song.last_seen_at) return latestDate;
    const candidate = new Date(song.last_seen_at);
    if (!latestDate || candidate > latestDate) return candidate;
    return latestDate;
  }, null);
  const refreshedLabel = latest ? formatDistanceToNow(latest, { addSuffix: true }) : null;
  const canonicalPath = `${BASE_PATH}/genres/${genre.slug}`;
  const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;
  const pageTitle = `${genre.label} Roblox music IDs`;
  const updatedIso = latest?.toISOString() ?? null;
  const breadcrumbNavItems = [
    { label: "Home", href: "/" },
    { label: "Catalog", href: "/catalog" },
    { label: "Roblox music IDs", href: BASE_PATH },
    { label: "Genres", href: `${BASE_PATH}/genres` },
    { label: genre.label, href: null }
  ];
  const breadcrumbSchema = JSON.stringify(
    breadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Catalog", url: `${SITE_URL.replace(/\/$/, "")}/catalog` },
      { name: "Roblox music IDs", url: `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}` },
      { name: "Genres", url: `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}/genres` },
      { name: genre.label, url: canonicalUrl }
    ])
  );
  const listSchema = buildMusicItemListSchema({
    title: pageTitle,
    description,
    url: canonicalUrl,
    songs,
    total,
    startIndex: 0
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
      <header className="space-y-4">
        <MusicBreadcrumb items={breadcrumbNavItems} />
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
          {genre.label} Roblox music IDs
        </h1>
        <p className="max-w-2xl text-base text-muted md:text-lg">
          Every music ID tagged with {genre.label}, ready for quick copy and play.
        </p>
        <IndexPageStats
          items={[
            { label: `${total.toLocaleString("en-US")} songs`, icon: "music", tone: "accent" },
            ...(refreshedLabel ? [{ label: `Updated ${refreshedLabel}`, icon: "clock" as const }] : []),
            { label: "24 per page" }
          ]}
        />
      </header>

      <CatalogAdSlot />

      <MusicCatalogNav active="genres" />

      <MusicIdGrid songs={songs} />

      <PagePagination
        basePath={`${BASE_PATH}/genres/${genre.slug}`}
        currentPage={1}
        totalPages={totalPages}
      />

      <CatalogAdSlot />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: listSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    </div>
  );
}
