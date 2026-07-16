import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { StatsGameDetailView, StatsPageShell } from "../../components/StatsViews";
import {
  getStatsGameBySlug,
  getStatsGameSummaryBySlug,
  isStatsGameDetailIndexable,
  robloxGameUrl,
  statsGameLastModifiedAt,
  statsGameSeoDescription,
  statsGameSeoTitle
} from "@/lib/stats";
import { buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const game = await getStatsGameSummaryBySlug(slug);
  const canonical = `${SITE_URL}/stats/games/${game?.slug ?? slug}`;
  if (!game) return { alternates: buildAlternates(canonical), robots: { index: false, follow: false } };

  const title = `${statsGameSeoTitle(game.displayName)} | ${SITE_NAME}`;
  const description = statsGameSeoDescription(game);
  const indexable = await isStatsGameDetailIndexable(game);
  return {
    title,
    description,
    alternates: buildAlternates(canonical),
    robots: indexable ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      images: game.iconUrl ? [game.iconUrl] : undefined
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: game.iconUrl ? [game.iconUrl] : undefined
    }
  };
}

export default async function StatsGameDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getStatsGameBySlug(slug);
  if (!data) notFound();

  const game = data.game;
  if (slug !== game.slug) {
    redirect(`/stats/games/${game.slug}`);
  }
  const dateModified = statsGameLastModifiedAt(game);

  return (
    <StatsPageShell>
      <StatsGameDetailView data={data} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "VideoGame",
            name: game.displayName,
            url: `${SITE_URL}/stats/games/${game.slug}`,
            sameAs: robloxGameUrl(game),
            image: game.iconUrl ?? undefined,
            genre: game.genre ?? undefined,
            dateModified: dateModified ?? undefined,
            aggregateRating:
              game.ratingPercent != null
                ? {
                    "@type": "AggregateRating",
                    ratingValue: game.ratingPercent,
                    bestRating: 100,
                    worstRating: 0,
                    ratingCount: (game.likes ?? 0) + (game.dislikes ?? 0)
                  }
                : undefined
          })
        }}
      />
    </StatsPageShell>
  );
}
