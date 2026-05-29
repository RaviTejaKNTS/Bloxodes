"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
import { type SearchItem, resolveSearchScope } from "@/lib/site-navigation";
import { cn } from "@/lib/utils";
import { formatUpdatedLabel } from "@/lib/updated-label";

const MIN_QUERY_LENGTH = 2;
const SEARCH_LIMIT = 60;
const DEBOUNCE_MS = 250;

type SidebarSearchProps = {
  className?: string;
  initialPathname: string;
  onNavigate?: () => void;
};

export function SidebarSearch({ className, initialPathname, onNavigate }: SidebarSearchProps) {
  const pathname = usePathname() ?? initialPathname;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastTrackedQuery = useRef<string | null>(null);

  const searchScope = resolveSearchScope(pathname);
  const trimmedQuery = query.trim();
  const searchActive = trimmedQuery.length > 0;
  const canSearch = trimmedQuery.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    setQuery("");
    setResults([]);
    setError(null);
    setLoading(false);
    lastTrackedQuery.current = null;
  }, [pathname]);

  useEffect(() => {
    if (!canSearch) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    setResults([]);
    setError(null);

    let cancelled = false;
    let controller: AbortController | null = null;
    const timeout = setTimeout(async () => {
      try {
        setLoading(true);
        controller = new AbortController();
        const params = new URLSearchParams({
          q: trimmedQuery,
          limit: String(SEARCH_LIMIT),
          scope: searchScope.scope
        });
        const response = await fetch(`/api/search/all?${params.toString()}`, {
          signal: controller.signal
        });
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        const payload = (await response.json()) as { items?: SearchItem[] };
        if (!cancelled) {
          setResults(payload.items ?? []);
        }
      } catch (searchError) {
        if ((searchError as { name?: string }).name === "AbortError") return;
        if (!cancelled) {
          console.error("Failed to load sidebar search results", searchError);
          setResults([]);
          setError("Search is unavailable right now.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      if (controller && !controller.signal.aborted) {
        controller.abort("Sidebar search request was replaced");
      }
    };
  }, [canSearch, searchScope.scope, trimmedQuery]);

  useEffect(() => {
    if (!canSearch || loading) return;
    const key = `${searchScope.scope}:${trimmedQuery}`;
    if (lastTrackedQuery.current === key) return;
    lastTrackedQuery.current = key;
    trackEvent("search", {
      search_term: trimmedQuery,
      results_count: results.length,
      content_type: searchScope.scope
    });
  }, [canSearch, loading, results.length, searchScope.scope, trimmedQuery]);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sidebar-foreground/45" />
        <input
          type="search"
          inputMode="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${searchScope.label}`}
          aria-label={`Search ${searchScope.label}`}
          className="h-[34px] w-full rounded-lg border border-transparent bg-sidebar-accent/50 pl-8 pr-8 text-[13px] font-medium text-sidebar-foreground shadow-none outline-none placeholder:text-sidebar-foreground/45 hover:bg-sidebar-accent/70 focus:bg-sidebar focus:ring-1 focus:ring-sidebar-ring"
        />
        {query ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <X aria-hidden className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>

      {searchActive ? (
        <div className="space-y-2">
          <div className="px-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-sidebar-foreground/45">
            {!canSearch
              ? "Keep typing"
              : loading && results.length === 0
                ? "Searching"
                : error
                  ? "Search unavailable"
                  : results.length
                    ? `${results.length} result${results.length === 1 ? "" : "s"}`
                    : "No results"}
          </div>

          {!canSearch ? (
            <div className="rounded-lg bg-sidebar-accent/50 px-3 py-2 text-[13px] leading-5 text-muted-foreground">
              Type at least 2 characters to search.
            </div>
          ) : error ? (
            <div className="rounded-lg bg-sidebar-accent/50 px-3 py-2 text-[13px] leading-5 text-muted-foreground">
              {error}
            </div>
          ) : loading && results.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-10 animate-pulse rounded-lg bg-sidebar-accent/70" />
              ))}
            </div>
          ) : results.length ? (
            <ul className="space-y-1">
              {results.map((item, index) => {
                const updatedLabel = item.updatedAt ? formatUpdatedLabel(item.updatedAt) : null;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.url}
                      className="block rounded-lg px-2.5 py-2.5 text-sidebar-foreground hover:bg-sidebar-accent"
                      onClick={() => {
                        trackEvent("search_result_click", {
                          search_term: trimmedQuery,
                          results_count: results.length,
                          content_type: item.type,
                          position: index + 1,
                          scope: searchScope.scope
                        });
                        onNavigate?.();
                      }}
                    >
                      <span className="block truncate text-[13px] font-medium leading-5">{item.title}</span>
                      <span className="block truncate text-[11px] font-normal leading-4 text-sidebar-foreground/50">
                        {item.subtitle ?? item.type}
                        {item.badge ? ` - ${item.badge}` : ""}
                        {updatedLabel ? ` - ${updatedLabel}` : ""}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-lg bg-sidebar-accent/50 px-3 py-2 text-[13px] leading-5 text-muted-foreground">
              Try another keyword.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
