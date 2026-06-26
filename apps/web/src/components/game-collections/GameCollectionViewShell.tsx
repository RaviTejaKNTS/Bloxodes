"use client";

import { useState, type ReactNode } from "react";

type ViewMode = "cards" | "list";

export function GameCollectionViewShell({
  availableViews = ["cards", "list"],
  defaultView,
  toolbar,
  children
}: {
  availableViews?: ViewMode[];
  defaultView?: ViewMode;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  const initialView =
    defaultView && availableViews.includes(defaultView)
      ? defaultView
      : availableViews.includes("cards")
        ? "cards"
        : "list";
  const [view, setView] = useState<ViewMode>(initialView);
  const activeView = availableViews.includes(view) ? view : initialView;
  const viewSwitcher =
    availableViews.length > 1 ? (
      <div className="catalog-surface max-w-none space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">View</p>
        <div className="inline-flex h-11 w-full rounded-md border border-border/60 bg-surface/70 p-1 sm:w-auto">
          {([
            { id: "cards", label: "Cards" },
            { id: "list", label: "List" }
          ] as const)
            .filter((option) => availableViews.includes(option.id))
            .map((option) => {
              const isActive = activeView === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setView(option.id)}
                  aria-pressed={isActive}
                  className={`min-w-24 flex-1 rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition sm:flex-none ${
                    isActive ? "bg-accent text-white" : "text-muted hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
        </div>
      </div>
    ) : null;

  return (
    <div className="catalog-surface space-y-8" data-game-collection-view={activeView}>
      <style>{`
        [data-game-collection-view="cards"] .game-collection-list-view { display: none; }
        [data-game-collection-view="list"] .game-collection-cards-view { display: none; }
      `}</style>
      {toolbar || viewSwitcher ? (
        <div className="grid gap-4 md:grid-cols-3 md:items-end">
          {toolbar}
          {viewSwitcher}
        </div>
      ) : null}
      {children}
    </div>
  );
}
