import type { Metadata } from "next";
import { ContentCard } from "@/components/ContentCard";
import { IndexPageStats } from "@/components/IndexPageStats";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";
import { listPublishedRedDeadWikiPages, resolveRedDeadWikiCoverImage } from "@/lib/red-dead";

const description = "Browse Bloxodes wiki hubs and structured collections for Red Dead games.";

export const metadata: Metadata = {
  title: `Red Dead Wiki | ${SITE_NAME}`,
  description,
  alternates: buildAlternates(`${SITE_URL}/red-dead/wiki`)
};

export const revalidate = 21600;

export default async function RedDeadWikiIndexPage() {
  const pages = await listPublishedRedDeadWikiPages();

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <PageBreadcrumb items={[{ label: "Home", href: "/" }, { label: "Red Dead", href: "/red-dead" }, { label: "Wiki", href: null }]} />
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">Red Dead Wiki</h1>
        <p className="max-w-2xl text-base leading-7 text-muted md:text-lg">{description}</p>
        <IndexPageStats items={[{ label: `${pages.length} game ${pages.length === 1 ? "hub" : "hubs"}`, icon: "wiki", tone: "accent" }]} />
      </header>

      <section id="article-body" className="journey-content-stream journey-content-stream--index">
        {pages.length ? pages.map((page) => (
          <div key={page.id} data-journey-item data-analytics-content-type="red_dead_wiki">
            <ContentCard
              type="wiki"
              variant="overlay"
              href={`/red-dead/wiki/${page.slug}`}
              title={page.title}
              image={{ src: resolveRedDeadWikiCoverImage(page), alt: page.title, ratio: "1200/675" }}
            />
          </div>
        )) : (
          <div className="rounded-xl border border-dashed border-border/70 bg-surface/60 p-8 text-center text-muted">No Red Dead wiki hubs have been published yet.</div>
        )}
      </section>
    </div>
  );
}
