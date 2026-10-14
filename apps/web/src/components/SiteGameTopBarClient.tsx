"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SiteTopNav } from "@/components/SiteTopNav";
import { parseGameTopNavPath } from "@/lib/game-top-nav-path";
import type { CatalogTopNavContext, GameTopNavContext } from "@/lib/game-top-nav-types";

type SiteGameTopBarClientProps = {
  initialGameNav?: GameTopNavContext | null;
  initialCatalogNav?: CatalogTopNavContext | null;
  initialPathname?: string;
};

type TopNavState = {
  pathname: string;
  gameNav: GameTopNavContext | null;
  catalogNav: CatalogTopNavContext | null;
};

function normalizePathname(value: string | null | undefined): string {
  return value?.trim() || "/";
}

/**
 * Secondary bar under the site header for game and catalog pages. It scrolls away with the page.
 */
export function SiteGameTopBarClient({
  initialGameNav = null,
  initialCatalogNav = null,
  initialPathname = ""
}: SiteGameTopBarClientProps) {
  const pathname = normalizePathname(usePathname());
  const [navState, setNavState] = useState<TopNavState | null>(() =>
    pathname === normalizePathname(initialPathname)
      ? { pathname, gameNav: initialGameNav, catalogNav: initialCatalogNav }
      : null
  );
  const currentNav = navState?.pathname === pathname ? navState : null;
  const gameNav = currentNav?.gameNav ?? null;
  const catalogNav = currentNav?.catalogNav ?? null;
  // Reserve the same row before hydration and while a new pathname loads.
  const reserveTopNav = !currentNav && parseGameTopNavPath(pathname) !== null;
  const showTopNav = Boolean(gameNav || catalogNav || reserveTopNav);

  useEffect(() => {
    const normalizedInitialPathname = normalizePathname(initialPathname);
    if (pathname === normalizedInitialPathname) {
      setNavState({ pathname, gameNav: initialGameNav, catalogNav: initialCatalogNav });
      return;
    }

    let cancelled = false;
    async function loadGameNav() {
      try {
        const response = await fetch(`/api/game-top-nav?path=${encodeURIComponent(pathname)}`);
        if (cancelled) return;
        const payload = response.ok
          ? (await response.json()) as { gameNav?: GameTopNavContext | null; catalogNav?: CatalogTopNavContext | null }
          : null;
        if (cancelled) return;
        setNavState({ pathname, gameNav: payload?.gameNav ?? null, catalogNav: payload?.catalogNav ?? null });
      } catch {
        if (!cancelled) {
          setNavState({ pathname, gameNav: null, catalogNav: null });
        }
      }
    }

    void loadGameNav();
    return () => {
      cancelled = true;
    };
  }, [initialCatalogNav, initialGameNav, initialPathname, pathname]);

  if (!showTopNav) return null;

  return (
    <div data-game-bar className="border-b border-border/60 bg-surface/40">
      <div className="site-container flex min-h-11 items-center py-1">
        <SiteTopNav gameNav={gameNav} catalogNav={catalogNav} />
      </div>
    </div>
  );
}
