import type { Metadata } from "next";
import { ContentCard } from "@/components/ContentCard";
import { IndexPageStats } from "@/components/IndexPageStats";
import { buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";
import { listPublishedGtaWikiPages, resolveGtaWikiCoverImage } from "@/lib/gta";

const description = "Browse Grand Theft Auto wikis and structured game collections on Bloxodes.";

export const metadata: Metadata = {
  title: `GTA Guides & Wikis | ${SITE_NAME}`,
  description,
  alternates: buildAlternates(`${SITE_URL}/gta`)
};

export const revalidate = 21600;

export default async function GtaHomePage() {
  const wikiPages = await listPublishedGtaWikiPages();
  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">Grand Theft Auto wiki hubs and game data</h1>
        <p className="max-w-2xl text-base text-muted md:text-lg">{description}</p>
        <IndexPageStats items={[{ label: `${wikiPages.length} game ${wikiPages.length === 1 ? "hub" : "hubs"}`, icon: "wiki", tone: "accent" }]} />
      </header>

      <section id="article-body" itemProp="articleBody" className="journey-content-stream journey-content-stream--index">
        {wikiPages.length ? wikiPages.map((page) => (
          <div key={page.id} data-journey-item className="h-full">
            <ContentCard
              type="wiki"
              variant="overlay"
              href={`/gta/wiki/${page.slug}`}
              title={page.title}
              image={{ src: resolveGtaWikiCoverImage(page), alt: page.title, ratio: "1200/675" }}
            />
          </div>
        )) : (
          <div className="rounded-xl border border-dashed border-border/60 bg-surface/40 p-8 text-center text-sm text-muted">No GTA wiki hubs have been published yet.</div>
        )}
      </section>
    </div>
  );
}
