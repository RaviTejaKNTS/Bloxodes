"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, BarChart3, BookOpen, Calendar, ChevronDown, KeyRound, SquareCheckBig, Wrench } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import type { CatalogTopNavContext, GameTopNavContext, GameTopNavLink } from "@/lib/game-top-nav-types";
import { cn } from "@/lib/utils";

type SiteTopNavProps = {
  className?: string;
  catalogNav?: CatalogTopNavContext | null;
  gameNav?: GameTopNavContext | null;
  onNavigate?: () => void;
};

const gameNavIcons = {
  wiki: BookOpen,
  stats: BarChart3,
  codes: KeyRound,
  events: Calendar,
  checklists: SquareCheckBig,
  quizzes: Award
} satisfies Record<GameTopNavLink["type"], typeof BookOpen>;

const gameNavOrder = {
  wiki: 0,
  stats: 1,
  codes: 2,
  events: 3,
  checklists: 4,
  quizzes: 5
} satisfies Record<GameTopNavLink["type"], number>;

export function SiteTopNav({ className, catalogNav = null, gameNav = null, onNavigate }: SiteTopNavProps) {
  const pathname = usePathname() ?? "";

  if (gameNav) {
    const toolsActive = gameNav.toolsActive || gameNav.tools.some((tool) => pathname === tool.href);
    const orderedLinks = [...gameNav.links].sort((a, b) => gameNavOrder[a.type] - gameNavOrder[b.type]);

    return (
      <nav
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          className
        )}
        aria-label={`${gameNav.gameName} pages`}
      >
        <div className="mr-1 inline-flex h-9 min-w-[9rem] max-w-[16rem] shrink items-center gap-2 rounded-md px-2.5 text-[13px] font-semibold text-foreground sm:min-w-[10rem]">
          <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-md border border-border/70 bg-muted">
            {gameNav.thumbnailUrl ? (
              <Image src={gameNav.thumbnailUrl} alt="" fill sizes="24px" className="object-cover" />
            ) : null}
          </span>
          <span className="min-w-0 truncate">{gameNav.gameName}</span>
        </div>

        {orderedLinks.map((link) => {
          const Icon = gameNavIcons[link.type];
          const active = link.active || pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-2.5 text-[13px] font-semibold text-muted transition-colors hover:bg-sidebar-accent/70 hover:text-foreground sm:px-3",
                active ? "bg-sidebar-accent/55 text-foreground" : ""
              )}
            >
              <Icon aria-hidden className="h-4 w-4" />
              <span>{link.label}</span>
            </Link>
          );
        })}

        {gameNav.tools.length ? (
          <ToolsDropdown gameNav={gameNav} toolsActive={toolsActive} onNavigate={onNavigate} />
        ) : null}
      </nav>
    );
  }

  if (catalogNav) {
    return (
      <nav
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          className
        )}
        aria-label={`${catalogNav.title} catalog`}
      >
        <div className="mr-1 inline-flex h-9 min-w-[9rem] max-w-[16rem] shrink items-center rounded-md px-2.5 text-[13px] font-semibold text-foreground sm:min-w-[10rem]">
          <span className="min-w-0 truncate">{catalogNav.title}</span>
        </div>

        {catalogNav.links.map((link) => {
          const active = link.active || pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 shrink-0 items-center rounded-lg px-2.5 text-[13px] font-semibold text-muted transition-colors hover:bg-sidebar-accent/70 hover:text-foreground sm:px-3",
                active ? "bg-sidebar-accent/55 text-foreground" : ""
              )}
            >
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return null;
}

function ToolsDropdown({
  gameNav,
  toolsActive,
  onNavigate
}: {
  gameNav: GameTopNavContext;
  toolsActive: boolean;
  onNavigate?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-current={toolsActive ? "page" : undefined}
        className={cn(
          "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-2.5 text-[13px] font-semibold text-muted transition-colors hover:bg-sidebar-accent/70 hover:text-foreground sm:px-3",
          toolsActive ? "bg-sidebar-accent/55 text-foreground" : ""
        )}
      >
        <Wrench aria-hidden className="h-4 w-4" />
        <span>Tools</span>
        <ChevronDown aria-hidden className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {gameNav.tools.map((tool) => (
          <DropdownMenuItem key={tool.href} asChild className={cn(tool.active ? "bg-accent text-accent-foreground" : "")}>
            <Link href={tool.href} onClick={onNavigate} aria-current={tool.active ? "page" : undefined}>
              {tool.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
