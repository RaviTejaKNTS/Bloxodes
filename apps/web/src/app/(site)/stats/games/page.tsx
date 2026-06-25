import type { Metadata } from "next";
import { StatsGamesView, StatsPageShell } from "../components/StatsViews";
import { getStatsGamesSeoState, listStatsGames, parseStatsSearchParams } from "@/lib/stats";
import { buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const parsed = parseStatsSearchParams(await searchParams);
  const seo = getStatsGamesSeoState(parsed);
  const canonical = `${SITE_URL}${seo.canonicalPath}`;
  return {
    title: `${seo.title} | ${SITE_NAME}`,
    description: seo.description,
    alternates: buildAlternates(canonical),
    robots: seo.indexable ? undefined : { index: false, follow: true },
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
  return (
    <StatsPageShell>
      <StatsGamesView data={data} />
    </StatsPageShell>
  );
}
