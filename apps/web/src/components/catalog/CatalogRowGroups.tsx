"use client";

import { Children, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Minimum stream width for each extra card column. Mirrors the `catalog-stream` container queries
 * in ads-catalog.css. Each card stays close to its narrowest width in the old full-width layout;
 * promo and large cards (long codes and IDs) never go narrower than it.
 */
const CATALOG_CARD_BREAKPOINTS = {
  small: [460, 740, 930],
  promo: [460, 740, 1000],
  medium: [560, 850],
  large: [560, 1000]
} as const;

export type CatalogCardSize = keyof typeof CATALOG_CARD_BREAKPOINTS;

export function catalogCardColumns(width: number, size: CatalogCardSize) {
  return 1 + CATALOG_CARD_BREAKPOINTS[size].filter(min => width >= min).length;
}

/** Keep insertion boundaries mounted through filtering and responsive regrouping. */
export function CatalogRowGroups({ children, slots, className = "", size = "medium" }: {
  children: ReactNode;
  slots?: number;
  className?: string;
  size?: CatalogCardSize;
}) {
  const cards = Children.toArray(children);
  const count = useRef(slots ?? cards.length).current;
  const firstGroup = useRef<HTMLDivElement>(null);
  // Match the 1440px desktop layout before hydration: a main column about 1,024px wide.
  const [columns, setColumns] = useState(() => catalogCardColumns(1024, size));
  useEffect(() => {
    const stream = firstGroup.current?.closest(".catalog-stream");
    if (!stream) return;
    const observer = new ResizeObserver(([entry]) => setColumns(catalogCardColumns(entry.contentRect.width, size)));
    observer.observe(stream);
    return () => observer.disconnect();
  }, [size]);
  return Array.from({ length: count }, (_, index) => {
    const group = cards.slice(index * columns, (index + 1) * columns);
    return (
      <div ref={index === 0 ? firstGroup : undefined} key={index} data-catalog-row-group className={`catalog-row-group ${className}`} hidden={!group.length}>
        <div role="list" className={`catalog-section-grid catalog-section-grid--${size}`}>{group}</div>
      </div>
    );
  });
}
