import type { Metadata } from "next";
import { StatsGamesView, StatsPageShell } from "../components/StatsViews";
import { getStatsGamesSeoState, getStatsGamesSeoTaxonomy, listStatsGames, parseStatsSearchParams } from "@/lib/stats";
import { buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const parsed = parseStatsSearchParams(await searchParams);
  const taxonomy = await getStatsGamesSeoTaxonomy();
  const seo = getStatsGamesSeoState(parsed, taxonomy);
  const canonical = `${SITE_URL}${seo.canonicalPath}`;
  return {
    title: `${seo.title} | ${SITE_NAME}`,
    description: seo.description,
    alternates: buildAlternates(canonical),
    robots: seo.indexable ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title: `${seo.title} | ${SITE_NAME}`,
      description: seo.description,
      url: canonical,
      siteName: SITE_NAME
    },
    twitter: {
      card: "summary",
      title: `${seo.title} | ${SITE_NAME}`,
      description: seo.description
    }
  };
}

export default async function StatsGamesPage({ searchParams }: PageProps) {
  const parsed = parseStatsSearchParams(await searchParams);
  const data = await listStatsGames({
    page: parsed.page,
    q: parsed.q,
    genres: parsed.genres,
    subgenres: parsed.subgenres,
    sort: parsed.sort,
    minPlayers: parsed.minPlaying,
    columns: parsed.columns
  });
  const seo = getStatsGamesSeoState(parsed, { genres: data.validGenres, subgenres: data.subgenres });
  const canonical = `${SITE_URL}${seo.canonicalPath}`;
  return (
    <StatsPageShell>
      <StatsGamesView data={data} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: seo.title,
            description: seo.description,
            url: canonical,
            dateModified: data.lastUpdatedAt ?? undefined,
            isPartOf: {
              "@type": "WebSite",
              name: SITE_NAME,
              url: SITE_URL
            }
          })
        }}
      />
    </StatsPageShell>
  );
}
