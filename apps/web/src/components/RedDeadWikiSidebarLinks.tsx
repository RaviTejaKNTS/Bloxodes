"use client";

import Link from "next/link";
import { isNavLinkActive, redDeadWikiNavLinks } from "@/lib/site-navigation";
import { cn } from "@/lib/utils";

export function RedDeadWikiSidebarLinks({ pathname, onNavigate }: {
  pathname: string;
  onNavigate?: () => void;
}) {
  if (pathname !== "/red-dead" && !pathname.startsWith("/red-dead/")) return null;

  return (
    <nav className="mt-3 border-t border-sidebar-border/80 pt-2" aria-label="Red Dead game wikis">
      <div className="h-7 px-2.5 text-[11px] font-semibold leading-7 text-sidebar-foreground/45">
        Game wikis
      </div>
      <ul className="space-y-0.5">
        {redDeadWikiNavLinks.map((link) => {
          const active = isNavLinkActive(pathname, link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={onNavigate}
                aria-current={pathname === link.href ? "page" : active ? "location" : undefined}
                className={cn(
                  "group flex h-8 min-w-0 items-center gap-2 rounded-md px-2.5 text-[13px] font-medium text-sidebar-foreground/62 outline-none transition-colors hover:bg-sidebar-accent/65 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  active && "bg-sidebar-accent/85 text-sidebar-foreground"
                )}
              >
                <span aria-hidden className={cn("h-4 w-0.5 shrink-0 rounded-full bg-transparent", active && "bg-sidebar-primary")} />
                <span className="truncate">{link.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
