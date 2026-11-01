"use client";
import { useGameMenus } from "@/lib/game-menu-store";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";
import { AccountSheetButton } from "@/components/AccountSheetButton";
import { GlobalSearchOverlay } from "@/components/GlobalSearchOverlay";
import { SiteLogo } from "@/components/SiteLogo";
import { SiteMoreDrawer } from "@/components/SiteMoreDrawer";
import { isNavLinkActive, siteNavLinksForPath, type SidebarAccount } from "@/lib/site-navigation";

type SiteHeaderProps = {
  account: SidebarAccount;
  linkPaths?: Record<string, string>;
};

export const SITE_MORE_DRAWER_ID = "site-more-drawer";

const iconButtonClass =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * The sticky site header. Section links sit on one line that wraps out of view when the window is
 * too narrow, so every link stays in the server HTML and the More drawer lists them all.
 */
export function SiteHeader({ account, linkPaths = {} }: SiteHeaderProps) {
  const pathname = usePathname() ?? "/";
  const gameMenus = useGameMenus(pathname);
  const links = siteNavLinksForPath(gameMenus[0]?.href ?? pathname, linkPaths, gameMenus);
  const listRef = useRef<HTMLUListElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const closeMore = useCallback(() => setMoreOpen(false), [setMoreOpen]);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // CSS clips links that wrap to a second line. Once hydrated, hide them from focus and screen
  // readers too; the More drawer still lists them.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const update = () => {
      const items = Array.from(list.children) as HTMLElement[];
      const firstTop = items[0]?.offsetTop ?? 0;
      for (const item of items) item.toggleAttribute("data-overflow", item.offsetTop > firstTop);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(list);
    return () => observer.disconnect();
  }, [links]);

  return (
    <>
      <header className="site-header sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="site-container flex h-14 items-center gap-2 md:gap-3">
          <SiteLogo className="h-8" />
          <nav aria-label="Primary" className="hidden min-w-0 flex-1 md:block">
            <ul ref={listRef} className="site-header-links flex h-14 flex-wrap items-center overflow-hidden px-1">
              {links.map((link) => {
                const active = isNavLinkActive(pathname, link.href);
                return (
                  <li key={link.href} className="flex h-14 shrink-0 items-center data-[overflow]:invisible">
                    <Link
                      href={link.href}
                      data-site-nav-link
                      data-active={active ? "true" : "false"}
                      aria-current={active ? "page" : undefined}
                      className="inline-flex h-9 items-center rounded-lg px-2.5 text-[13px] font-semibold text-foreground/70 transition-colors hover:bg-sidebar-accent/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:bg-sidebar-accent/85 data-[active=true]:text-foreground lg:px-3"
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button
              type="button"
              data-search-trigger
              aria-label="Search"
              aria-haspopup="dialog"
              aria-keyshortcuts="Control+K Meta+K"
              title="Search (Ctrl+K)"
              className={iconButtonClass}
            >
              <Search aria-hidden className="h-[18px] w-[18px]" />
            </button>
            <button
              ref={moreButtonRef}
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-label="More"
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              aria-controls={SITE_MORE_DRAWER_ID}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-2 text-[13px] font-semibold text-foreground/70 transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-2.5"
            >
              <Menu aria-hidden className="h-[18px] w-[18px]" />
              <span className="hidden sm:inline">More</span>
            </button>
            <AccountSheetButton account={account} />
          </div>
        </div>
      </header>
      <SiteMoreDrawer linkPaths={linkPaths}
        id={SITE_MORE_DRAWER_ID}
        open={moreOpen}
        onClose={closeMore}
        pathname={pathname}
        returnFocusRef={moreButtonRef}
      />
      <GlobalSearchOverlay linkPaths={linkPaths} gameMenus={gameMenus} />
    </>
  );
}
