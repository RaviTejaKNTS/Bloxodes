"use client";

import { useEffect } from "react";

/** Keep the same columns in view across consecutive ranking tables. */
export function StatsTableScrollSync() {
  useEffect(() => {
    const stream = document.getElementById("article-body");
    if (!stream) return;
    const onScroll = (event: Event) => {
      const source = event.target;
      if (!(source instanceof HTMLElement) || !source.querySelector(":scope > table")) return;
      for (const table of stream.querySelectorAll(".stats-ranking-chunk table")) {
        const viewport = table.parentElement;
        if (viewport && viewport !== source && viewport.scrollLeft !== source.scrollLeft) {
          viewport.scrollLeft = source.scrollLeft;
        }
      }
    };
    stream.addEventListener("scroll", onScroll, true);
    return () => stream.removeEventListener("scroll", onScroll, true);
  }, []);
  return null;
}
