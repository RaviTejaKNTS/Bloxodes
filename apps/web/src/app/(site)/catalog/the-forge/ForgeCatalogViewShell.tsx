"use client";

import { useState, type ReactNode } from "react";

type ViewMode = "cards" | "list";

export function ForgeCatalogViewShell({ children }: { children: ReactNode }) {
  const [view, setView] = useState<ViewMode>("cards");

  return (
    <div className="catalog-surface space-y-8" data-forge-catalog-view={view}>
      <style>{`
        [data-forge-catalog-view="cards"] .forge-catalog-list-view { display: none; }
        [data-forge-catalog-view="list"] .forge-catalog-cards-view { display: none; }
      `}</style>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">View</p>
        <div className="inline-flex rounded-md border border-border/60 bg-surface/70 p-1">
          {([
            { id: "cards", label: "Cards" },
            { id: "list", label: "List" }
          ] as const).map((option) => {
            const isActive = view === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setView(option.id)}
                aria-pressed={isActive}
                className={`rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                  isActive ? "bg-accent text-white" : "text-muted hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      {children}
    </div>
  );
}
