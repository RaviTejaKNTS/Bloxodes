import type { Metadata } from "next";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { listCodePagesWithActiveCountsPage, type CodePageWithCounts } from "@/lib/db";
import { SITE_NAME, SITE_URL, buildAlternates } from "@/lib/seo";
import { GameCard } from "@/components/GameCard";
import { IndexPageStats } from "@/components/IndexPageStats";
import { PagePagination } from "@/components/PagePagination";
import { IndexGuide, IndexGuideLinks } from "../index-guide";
import { CODES_INDEX_DESCRIPTION, codesGuideSections } from "./index-content";

export const CODES_PAGE_SIZE = 20;

export type CodesPageData = {
  games: CodePageWithCounts[];
  total: number;
  totalPages: number;
};

export async function loadCodesPageData(pageNumber: number): Promise<CodesPageData> {
  const { games, total } = await listCodePagesWithActiveCountsPage(pageNumber, CODES_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / CODES_PAGE_SIZE));
  return { games, total, totalPages };
}

function CodesPageView({
  games,
  totalGames,
  totalPages,
  currentPage,
  showHero
}: {
  games: CodePageWithCounts[];
  totalGames: number;
  totalPages: number;
  currentPage: number;
  showHero: boolean;
}) {
  const mostRecentGame = games[0];
  const mostRecentUpdate = mostRecentGame
    ? new Date(mostRecentGame.content_updated_at ?? mostRecentGame.updated_at)
    : null;
  const refreshedLabel = mostRecentUpdate ? formatDistanceToNow(mostRecentUpdate, { addSuffix: true }) : null;

  return (
    <div className="space-y-10">
      {showHero ? (
        <header className="space-y-4">
          <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
            Roblox Game Codes
          </h1>
          <p className="max-w-2xl text-base text-muted md:text-lg">
            Find codes for the Roblox games you play, with reward lists and instructions for claiming them.
            Search for a game or choose a card below, then check its codes page for the rewards and redemption steps.
          </p>
          <IndexPageStats
            items={[
              { label: `${totalGames} games tracked`, icon: "codes", tone: "accent" },
            ]}
          />
          <IndexGuideLinks sections={codesGuideSections} />
        </header>
      ) : (
        <header className="space-y-2">
          <Link href="/codes" className="text-sm text-muted underline underline-offset-4 hover:text-accent">Roblox game codes guide</Link>
          <h1 className="text-3xl font-semibold text-foreground">Roblox game codes</h1>
          <p className="text-sm text-muted">Page {currentPage} of {totalPages}{refreshedLabel ? ` · Game pages updated ${refreshedLabel}` : ""}</p>
        </header>
      )}

      <section id="article-body" aria-label="Game codes directory and guide" className="journey-content-stream journey-content-stream--index">
        {games.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-surface/60 p-8 text-center text-sm text-muted">
            We haven’t published any game code pages yet. Check back soon.
          </div>
        ) : (
          games.map((game, index) => (
            <div
              key={game.id}
              data-journey-item
              className="h-full"
              data-analytics-event="select_item"
              data-analytics-item-list-name="codes_index"
              data-analytics-item-id={game.slug}
              data-analytics-item-name={game.name}
              data-analytics-position={index + 1}
              data-analytics-content-type="codes"
            >
              <GameCard
                game={game}
                priority={showHero && index < 2}
                articleUpdatedAt={game.content_updated_at ?? game.updated_at ?? null}
              />
            </div>
          ))
        )}

        <PagePagination basePath="/codes" currentPage={currentPage} totalPages={totalPages} />
        {showHero ? <IndexGuide sections={codesGuideSections} /> : null}
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: showHero ? "Roblox Game Codes" : `Roblox Game Codes - Page ${currentPage}`,
            description: CODES_INDEX_DESCRIPTION,
            url: `${SITE_URL}${showHero ? "/codes" : `/codes/page/${currentPage}`}`,
            inLanguage: "en-US",
            isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
            mainEntity: {
              "@type": "ItemList",
              itemListElement: games.map((game, index) => ({
                "@type": "ListItem",
                position: (currentPage - 1) * CODES_PAGE_SIZE + index + 1,
                name: `${game.name} Codes`,
                url: `${SITE_URL}/codes/${game.slug}`
              }))
            }
          }).replace(/</g, "\\u003c")
        }}
      />
    </div>
  );
}

export function renderCodesPage(props: Parameters<typeof CodesPageView>[0]) {
  return <CodesPageView {...props} />;
}

export const codesMetadata: Metadata = {
  title: "Roblox Game Codes",
  description: CODES_INDEX_DESCRIPTION,
  alternates: buildAlternates(`${SITE_URL}/codes`),
  openGraph: {
    type: "website",
    title: "Roblox Game Codes",
    description: CODES_INDEX_DESCRIPTION,
    url: `${SITE_URL}/codes`,
    siteName: SITE_NAME,
    images: [`${SITE_URL}/Bloxodes.png`]
  },
  twitter: {
    card: "summary_large_image",
    title: "Roblox Game Codes",
    description: CODES_INDEX_DESCRIPTION,
    images: [`${SITE_URL}/Bloxodes.png`]
  }
};
