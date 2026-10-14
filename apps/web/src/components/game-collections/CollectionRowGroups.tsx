"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChunkedTableScrollSync } from "@/components/ChunkedTableScrollSync";
import "@/styles/ads-tables.css";

/** List view rows per group: about one desktop screen of table rows, and even so row striping continues across groups. */
export const COLLECTION_LIST_GROUP_SIZE = 10;

/**
 * Card columns at a stream width. Mirrors the `collections` container queries in
 * ads-collections.css. Wide cards (many fields) top out at three per row.
 */
export function collectionCardColumns(width: number, wide: boolean) {
  if (wide) return width < 520 ? 1 : width < 850 ? 2 : 3;
  return width < 460 ? 1 : width < 740 ? 2 : width < 920 ? 3 : 4;
}

/**
 * Keep every insertion boundary mounted when the view, filter or column count changes. In cards
 * view each group is exactly one row at the current column count, so an ad always lands between
 * complete rows.
 */
export function CollectionRowGroups<T extends { id: string }>({
  items,
  activeView,
  renderCard,
  renderList,
  slots = items.length,
  wide = false
}: {
  items: T[];
  activeView: "cards" | "list";
  renderCard: (item: T) => ReactNode;
  renderList: (items: T[]) => ReactNode;
  slots?: number;
  wide?: boolean;
}) {
  const firstGroup = useRef<HTMLDivElement>(null);
  const listId = useId();
  // Match the 1440px desktop layout before hydration: a main column about 1,024px wide.
  const [columns, setColumns] = useState(() => collectionCardColumns(1024, wide));
  useEffect(() => {
    const stream = firstGroup.current?.closest(".collections-stream");
    if (!stream) return;
    const observer = new ResizeObserver(([entry]) => setColumns(collectionCardColumns(entry.contentRect.width, wide)));
    observer.observe(stream);
    return () => observer.disconnect();
  }, [wide]);
  const list = activeView === "list";
  const size = list ? COLLECTION_LIST_GROUP_SIZE : columns;
  const lastGroup = Math.ceil(items.length / size) - 1;
  return (
    <>
      {Array.from({ length: slots }, (_, index) => {
        const group = items.slice(index * size, (index + 1) * size);
        // List groups are chunks of one table: header shown once, frame closed only at the ends (see ads-collections.css).
        const className = list
          ? `collections-row-group collections-list-chunk ads-tables-chunk${index === 0 ? " ads-tables-chunk-first" : ""}${index === lastGroup ? " ads-tables-chunk-last" : ""}`
          : "collections-row-group";
        return (
          <div ref={index === 0 ? firstGroup : undefined} key={index} data-collections-group={activeView} data-collections-list={list ? listId : undefined} className={className} hidden={!group.length}>
            {activeView === "cards" ? (
              <div className={wide ? "collections-card-grid collections-card-grid--wide" : "collections-card-grid"} role="list">
                {group.map(item => <div key={item.id} role="listitem" data-journey-item className="min-w-0 h-full">{renderCard(item)}</div>)}
              </div>
            ) : group.length ? renderList(group) : null}
          </div>
        );
      })}
      <ChunkedTableScrollSync chunkSelector={`[data-collections-list="${listId}"]`} />
    </>
  );
}
