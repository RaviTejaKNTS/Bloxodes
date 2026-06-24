import "server-only";
import Link from "next/link";
import { listCodePagesWithActiveCounts, listPublishedArticles } from "@/lib/db";
import { listPublishedTools } from "@/lib/tools";
import { listPublishedQuizzes } from "@/lib/quizzes";
import { listPublishedPuzzlePages } from "@/lib/puzzles";
import { resolveModifiedAt } from "@/lib/content-dates";
import { GameCard } from "@/components/GameCard";
import { ArticleCard } from "@/components/ArticleCard";
import { ToolCard } from "@/components/ToolCard";
import { QuizCard } from "@/components/QuizCard";
import { EventsPageCard } from "@/components/EventsPageCard";
import { CardImage } from "@/components/CardImage";
import { buildEventsCards } from "@/app/(site)/events/page-data";

function time(value: string | null | undefined): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function pickThumbnail(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const picked = pickThumbnail(entry);
      if (picked) return picked;
    }
  }
  if (value && typeof value === "object" && "url" in value) {
    const url = (value as { url?: unknown }).url;
    if (typeof url === "string" && url.trim()) return url;
  }
  return null;
}

function MoreSection({
  title,
  viewAllHref,
  children
}: {
  title: string;
  viewAllHref: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 border-t border-border/60 pt-8">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <Link href={viewAllHref} className="text-sm font-semibold text-accent hover:underline">
          View all
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}

export async function MoreCodes({ excludeSlug }: { excludeSlug: string }) {
  const games = await listCodePagesWithActiveCounts();
  const items = games
    .filter((g) => g.slug !== excludeSlug)
    .sort((a, b) => time(b.content_updated_at ?? b.updated_at) - time(a.content_updated_at ?? a.updated_at))
    .slice(0, 8);
  if (!items.length) return null;
  return (
    <MoreSection title="More Roblox codes" viewAllHref="/codes">
      {items.map((game) => (
        <GameCard key={game.id} game={game} titleAs="p" articleUpdatedAt={game.content_updated_at ?? game.updated_at} />
      ))}
    </MoreSection>
  );
}

export async function MoreArticles({ excludeSlug }: { excludeSlug: string }) {
  const articles = await listPublishedArticles(24);
  const items = articles
    .filter((a) => a.slug !== excludeSlug)
    .sort((a, b) => time(b.updated_at) - time(a.updated_at))
    .slice(0, 8);
  if (!items.length) return null;
  return (
    <MoreSection title="More Roblox articles" viewAllHref="/articles">
      {items.map((article) => (
        <ArticleCard key={article.id} article={article} />
      ))}
    </MoreSection>
  );
}

export async function MoreTools({ excludeCode }: { excludeCode: string }) {
  const tools = await listPublishedTools();
  const items = tools
    .filter((t) => t.code !== excludeCode)
    .sort((a, b) => time(resolveModifiedAt(b)) - time(resolveModifiedAt(a)))
    .slice(0, 8);
  if (!items.length) return null;
  return (
    <MoreSection title="More Roblox tools" viewAllHref="/tools">
      {items.map((tool) => (
        <ToolCard key={tool.id ?? tool.code} tool={tool} />
      ))}
    </MoreSection>
  );
}

export async function MoreQuizzes({ excludeCode }: { excludeCode: string }) {
  const quizzes = await listPublishedQuizzes();
  const items = quizzes
    .filter((q) => q.code !== excludeCode)
    .sort((a, b) => time(b.content_updated_at ?? b.updated_at) - time(a.content_updated_at ?? a.updated_at))
    .slice(0, 8);
  if (!items.length) return null;
  return (
    <MoreSection title="More Roblox quizzes" viewAllHref="/quizzes">
      {items.map((quiz) => (
        <QuizCard
          key={quiz.code}
          code={quiz.code}
          title={quiz.title}
          summary=""
          universeName={quiz.universe?.display_name ?? quiz.universe?.name ?? null}
          coverImage={pickThumbnail(quiz.universe?.thumbnail_urls) ?? quiz.universe?.icon_url ?? null}
          updatedAt={quiz.content_updated_at ?? quiz.updated_at ?? null}
        />
      ))}
    </MoreSection>
  );
}

export async function MoreEvents({ excludeSlug }: { excludeSlug: string }) {
  const { cards } = await buildEventsCards(12);
  const items = cards.filter((c) => c.slug !== excludeSlug).slice(0, 8);
  if (!items.length) return null;
  return (
    <MoreSection title="More Roblox events" viewAllHref="/events">
      {items.map(({ id, ...card }) => (
        <EventsPageCard key={id} {...card} />
      ))}
    </MoreSection>
  );
}

export async function MorePuzzles({ excludeSlug }: { excludeSlug: string }) {
  const pages = await listPublishedPuzzlePages();
  const items = pages
    .filter((p) => p.slug !== excludeSlug)
    .sort((a, b) => time(b.content_updated_at ?? b.updated_at) - time(a.content_updated_at ?? a.updated_at))
    .slice(0, 8);
  if (!items.length) return null;
  return (
    <MoreSection title="More Roblox puzzles" viewAllHref="/puzzles">
      {items.map((puzzle) => (
        <Link
          key={puzzle.id ?? puzzle.slug}
          href={`/puzzles/${puzzle.slug}`}
          className="group flex items-center gap-3 rounded-lg border border-border/70 bg-card p-3 transition-colors hover:border-border"
        >
          <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-surface-muted">
            <CardImage src={puzzle.icon_url ?? null} alt={puzzle.title} />
          </span>
          <span className="min-w-0">
            <span className="block line-clamp-2 text-sm font-semibold text-foreground">{puzzle.title}</span>
            <span className="block text-xs text-muted">Answers &amp; help</span>
          </span>
        </Link>
      ))}
    </MoreSection>
  );
}
