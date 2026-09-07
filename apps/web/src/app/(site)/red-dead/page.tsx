import type { Metadata } from "next";
import { ContentCard } from "@/components/ContentCard";
import { IndexPageStats } from "@/components/IndexPageStats";
import { buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";
import { listPublishedRedDeadWikiPages, resolveRedDeadWikiCoverImage } from "@/lib/red-dead";

const description = "Browse Red Dead wikis and structured game collections on Bloxodes.";

export const metadata: Metadata = {
  title: `Red Dead Guides & Wikis | ${SITE_NAME}`,
  description,
  alternates: buildAlternates(`${SITE_URL}/red-dead`)
};

export const revalidate = 21600;

export default async function RedDeadHomePage() {
  const wikiPages = await listPublishedRedDeadWikiPages();

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">Red Dead wiki hubs and game data</h1>
        <p className="max-w-2xl text-base text-muted md:text-lg">{description}</p>
        <IndexPageStats items={[{ label: `${wikiPages.length} game ${wikiPages.length === 1 ? "hub" : "hubs"}`, icon: "wiki", tone: "accent" }]} />
      </header>

      <section id="article-body" itemProp="articleBody" className="journey-content-stream journey-content-stream--index">
        {wikiPages.length ? wikiPages.map((page) => (
          <div key={page.id} data-journey-item className="h-full">
            <ContentCard
              type="wiki"
              variant="overlay"
              href={`/red-dead/wiki/${page.slug}`}
              title={page.title}
              image={{ src: resolveRedDeadWikiCoverImage(page), alt: page.title, ratio: "1200/675" }}
            />
          </div>
        )) : (
          <div className="rounded-xl border border-dashed border-border/60 bg-surface/40 p-8 text-center text-sm text-muted">No Red Dead wiki hubs have been published yet.</div>
        )}
      </section>
    </div>
  );
}
