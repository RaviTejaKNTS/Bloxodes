"use client";
import { useGameMenus } from "@/lib/game-menu-store";

import { useEffect, useRef, type RefObject } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { SiteFeedbackButton } from "@/components/SiteFeedbackButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { isNavLinkActive, siteNavGroupsForPath } from "@/lib/site-navigation";
import { cn } from "@/lib/utils";

type SiteMoreDrawerProps = {
  linkPaths?: Record<string, string>;
  id: string;
  open: boolean;
  onClose: () => void;
  pathname: string;
  returnFocusRef: RefObject<HTMLElement | null>;
};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Keep Tab inside `container` while focus is in it. Focus in a nested dialog is left alone. */
export function trapTabKey(event: KeyboardEvent, container: HTMLElement | null) {
  if (!container || !container.contains(document.activeElement)) return;
  // Skip elements taken out of the tab order (search results use tabindex="-1") and hidden ones.
  const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => element.tabIndex >= 0 && (element.getClientRects().length > 0 || element === document.activeElement)
  );
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Right-side drawer with every section link, feedback and the theme switch. It renders in the
 * server HTML (hidden until opened) so crawlers see every section link on every page.
 */
export function SiteMoreDrawer({ linkPaths = {}, id, open, onClose, pathname, returnFocusRef }: SiteMoreDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const gameMenus = useGameMenus(pathname);
  const groups = siteNavGroupsForPath(gameMenus[0]?.href ?? pathname, linkPaths, gameMenus);

  useEffect(() => {
    if (!open) return;
    const returnTo = returnFocusRef.current;
    closeRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      // A dialog opened on top (the feedback form or search) handles its own keys.
      if (event.defaultPrevented) return;
      const focused = document.activeElement;
      if (focused?.closest('[role="dialog"]') && !panelRef.current?.contains(focused)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "Tab") {
        trapTabKey(event, panelRef.current);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      returnTo?.focus();
    };
  }, [open, onClose, returnFocusRef]);

  return (
    <div id={id} hidden={!open}>
      <div aria-hidden className="fixed inset-0 z-[100000] bg-black/80" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="More"
        className="fixed inset-y-0 right-0 z-[100001] flex h-full w-[min(24rem,_92vw)] flex-col overflow-y-auto border-l bg-background p-6 shadow-lg"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <X aria-hidden className="h-4 w-4" />
        </button>
        {open ? <h2 className="mb-4 text-lg font-semibold text-foreground">More</h2> : null}

        <div className="space-y-5">
          {groups.map((group) => (
            <nav key={group.label} aria-label={group.label}>
              <div className="h-6 px-2.5 text-[11px] font-medium uppercase leading-6 tracking-[0.12em] text-muted">
                {group.label}
              </div>
              <ul className="space-y-1">
                {group.links.map((link) => {
                  const active = isNavLinkActive(pathname, link.href);
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={onClose}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-semibold text-foreground/70 transition-colors hover:bg-sidebar-accent/70 hover:text-foreground",
                          active ? "bg-sidebar-accent/85 text-foreground" : ""
                        )}
                      >
                        <link.icon aria-hidden className="h-[18px] w-[18px]" />
                        <span>{link.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          ))}
        </div>

        <div className="my-4 h-px shrink-0 bg-border" />

        <div className="space-y-1">
          <SiteFeedbackButton
            className="flex h-9 w-full justify-start rounded-lg px-2.5 text-[13px] font-semibold text-foreground/70 hover:bg-sidebar-accent hover:text-foreground"
            labelClassName="inline"
          />
          <div className="flex h-9 items-center justify-between gap-2 rounded-lg px-2.5">
            <span className="text-[13px] font-semibold text-foreground/70">Theme</span>
            <ThemeToggle className="h-[26px] w-[26px] border-border bg-transparent shadow-none hover:translate-y-0 hover:bg-sidebar-accent [&_svg]:h-3.5 [&_svg]:w-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
}
