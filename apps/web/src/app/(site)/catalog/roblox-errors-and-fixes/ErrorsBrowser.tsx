"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";

export type RobloxErrorItem = {
  name: string;
  slug: string;
  errorCode: string | null;
  surface: string;
  message: string | null;
  reasonSummary: string;
  quickFix: string;
  articleSlug: string | null;
  sortOrder: number;
};

export type ErrorSection = {
  surface: string;
  label: string;
  blurb: string;
};

type Props = {
  items: RobloxErrorItem[];
  sections: ErrorSection[];
};

function matchesQuery(item: RobloxErrorItem, query: string) {
  return [
    item.name.toLowerCase(),
    item.errorCode ? `error code ${item.errorCode}`.toLowerCase() : "",
    item.errorCode ?? "",
    item.message?.toLowerCase() ?? "",
    item.reasonSummary.toLowerCase(),
    item.quickFix.toLowerCase()
  ].some((value) => value.includes(query));
}

export function RobloxErrorCard({ item }: { item: RobloxErrorItem }) {
  return (
    <article className="flex h-full flex-col gap-3 rounded-lg border border-border/70 bg-surface/60 p-4 transition duration-200 hover:border-accent/40 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold leading-snug text-foreground">{item.name}</h3>
        {item.errorCode ? (
          <span className="shrink-0 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
            Code {item.errorCode}
          </span>
        ) : null}
      </div>

      {item.message ? (
        <p className="rounded-md border border-border/50 bg-background/70 px-3 py-2 text-sm italic leading-relaxed text-muted">
          &ldquo;{item.message}&rdquo;
        </p>
      ) : null}

      <div className="space-y-2 text-sm leading-relaxed">
        <p className="text-muted">
          <span className="font-semibold text-foreground">Why it happens: </span>
          {item.reasonSummary}
        </p>
        <p className="text-muted">
          <span className="font-semibold text-foreground">Quick fix: </span>
          {item.quickFix}
        </p>
      </div>

      {item.articleSlug ? (
        <div className="mt-auto pt-1">
          <Link
            href={`/articles/${item.articleSlug}`}
            onClick={() =>
              trackEvent("error_fix_article_open", {
                error_slug: item.slug,
                error_code: item.errorCode ?? "none"
              })
            }
            className="inline-flex w-full items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-dark dark:bg-accent-dark dark:hover:bg-accent"
          >
            Open the full fix guide
          </Link>
        </div>
      ) : null}
    </article>
  );
}

export function ErrorsBrowser({ items, sections }: Props) {
  const [query, setQuery] = useState("");
  const [activeSurface, setActiveSurface] = useState<string | null>(null);
  const trimmedQuery = query.trim().toLowerCase();

  const filteredItems = useMemo(() => {
    let next = items;
    if (activeSurface) {
      next = next.filter((item) => item.surface === activeSurface);
    }
    if (trimmedQuery) {
      next = next.filter((item) => matchesQuery(item, trimmedQuery));
    }
    return next;
  }, [items, activeSurface, trimmedQuery]);

  const visibleSections = useMemo(() => {
    return sections
      .map((section) => ({
        ...section,
        items: filteredItems
          .filter((item) => item.surface === section.surface)
          .sort((a, b) => a.sortOrder - b.sortOrder)
      }))
      .filter((section) => section.items.length > 0);
  }, [sections, filteredItems]);

  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
        No Roblox errors are available yet. Check back soon.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by error code or message, e.g. 277 or Same account launched"
          className="w-full rounded-md border border-border/60 bg-background px-4 py-3 text-base text-foreground outline-none transition placeholder:text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/15"
          aria-label="Search Roblox errors"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveSurface(null)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              activeSurface === null
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-border/60 bg-surface/60 text-muted hover:border-accent/30 hover:text-foreground"
            }`}
          >
            All
          </button>
          {sections.map((section) => (
            <button
              key={section.surface}
              type="button"
              onClick={() =>
                setActiveSurface((current) => (current === section.surface ? null : section.surface))
              }
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                activeSurface === section.surface
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-border/60 bg-surface/60 text-muted hover:border-accent/30 hover:text-foreground"
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>

      {visibleSections.flatMap((section) => [
        <div key={`${section.surface}-heading`} className="space-y-1">
          <h2 className="text-2xl font-semibold text-foreground">{section.label}</h2>
          <p className="text-sm text-muted">{section.blurb}</p>
        </div>,
        ...section.items.map((item) => (
          <div key={item.slug} data-journey-item className="h-full">
            <RobloxErrorCard item={item} />
          </div>
        ))
      ])}

      {!visibleSections.length ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
          No Roblox errors matched that search.
        </div>
      ) : null}
    </>
  );
}
