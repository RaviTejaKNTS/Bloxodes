"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { type SearchItem, type SearchScope } from "@/lib/site-navigation";
import { formatUpdatedLabel } from "@/lib/updated-label";
import { cn } from "@/lib/utils";

export type { SearchItem } from "@/lib/site-navigation";

type Props = {
  /** The section the current page belongs to, from `resolveSearchScope`. */
  pageScope: SearchScope;
  autoFocus?: boolean;
  onNavigate?: () => void;
  onClose?: () => void;
};

const MIN_QUERY_LENGTH = 2;
const SEARCH_LIMIT = 60;
const DEBOUNCE_MS = 250;
const GLOBAL_SCOPE: SearchScope = { scope: "global", label: "Bloxodes" };

function scopeName(scope: SearchScope) {
  return scope.label.charAt(0).toUpperCase() + scope.label.slice(1);
}

/** Site search with the current section's scope, results as a keyboard-navigable list. */
export function UnifiedSearch({ pageScope, autoFocus = false, onNavigate, onClose }: Props) {
  const router = useRouter();
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [everywhere, setEverywhere] = useState(false);
  const [results, setResults] = useState<SearchItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastTrackedQuery = useRef<string | null>(null);

  const scoped = pageScope.scope !== "global";
  const searchScope = scoped && !everywhere ? pageScope : GLOBAL_SCOPE;
  const trimmedQuery = query.trim();
  const canSearch = trimmedQuery.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!canSearch) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    setResults([]);
    setActiveIndex(0);
    setError(null);

    let cancelled = false;
    let controller: AbortController | null = null;
    const timeout = setTimeout(async () => {
      try {
        setLoading(true);
        controller = new AbortController();
        const params = new URLSearchParams({ q: trimmedQuery, limit: String(SEARCH_LIMIT), scope: searchScope.scope });
        const response = await fetch(`/api/search/all?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        const payload = (await response.json()) as { items?: SearchItem[] };
        if (!cancelled) setResults(payload.items ?? []);
      } catch (searchError) {
        if ((searchError as { name?: string }).name === "AbortError") return;
        if (!cancelled) {
          console.error("Failed to load search results", searchError);
          setResults([]);
          setError("Search is unavailable right now. Try again in a moment.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      if (controller && !controller.signal.aborted) controller.abort("Search request was replaced");
    };
  }, [canSearch, searchScope.scope, trimmedQuery]);

  useEffect(() => {
    if (!canSearch || loading) return;
    const key = `${searchScope.scope}:${trimmedQuery}`;
    if (lastTrackedQuery.current === key) return;
    lastTrackedQuery.current = key;
    trackEvent("search", { search_term: trimmedQuery, results_count: results.length, content_type: searchScope.scope });
  }, [canSearch, loading, results.length, searchScope.scope, trimmedQuery]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function trackClick(item: SearchItem, index: number) {
    trackEvent("search_result_click", {
      search_term: trimmedQuery,
      results_count: results.length,
      content_type: item.type,
      position: index + 1,
      scope: searchScope.scope
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      const item = results[activeIndex];
      if (!item) return;
      event.preventDefault();
      trackClick(item, activeIndex);
      router.push(item.url);
      onNavigate?.();
    }
  }

  const status = !canSearch
    ? trimmedQuery
      ? "Type at least 2 characters."
      : null
    : error
      ? error
      : loading && !results.length
        ? null
        : results.length
          ? null
          : "No results. Try another keyword.";
  const showResults = canSearch && results.length > 0;
  const activeId = showResults ? `${listId}-option-${activeIndex}` : undefined;

  return (
    <div className="flex max-h-[min(34rem,calc(100dvh-6rem))] flex-col">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border/60 px-4">
        <Search aria-hidden className="h-[18px] w-[18px] shrink-0 text-muted" />
        <input
          type="search"
          inputMode="search"
          role="combobox"
          aria-expanded={showResults}
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          aria-label={`Search ${searchScope.label}`}
          placeholder={`Search ${searchScope.label}`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          className="h-full min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted/70 [&::-webkit-search-cancel-button]:hidden"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-muted/60 hover:text-foreground"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        ) : null}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="inline-flex h-7 shrink-0 items-center justify-center rounded-md border border-border/70 px-2 text-[11px] font-semibold text-muted hover:text-foreground"
          >
            Esc
          </button>
        ) : null}
      </div>

      {scoped ? (
        <div className="flex shrink-0 items-center gap-1 border-b border-border/60 px-3 py-2" role="group" aria-label="Search in">
          {[
            { label: scopeName(pageScope), pressed: !everywhere, value: false },
            { label: "Everywhere", pressed: everywhere, value: true }
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              aria-pressed={option.pressed}
              onClick={() => setEverywhere(option.value)}
              className={cn(
                "h-7 rounded-md px-2.5 text-xs font-semibold transition-colors",
                option.pressed ? "bg-sidebar-accent text-foreground" : "text-muted hover:bg-muted/50 hover:text-foreground"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <p role="status" className={status ? "px-2.5 py-3 text-sm text-muted" : "sr-only"}>
          {status ?? (showResults ? `${results.length} result${results.length === 1 ? "" : "s"}` : "")}
        </p>
        {canSearch && loading && !results.length ? (
          <div className="space-y-2 p-1" aria-label="Searching">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-lg bg-sidebar-accent/60" />
            ))}
          </div>
        ) : null}
        <div ref={listRef} id={listId} role="listbox" aria-label="Results" hidden={!showResults}>
          {showResults
            ? results.map((item, index) => {
                const updatedLabel = item.updatedAt ? formatUpdatedLabel(item.updatedAt) : null;
                const active = index === activeIndex;
                return (
                  <Link
                    key={item.id}
                    id={`${listId}-option-${index}`}
                    href={item.url}
                    role="option"
                    aria-selected={active}
                    tabIndex={-1}
                    data-index={index}
                    data-active={active ? "true" : "false"}
                    onMouseMove={() => setActiveIndex(index)}
                    onClick={() => {
                      trackClick(item, index);
                      onNavigate?.();
                    }}
                    className="block rounded-lg px-2.5 py-2 text-foreground data-[active=true]:bg-sidebar-accent"
                  >
                    <span className="block truncate text-sm font-medium leading-5">{item.title}</span>
                    <span className="block truncate text-xs leading-4 text-muted">
                      {item.subtitle ?? item.type}
                      {item.badge ? ` - ${item.badge}` : ""}
                      {updatedLabel ? ` - ${updatedLabel}` : ""}
                    </span>
                  </Link>
                );
              })
            : null}
        </div>
      </div>
    </div>
  );
}
