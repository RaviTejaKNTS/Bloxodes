"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { recentPageKind, recordRecentPage } from "@/lib/recent-pages-client";

/** Remembers the content pages a visitor opens (in this browser only) for the homepage "pick up" row. */
export function RecentVisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const href = pathname?.replace(/\/page\/\d+$/, "") ?? "";
    const kind = recentPageKind(href);
    if (!kind) return undefined;
    const timer = window.setTimeout(() => {
      const title = document.querySelector("main h1")?.textContent?.replace(/\s+/g, " ").trim();
      if (!title) return;
      const image = document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? null;
      recordRecentPage({ href, kind, title: title.slice(0, 120), image, at: Date.now() });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
