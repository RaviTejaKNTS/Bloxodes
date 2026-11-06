import Link from "next/link";
import { Calculator, HelpCircle, ListChecks, Map as MapIcon, type LucideIcon } from "lucide-react";
import { CardImage } from "@/components/CardImage";
import { ArticlesCard, CodesCard } from "./GameDiscoverySidebar";
import type { GameDirectoryPage } from "@/lib/game-registry";

function PageRow({ page, label, Icon }: { page: GameDirectoryPage; label: string; Icon: LucideIcon }) {
  return <Link href={page.href} className="flex items-center gap-3 rounded-lg border border-border/70 bg-card p-4 transition-colors hover:border-border">
    <span className={`relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md ${page.image ? "bg-surface-muted" : "bg-accent/10 text-accent"}`}>
      {page.image ? <CardImage src={page.image} alt="" /> : <Icon className="h-5 w-5" aria-hidden />}
    </span>
    <span className="min-w-0">
      <span className="block line-clamp-2 text-sm font-semibold text-foreground">{page.title}</span>
      <span className="block text-xs text-muted">{label}</span>
    </span>
  </Link>;
}

export function GameCollectionOtherPages({ pages, gameName }: { pages: GameDirectoryPage[]; gameName: string }) {
  const first = (kind: string) => pages.find(page => page.kind === `game_${kind}_pages_view`);
  const codes = first("code");
  const map = first("map");
  const tool = first("tool");
  const articles = pages.filter(page => page.kind === "game_article_pages_view").slice(0, 2);
  const quiz = first("quiz");
  const checklist = first("checklist");
  if (!codes && !map && !tool && !articles.length && !quiz && !checklist) return null;
  return <div className="space-y-4">
    {codes ? <CodesCard href={codes.href} slug="" name={gameName} activeCount={null} coverImage={codes.image} /> : null}
    {map ? <PageRow page={map} label="Interactive map" Icon={MapIcon} /> : null}
    {tool ? <PageRow page={tool} label="Tool" Icon={Calculator} /> : null}
    {articles.length ? <ArticlesCard withoutCover articles={articles.map(article => ({ href: article.href, slug: article.href, title: article.title, coverImage: article.image }))} /> : null}
    {quiz ? <PageRow page={quiz} label="Quiz" Icon={HelpCircle} /> : null}
    {checklist ? <Link href={checklist.href} className="block rounded-lg border border-border/70 bg-card p-4 transition-colors hover:border-border">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/55">Checklist</p>
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><ListChecks className="h-5 w-5 shrink-0 text-accent" aria-hidden />{checklist.title}</p>
    </Link> : null}
  </div>;
}
