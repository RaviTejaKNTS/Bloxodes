import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { IndexPageStats } from "@/components/IndexPageStats";
import { QuizCard } from "@/components/QuizCard";
import { SITE_URL } from "@/lib/seo";
import { engagementProgressKey } from "@/lib/engagement/types";
import type { QuizCardData, QuizConfig } from "@/lib/engagement/types";

export function QuizIndexPage({ cards, total, config }: { cards: QuizCardData[]; total: number; config: QuizConfig }) {
  const latest = cards.reduce<Date | null>((latestDate, card) => {
    if (!card.updatedAt) return latestDate;
    const candidate = new Date(card.updatedAt);
    if (!latestDate || candidate > latestDate) return candidate;
    return latestDate;
  }, null);
  const refreshedLabel = latest ? formatDistanceToNow(latest, { addSuffix: true }) : null;

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
          {config.heading}
        </h1>
        <p className="max-w-2xl text-base text-muted md:text-lg">
          {config.intro}
        </p>
        <IndexPageStats
          items={[
            { label: `${total} quizzes published`, icon: "quizzes", tone: "accent" },
            ...(refreshedLabel ? [{ label: `Updated ${refreshedLabel}`, icon: "clock" as const }] : [])
          ]}
        />
      </header>

      <section id="article-body" itemProp="articleBody" className="journey-content-stream journey-content-stream--index">
        {cards.length ? (
          cards.map((card, index) => (
            <div
              key={card.code}
              data-journey-item
              className="h-full"
              data-analytics-event="select_item"
              data-analytics-item-list-name="quizzes_index"
              data-analytics-item-id={card.code}
              data-analytics-item-name={card.title}
              data-analytics-position={index + 1}
              data-analytics-content-type="quiz"
            >
              <QuizCard {...card} code={engagementProgressKey(config.progressNamespace, card.code)} progressEndpoint={config.progress.progressEndpoint} />
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
            No quizzes have been published yet. Check back soon.
          </div>
        )}

        <div className="rounded-xl border border-border/60 bg-surface/60 p-4 text-xs text-muted">
          Want a quiz for another game? <Link href="/contact" className="text-accent underline-offset-4 hover:underline">Tell us</Link> which
          experience you want next.
        </div>
      </section>

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
    </div>
  );
}
