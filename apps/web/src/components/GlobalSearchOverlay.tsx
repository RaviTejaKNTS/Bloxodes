"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { trapTabKey } from "@/components/SiteMoreDrawer";
import { trackEvent } from "@/lib/analytics";
import { resolveSearchScope } from "@/lib/site-navigation";

const UnifiedSearch = dynamic(() => import("@/components/UnifiedSearch").then((mod) => mod.UnifiedSearch), {
  ssr: false,
  loading: () => (
    <div className="space-y-2 p-3">
      <div className="h-10 animate-pulse rounded-lg bg-sidebar-accent/60" />
      <div className="h-11 animate-pulse rounded-lg bg-sidebar-accent/40" />
    </div>
  )
});

function isOpenShortcut(event: KeyboardEvent) {
  return event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey;
}

/**
 * Centered search popup. Opens from any `[data-search-trigger]` element, the
 * `bloxodes:open-search` window event, or Cmd/Ctrl+K. Search is scoped to the current section.
 */
export function GlobalSearchOverlay({ linkPaths = {} }: { linkPaths?: Record<string, string> }) {
  const pathname = usePathname() ?? "/";
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const isOpenRef = useRef(false);
  isOpenRef.current = isOpen;

  const openOverlay = useCallback(() => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setIsOpen(true);
  }, []);

  const closeOverlay = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleTrigger(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-search-trigger]")) return;
      event.preventDefault();
      openOverlay();
    }
    function handleShortcut(event: KeyboardEvent) {
      if (!isOpenShortcut(event)) return;
      event.preventDefault();
      if (isOpenRef.current) setIsOpen(false);
      else openOverlay();
    }

    document.addEventListener("click", handleTrigger);
    document.addEventListener("keydown", handleShortcut);
    window.addEventListener("bloxodes:open-search", openOverlay);
    return () => {
      document.removeEventListener("click", handleTrigger);
      document.removeEventListener("keydown", handleShortcut);
      window.removeEventListener("bloxodes:open-search", openOverlay);
    };
  }, [openOverlay]);

  useEffect(() => {
    if (!isOpen) return undefined;
    trackEvent("search_open");

    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
      } else if (event.key === "Tab") {
        trapTabKey(event, panelRef.current);
      }
    }
    // Keep focus in the popup if it lands outside (for example on the page behind the backdrop).
    function onFocusIn(event: FocusEvent) {
      const panel = panelRef.current;
      if (panel && !panel.contains(event.target as Node)) {
        panel.querySelector<HTMLElement>("input")?.focus();
      }
    }

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      const target = returnFocus.current;
      returnFocus.current = null;
      if (target?.isConnected) target.focus();
    };
  }, [isOpen]);

  if (!isMounted || !isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100000] flex items-start justify-center bg-black/60 px-3 pt-3 backdrop-blur-[2px] sm:px-4 sm:pt-[12vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeOverlay();
      }}
    >
      <div
        ref={panelRef}
        id="global-search-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="w-full max-w-xl overflow-hidden rounded-xl border border-border/70 bg-background shadow-2xl"
      >
        <UnifiedSearch pageScope={resolveSearchScope(pathname, linkPaths)} autoFocus onNavigate={closeOverlay} onClose={closeOverlay} />
      </div>
    </div>,
    document.body
  );
}
