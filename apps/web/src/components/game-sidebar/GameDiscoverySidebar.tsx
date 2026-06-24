import Link from "next/link";
import { BarChart3, BookOpen } from "lucide-react";
import { getGameSidebarData, type SidebarArticle, type SidebarCatalogLink } from "@/lib/game-sidebar";
import { EventsPageCard } from "@/components/EventsPageCard";
import { ToolCard } from "@/components/ToolCard";
import { CatalogCard } from "@/components/CatalogCard";
import { CardImage } from "@/components/CardImage";
import { QuizSidebarCard } from "@/components/game-sidebar/QuizSidebarCard";
import { ChecklistSidebarCard } from "@/components/game-sidebar/ChecklistSidebarCard";

type CurrentType = "codes" | "articles" | "events" | "quiz";

type GameDiscoverySidebarProps = {
  universeId: number | null | undefined;
  universeName: string | null;
  currentType: CurrentType;
};

const cardClass = "block rounded-lg border border-border/70 bg-card p-4 transition-colors hover:border-border";

function WikiCard({ slug, title }: { slug: string; title: string }) {
  return (
    <Link href={`/wiki/${slug}`} className={`${cardClass} flex items-center gap-3`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
        <BookOpen className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block line-clamp-1 text-sm font-semibold text-foreground">{title}</span>
        <span className="block text-xs text-muted">Guide, controls &amp; tips</span>
      </span>
    </Link>
  );
}

function CatalogList({ catalogs }: { catalogs: SidebarCatalogLink[] }) {
  return (
    <section>
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/55">Catalogs</p>
      <ul className="space-y-1">
        {catalogs.map((entry) => (
          <li key={entry.href}>
            <Link
              href={entry.href}
              className="block rounded-md px-1 py-1.5 text-sm text-foreground transition-colors hover:text-accent"
            >
              All {typeof entry.count === "number" ? entry.count.toLocaleString("en-US") + " " : ""}
              {entry.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatsCard({ rank, playing, slug }: { rank: number | null; playing: number | null; slug: string | null }) {
  return (
    <Link href={slug ? `/stats/games/${slug}` : "/stats"} className={`${cardClass} flex items-center gap-4`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
        <BarChart3 className="h-5 w-5" aria-hidden />
      </span>
      <span className="flex flex-1 items-center justify-between gap-3">
        {typeof rank === "number" ? (
          <span>
            <span className="block text-[11px] uppercase tracking-[0.14em] text-muted">Global rank</span>
            <span className="block text-base font-semibold text-foreground">#{rank.toLocaleString("en-US")}</span>
          </span>
        ) : null}
        {typeof playing === "number" ? (
          <span className="text-right">
            <span className="block text-[11px] uppercase tracking-[0.14em] text-muted">Playing now</span>
            <span className="inline-flex items-center gap-1.5 text-base font-semibold text-foreground">
              <span className="h-2 w-2 rounded-full bg-green-400" aria-hidden />
              {playing.toLocaleString("en-US")}
            </span>
          </span>
        ) : null}
      </span>
    </Link>
  );
}

function CodesCard({
  slug,
  name,
  activeCount,
  coverImage
}: {
  slug: string;
  name: string;
  activeCount: number;
  coverImage: string | null;
}) {
  return (
    <Link href={`/codes/${slug}`} className={`${cardClass} flex items-center gap-3`}>
      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-surface-muted">
        <CardImage src={coverImage} alt={name} />
      </span>
      <span className="min-w-0">
        <span className="block line-clamp-1 text-sm font-semibold text-foreground">{name} Codes</span>
        <span className="inline-flex items-center gap-1.5 text-xs text-foreground/70">
          <span className="h-2 w-2 rounded-full bg-green-400" aria-hidden />
          {activeCount} active {activeCount === 1 ? "code" : "codes"}
        </span>
      </span>
    </Link>
  );
}

function ArticlesCard({ articles, heading = "Articles" }: { articles: SidebarArticle[]; heading?: string }) {
  const [lead, ...rest] = articles;
  if (!lead) return null;
  return (
    <section className="overflow-hidden rounded-lg border border-border/70 bg-card">
      <Link href={`/articles/${lead.slug}`} className="group block">
        <span className="relative block aspect-[16/9] overflow-hidden bg-surface-muted">
          <CardImage src={lead.coverImage} alt={lead.title} className="transition duration-500 group-hover:scale-[1.03]" />
        </span>
      </Link>
      <div className="space-y-2 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/55">{heading}</p>
        <ul className="space-y-2">
          {[lead, ...rest].map((article) => (
            <li key={article.slug}>
              <Link
                href={`/articles/${article.slug}`}
                className="block line-clamp-2 text-sm font-medium text-foreground transition-colors hover:text-accent"
              >
                {article.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export async function GameDiscoverySidebar({ universeId, universeName, currentType }: GameDiscoverySidebarProps) {
  if (typeof universeId !== "number") return null;

  const data = await getGameSidebarData(universeId);

  const sections: React.ReactNode[] = [];

  if (data.wiki) sections.push(<WikiCard key="wiki" slug={data.wiki.slug} title={data.wiki.title} />);
  if (data.catalogs.length) sections.push(<CatalogList key="catalogs" catalogs={data.catalogs} />);
  if (data.stats) sections.push(<StatsCard key="stats" rank={data.stats.rank} playing={data.stats.playing} slug={data.stats.slug} />);

  if (data.event && currentType !== "events") {
    sections.push(
      <EventsPageCard
        key="event"
        slug={data.event.slug}
        title={universeName ?? "Roblox"}
        summary=""
        universeName={universeName}
        coverImage={data.event.coverImage}
        fallbackIcon={null}
        eventName={data.event.eventName}
        eventTimeLabel={null}
        eventStartUtc={data.event.startUtc}
        eventEndUtc={data.event.endUtc}
        status={data.event.status}
        counts={{ upcoming: 0, current: 0, past: 0 }}
        updatedLabel={null}
      />
    );
  }

  if (data.codes && currentType !== "codes") {
    sections.push(
      <CodesCard key="codes" slug={data.codes.slug} name={data.codes.name} activeCount={data.codes.activeCount} coverImage={data.codes.coverImage} />
    );
  }

  if (data.checklist) {
    sections.push(
      <ChecklistSidebarCard key="checklist" slug={data.checklist.slug} title={data.checklist.title} itemsCount={data.checklist.itemsCount} />
    );
  }

  if (data.quiz && currentType !== "quiz") {
    sections.push(
      <QuizSidebarCard key="quiz" code={data.quiz.code} gameName={universeName ?? "Roblox"} question={data.quiz.firstQuestion} />
    );
  }

  if (data.tools.length) {
    sections.push(
      <section key="tools" className="space-y-3">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/55">Tools</p>
        <div className="space-y-3">
          {data.tools.map((tool) => (
            <ToolCard key={tool.id ?? tool.code} tool={tool} />
          ))}
        </div>
      </section>
    );
  }

  if (data.articles.length && currentType !== "articles") {
    sections.push(<ArticlesCard key="articles" articles={data.articles} />);
  }

  if (data.fallback) {
    if (data.fallback.articles.length) {
      sections.push(<ArticlesCard key="fallback-articles" articles={data.fallback.articles} heading="From the blog" />);
    }
    for (const catalog of data.fallback.catalogs) {
      sections.push(
        <CatalogCard key={`fallback-${catalog.href}`} href={catalog.href} title={catalog.title} count={catalog.count} iconKey={catalog.iconKey} tone={catalog.tone} />
      );
    }
  }

  if (!sections.length) return null;

  return <div className="space-y-4">{sections}</div>;
}
