import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { SITE_URL } from "@/lib/seo";
import { ChecklistCard } from "@/components/ChecklistCard";
import { IndexPageStats } from "@/components/IndexPageStats";
import { PagePagination } from "@/components/PagePagination";
import type { ChecklistCardData, ChecklistConfig } from "@/lib/engagement/types";

export function ChecklistIndexPage({
  cards,
  total,
  totalPages,
  currentPage,
  showHero,
  config
}: {
  cards: ChecklistCardData[];
  total: number;
  totalPages: number;
  currentPage: number;
  showHero: boolean;
  config: ChecklistConfig;
}) {
  const latest = cards.reduce<Date | null>((latestDate, card) => {
    if (!card.updatedAt) return latestDate;
    const candidate = new Date(card.updatedAt);
    if (!latestDate || candidate > latestDate) return candidate;
    return latestDate;
  }, null);
  const refreshedLabel = latest ? formatDistanceToNow(latest, { addSuffix: true }) : null;

  return (
    <div className="space-y-8">
      {showHero ? (
        <header className="space-y-4">
          <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
            {config.heading}
          </h1>
          <p className="max-w-2xl text-base text-muted md:text-lg">
            {config.intro}
          </p>
          <IndexPageStats
            items={[
              { label: `${total} checklists published`, icon: "checklists", tone: "accent" },
              ...(refreshedLabel ? [{ label: `Updated ${refreshedLabel}`, icon: "clock" as const }] : [])
            ]}
          />
        </header>
      ) : (
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/80">{config.title}</p>
          <h1 className="text-3xl font-semibold text-foreground">{config.title.replace(/Checklists$/, "checklists")}</h1>
          {refreshedLabel ? (
            <p className="text-sm text-muted">Updated {refreshedLabel} · Page {currentPage} of {totalPages}</p>
          ) : null}
        </header>
      )}

      <section id="article-body" itemProp="articleBody" className="journey-content-stream journey-content-stream--index">
        {cards.length ? (
          cards.map((card, index) => (
            <div
              key={card.id}
              data-journey-item
              className="h-full"
              data-analytics-event="select_item"
              data-analytics-item-list-name="checklists_index"
              data-analytics-item-id={card.slug}
              data-analytics-item-name={card.title}
              data-analytics-position={index + 1}
              data-analytics-content-type="checklist"
            >
              <ChecklistCard {...card} />
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
            No public checklists yet. Check back soon.
          </div>
        )}

        <PagePagination basePath={config.basePath} currentPage={currentPage} totalPages={totalPages} />

        <div className="rounded-xl border border-border/60 bg-surface/60 p-4 text-xs text-muted">
          Want a checklist added? <Link href="/contact" className="text-accent underline-offset-4 hover:underline">Tell us</Link> which
          game you want a guided rundown for.
        </div>
      </section>

      {showHero ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "CollectionPage",
              name: config.title,
              description: config.description,
              url: `${SITE_URL}${config.basePath}`
            })
          }}
        />
      ) : null}
    </div>
  );
}
