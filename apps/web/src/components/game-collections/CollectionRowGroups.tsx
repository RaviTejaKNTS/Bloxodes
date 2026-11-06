"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChunkedTableScrollSync } from "@/components/ChunkedTableScrollSync";
import "@/styles/ads-tables.css";
import { collectionRowStyle, type CollectionCardLayout } from "./CollectionCardContent";

/** List view rows per group: about one desktop screen of table rows, and even so row striping continues across groups. */
export const COLLECTION_LIST_GROUP_SIZE = 10;

/**
 * Card columns at a stream width. Mirrors the `collections` container queries in
 * ads-collections.css. Every collection tops out at three cards per row.
 */
export function collectionCardColumns(width: number) {
  return width < 520 ? 1 : width < 850 ? 2 : 3;
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
  getCardLayout,
  slots = items.length
}: {
  items: T[];
  activeView: "cards" | "list";
  renderCard: (item: T, context: { items: T[]; layout?: CollectionCardLayout }) => ReactNode;
  getCardLayout?: (items: T[]) => CollectionCardLayout;
  renderList: (items: T[]) => ReactNode;
  slots?: number;
}) {
  const firstGroup = useRef<HTMLDivElement>(null);
  const listId = useId();
  // Match the 1440px desktop layout before hydration: a main column about 1,024px wide.
  const [columns, setColumns] = useState(() => collectionCardColumns(1024));
  useEffect(() => {
    const stream = firstGroup.current?.closest(".collections-stream");
    if (!stream) return;
    const observer = new ResizeObserver(([entry]) => setColumns(collectionCardColumns(entry.contentRect.width)));
    observer.observe(stream);
    return () => observer.disconnect();
  }, []);
  const list = activeView === "list";
  const size = list ? COLLECTION_LIST_GROUP_SIZE : columns;
  const lastGroup = Math.ceil(items.length / size) - 1;
  return (
    <>
      {Array.from({ length: slots }, (_, index) => {
        const group = items.slice(index * size, (index + 1) * size);
        const layout = !list ? getCardLayout?.(group) : undefined;
        // List groups are chunks of one table: header shown once, frame closed only at the ends (see ads-collections.css).
        const className = list
          ? `collections-row-group collections-list-chunk ads-tables-chunk${index === 0 ? " ads-tables-chunk-first" : ""}${index === lastGroup ? " ads-tables-chunk-last" : ""}`
          : "collections-row-group";
        return (
          <div ref={index === 0 ? firstGroup : undefined} key={index} data-collections-group={activeView} data-collections-list={list ? listId : undefined} className={className} hidden={!group.length}>
            {activeView === "cards" ? (
              <div className={`collections-card-grid${layout && group.length > 1 ? " collections-card-grid--aligned" : ""}`} style={collectionRowStyle(layout)} role="list">
                {group.map(item => <div key={item.id} role="listitem" data-journey-item className="min-w-0 h-full">{renderCard(item, { items: group, layout })}</div>)}
              </div>
            ) : group.length ? renderList(group) : null}
          </div>
        );
      })}
      <ChunkedTableScrollSync chunkSelector={`[data-collections-list="${listId}"]`} />
    </>
  );
}
