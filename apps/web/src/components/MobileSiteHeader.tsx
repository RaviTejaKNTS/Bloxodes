"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { AccountSheetButton } from "@/components/AccountSheetButton";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { SidebarSearch } from "@/components/SidebarSearch";
import { SiteFeedbackButton } from "@/components/SiteFeedbackButton";
import { SiteLogo } from "@/components/SiteLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { isNavLinkActive, siteNavLinksForPath, type SidebarAccount } from "@/lib/site-navigation";
import { cn } from "@/lib/utils";

type MobileSiteHeaderProps = {
  account: SidebarAccount;
  initialPathname: string;
};

export function MobileSiteHeader({ account, initialPathname }: MobileSiteHeaderProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? initialPathname;
  const links = siteNavLinksForPath(pathname);
  const closeMenu = () => setOpen(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur xl:hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="h-10 w-10 rounded-md text-foreground hover:bg-transparent hover:text-accent"
          >
            <Menu aria-hidden className="h-5 w-5" />
          </Button>
          <SiteLogo className="h-8" />
          <AccountSheetButton account={account} className="ml-auto h-10 w-10" />
        </div>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-[min(17rem,_90vw)] bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Sidebar</SheetTitle>
            <SheetDescription>Displays the mobile sidebar.</SheetDescription>
          </SheetHeader>

          <div className="flex h-full w-full flex-col">
            <div className="px-3 pb-2 pt-5">
              <div className="flex min-h-11 items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={closeMenu}
                  aria-label="Close menu"
                  className="h-9 w-9 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                >
                  <X aria-hidden className="h-4 w-4" />
                </Button>
                <SiteLogo className="h-10" />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
              <SidebarSearch className="px-1 pb-3" initialPathname={initialPathname} onNavigate={closeMenu} />

              <nav className="px-1" aria-label="Primary">
                <div className="h-6 px-2 text-[11px] font-medium uppercase leading-6 tracking-[0.12em] text-sidebar-foreground/40">
                  Browse
                </div>
                <ul className="space-y-1">
                  {links.map((link) => {
                    const active = isNavLinkActive(pathname, link.href);
                    return (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          onClick={closeMenu}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-semibold text-sidebar-foreground/68 transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                            active ? "bg-sidebar-accent/85 text-sidebar-foreground" : "",
                            "[&>svg]:h-[18px] [&>svg]:w-[18px]"
                          )}
                        >
                          <link.icon aria-hidden className="h-3.5 w-3.5" />
                          <span>{link.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              <div className="mx-3 my-2 h-px bg-sidebar-border" />

              <div className="space-y-1 px-1">
                <SiteFeedbackButton
                  className="flex h-9 w-full justify-start rounded-lg px-2.5 text-[13px] font-semibold text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  labelClassName="inline"
                />
                <div className="flex h-9 items-center justify-between gap-2 rounded-lg px-2.5 hover:bg-sidebar-accent">
                  <span className="text-[13px] font-semibold text-sidebar-foreground/70">Theme</span>
                  <ThemeToggle className="h-[26px] w-[26px] border-sidebar-border bg-transparent shadow-none hover:translate-y-0 hover:bg-sidebar-accent [&_svg]:h-3.5 [&_svg]:w-3.5" />
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
