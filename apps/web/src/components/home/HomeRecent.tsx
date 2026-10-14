"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import {
  BarChart3,
  BookOpen,
  Calculator,
  CalendarDays,
  HelpCircle,
  History,
  LayoutGrid,
  ListChecks,
  Map as MapIcon,
  Newspaper,
  Puzzle,
  Ticket,
  type LucideIcon
} from "lucide-react";
import { CardImage } from "@/components/CardImage";
import { readLocalChecklistProgress } from "@/lib/checklist-progress-client";
import { clearRecentPages, readRecentPages, type RecentPage, type RecentPageKind } from "@/lib/recent-pages-client";
import { cn } from "@/lib/utils";

const KIND_LABELS: Record<RecentPageKind, [string, LucideIcon]> = {
  codes: ["Codes", Ticket],
  checklist: ["Checklist", ListChecks],
  quiz: ["Quiz", HelpCircle],
  tool: ["Tool", Calculator],
  wiki: ["Wiki", BookOpen],
  guide: ["Guide", Newspaper],
  event: ["Event", CalendarDays],
  catalog: ["Catalog", LayoutGrid],
  stats: ["Stats", BarChart3],
  puzzle: ["Puzzle", Puzzle],
  map: ["Map", MapIcon]
};

function checklistPercent(page: RecentPage, totals: Record<string, number>): number | null {
  if (page.kind !== "checklist") return null;
  const slug = page.href.split("/").pop() ?? "";
  const total = totals[slug];
  if (!total) return null;
  const done = Math.min(readLocalChecklistProgress(slug).length, total);
  return done ? Math.round((done / total) * 100) : null;
}

/** D2: the last pages this visitor opened. Renders nothing for first-time visitors. */
export function HomeRecent({ checklistTotals }: { checklistTotals: Record<string, number> }) {
  const [pages, setPages] = useState<RecentPage[]>([]);

  useEffect(() => {
    setPages(readRecentPages().slice(0, 4));
  }, []);

  if (!pages.length) return null;

  return (
    <section aria-labelledby="home-recent-heading">
      <div className="mb-3 flex items-center gap-2">
        <History className="h-4 w-4 text-muted" aria-hidden />
        <h2 id="home-recent-heading" className="mb-0 text-base font-semibold text-foreground">
          Pick up where you left off
        </h2>
        <button
          type="button"
          onClick={() => {
            clearRecentPages();
            setPages([]);
          }}
          className="ml-auto text-sm text-muted hover:text-foreground"
        >
          Clear
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {pages.map((page, index) => {
          const [label, Icon] = KIND_LABELS[page.kind] ?? KIND_LABELS.wiki;
          const percent = checklistPercent(page, checklistTotals);
          return (
            <Link
              key={page.href}
              href={page.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg border border-border/70 bg-card p-3 transition-colors hover:border-accent/60",
                index > 1 && "hidden sm:flex"
              )}
            >
              <span className="relative block h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-surface-muted">
                <CardImage src={page.image} alt="" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-accent">
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {label}
                </span>
                <span className="block truncate text-sm font-semibold text-foreground group-hover:text-accent">{page.title}</span>
                {percent !== null ? (
                  <span className="mt-1 flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                      <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
                    </span>
                    <span className="text-xs text-muted">{percent}%</span>
                  </span>
                ) : (
                  <span className="block text-xs text-muted">Opened {formatDistanceToNowStrict(page.at)} ago</span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
