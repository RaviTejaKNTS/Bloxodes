"use client";

import { useGameMenus } from "@/lib/game-menu-store";
import { RailLinkList, type RailLink } from "@/components/RailLinkList";

export function GameRelatedToolLinks({ canonicalPath, fallbackLinks }: { canonicalPath: string; fallbackLinks: RailLink[] }) {
  const menu = useGameMenus(canonicalPath)[0];
  const owner = menu?.pages.find(page => page.href === canonicalPath);
  const links = menu
    ? menu.pages.filter(page => page.kind === "tool" && page.gameId === owner?.gameId && page.href !== canonicalPath).map(page => ({ href: page.href, title: page.title }))
    : fallbackLinks;
  return <RailLinkList heading="More tools" links={links.slice(0, 6)} />;
}
