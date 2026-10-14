"use client";

import { Children, useRef, type ReactNode } from "react";

/** Replace card contents without removing the boundaries beside third-party ads. */
export function CatalogStableItems({ children, slots }: { children: ReactNode; slots: number }) {
  const cards = Children.toArray(children);
  const count = useRef(slots).current;
  return Array.from({ length: count }, (_, index) => (
    <div key={index} data-journey-item className="h-full min-w-0" hidden={!cards[index]}>
      {cards[index]}
    </div>
  ));
}
