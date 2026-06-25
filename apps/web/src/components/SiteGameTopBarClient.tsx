"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AccountSheetButton } from "@/components/AccountSheetButton";
import { SiteTopNav } from "@/components/SiteTopNav";
import type { CatalogTopNavContext, GameTopNavContext } from "@/lib/game-top-nav-types";
import type { SidebarAccount } from "@/lib/site-navigation";
import { cn } from "@/lib/utils";

type SiteGameTopBarClientProps = {
  account: SidebarAccount;
  initialGameNav?: GameTopNavContext | null;
  initialCatalogNav?: CatalogTopNavContext | null;
  initialPathname?: string;
};

function normalizePathname(value: string | null | undefined): string {
  return value?.trim() || "/";
}

export function SiteGameTopBarClient({
  account,
  initialGameNav = null,
  initialCatalogNav = null,
  initialPathname = ""
}: SiteGameTopBarClientProps) {
  const pathname = normalizePathname(usePathname());
  const [gameNav, setGameNav] = useState<GameTopNavContext | null>(() =>
    pathname === normalizePathname(initialPathname) ? initialGameNav : null
  );
  const [catalogNav, setCatalogNav] = useState<CatalogTopNavContext | null>(() =>
    pathname === normalizePathname(initialPathname) ? initialCatalogNav : null
  );

  useEffect(() => {
    const normalizedInitialPathname = normalizePathname(initialPathname);
    if (pathname === normalizedInitialPathname) {
      setGameNav(initialGameNav);
      setCatalogNav(initialCatalogNav);
      return;
    }

    let cancelled = false;
    setGameNav(null);
    setCatalogNav(null);

    async function loadGameNav() {
      try {
        const response = await fetch(`/api/game-top-nav?path=${encodeURIComponent(pathname)}`);
        if (cancelled) return;
        if (!response.ok) return;
        const payload = (await response.json()) as {
          gameNav?: GameTopNavContext | null;
          catalogNav?: CatalogTopNavContext | null;
        };
        if (cancelled) return;
        setGameNav(payload.gameNav ?? null);
        setCatalogNav(payload.catalogNav ?? null);
      } catch (error) {
        if (!cancelled) {
          setGameNav(null);
          setCatalogNav(null);
        }
      }
    }

    void loadGameNav();
    return () => {
      cancelled = true;
    };
  }, [initialCatalogNav, initialGameNav, initialPathname, pathname]);

  const hasTopNav = Boolean(gameNav || catalogNav);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur",
        !hasTopNav ? "hidden xl:block" : ""
      )}
    >
      <div className="container flex min-h-14 items-center gap-3 py-2">
        <SiteTopNav gameNav={gameNav} catalogNav={catalogNav} />
        <AccountSheetButton account={account} className="ml-auto hidden shrink-0 xl:inline-flex" />
      </div>
    </header>
  );
}
