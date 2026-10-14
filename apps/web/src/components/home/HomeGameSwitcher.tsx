"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { BookOpen, CalendarDays, ChevronRight, HelpCircle, ListChecks, Calculator, Ticket, type LucideIcon } from "lucide-react";
import { CardImage } from "@/components/CardImage";
import { CopyCodeButton } from "@/components/CopyCodeButton";
import { formatCompactNumber } from "@/lib/stats-format";
import { cn } from "@/lib/utils";
import type { HomeGamePanel } from "@/lib/home-page-data";

const STATUS_LABEL = { current: "Live now", upcoming: "Starting soon", past: "Ended" } as const;

function PanelRow({ href, icon: Icon, children }: { href: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="group flex items-center gap-3 py-2.5 text-[0.95rem] text-foreground">
        <Icon className="h-4 w-4 shrink-0 text-muted group-hover:text-accent" aria-hidden />
        <span className="flex min-w-0 flex-1 items-center gap-2 group-hover:text-accent">{children}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      </Link>
    </li>
  );
}

function GamePanel({ game }: { game: HomeGamePanel }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/70 bg-card lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Link href={game.wiki?.href ?? game.codes?.href ?? "/wiki"} className="relative block aspect-video bg-surface-muted lg:aspect-auto" tabIndex={-1}>
        <span className="absolute inset-0">
          <CardImage src={game.cover} alt={game.name} />
        </span>
      </Link>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="mb-0 text-2xl font-bold tracking-tight text-foreground">{game.name}</h3>
          {typeof game.playing === "number" ? (
            <p className="text-sm text-muted">
              <b className="font-semibold text-foreground">{formatCompactNumber(game.playing)}</b> playing
              {typeof game.rating === "number" ? ` · ${game.rating.toFixed(0)}% rating` : null}
            </p>
          ) : null}
        </div>
        {game.codes ? (
          <div className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-accent">
                <Ticket className="h-3.5 w-3.5" aria-hidden />
                {game.codes.activeCount} active {game.codes.activeCount === 1 ? "code" : "codes"}
              </p>
              <Link href={game.codes.href} className="text-sm font-semibold text-accent hover:underline">
                All codes
              </Link>
            </div>
            {game.codes.latest.length ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {game.codes.latest.map((code) => (
                  <CopyCodeButton
                    key={code}
                    code={code}
                    variant="bar"
                    label={`Copy ${game.name} code ${code}`}
                    analytics={{ event: "copy_code", params: { code, source: "home_game_switcher" } }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <ul className="mt-3 divide-y divide-border/60">
          {game.wiki ? (
            <PanelRow href={game.wiki.href} icon={BookOpen}>
              <span className="truncate">{game.wiki.label}</span>
            </PanelRow>
          ) : null}
          {game.checklist ? (
            <PanelRow href={game.checklist.href} icon={ListChecks}>
              <span className="truncate">{game.checklist.tasks ? `${game.checklist.tasks}-task 100% checklist` : game.checklist.label}</span>
            </PanelRow>
          ) : null}
          {game.event ? (
            <PanelRow href={game.event.href} icon={CalendarDays}>
              <span className="truncate">{game.event.label}</span>
              <span
                className={cn(
                  "shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold",
                  game.event.status === "current" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                  game.event.status === "upcoming" && "bg-accent/10 text-accent",
                  game.event.status === "past" && "bg-surface-muted text-muted"
                )}
              >
                {game.event.timeLabel ?? STATUS_LABEL[game.event.status]}
              </span>
            </PanelRow>
          ) : null}
          {game.quiz ? (
            <PanelRow href={game.quiz.href} icon={HelpCircle}>
              <span className="truncate">{game.quiz.label}</span>
            </PanelRow>
          ) : null}
          {game.tool ? (
            <PanelRow href={game.tool.href} icon={Calculator}>
              <span className="truncate">{game.tool.count > 1 ? `${game.tool.count} ${game.name} tools` : game.tool.label}</span>
            </PanelRow>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

/** B2: tabs for the most played games we cover. Every panel is in the HTML; only the picked one shows. */
export function HomeGameSwitcher({ games, className }: { games: HomeGamePanel[]; className?: string }) {
  const [active, setActive] = useState(0);
  const baseId = useId();
  if (!games.length) return null;
  return (
    <section className={className}>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="mb-0 text-xl font-semibold leading-tight text-foreground">Pick your game</h2>
        <Link href="/wiki" className="shrink-0 text-sm font-semibold text-accent hover:underline">
          All games
        </Link>
      </div>
      <div role="tablist" aria-label="Games" className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1 pb-1">
        {games.map((game, index) => {
          const selected = index === active;
          return (
            <button
              key={game.universeId}
              type="button"
              role="tab"
              id={`${baseId}-tab-${index}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${index}`}
              onClick={() => setActive(index)}
              className={cn(
                "flex w-[5.75rem] shrink-0 flex-col items-center gap-1.5 rounded-lg p-1.5 text-center text-xs font-medium leading-tight transition-colors",
                selected ? "text-foreground" : "text-muted hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "relative block h-14 w-14 overflow-hidden rounded-xl border-2 bg-surface-muted",
                  selected ? "border-accent" : "border-transparent"
                )}
              >
                <CardImage src={game.icon} alt="" />
              </span>
              <span className="line-clamp-2">{game.name}</span>
            </button>
          );
        })}
      </div>
      {games.map((game, index) => (
        <div
          key={game.universeId}
          role="tabpanel"
          id={`${baseId}-panel-${index}`}
          aria-labelledby={`${baseId}-tab-${index}`}
          hidden={index !== active}
        >
          <GamePanel game={game} />
        </div>
      ))}
    </section>
  );
}
