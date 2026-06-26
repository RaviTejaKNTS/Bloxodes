"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { CopyCodeButton } from "@/components/CopyCodeButton";
import { PagePagination } from "@/components/PagePagination";
import { RedeemImageGallery } from "@/components/RedeemImageGallery";
import {
  DEFAULT_SORT,
  SORT_OPTIONS,
  buildSearchQueryString,
  normalizeSearchQuery,
  normalizeSortKey,
  type DecalSortKey
} from "@/lib/decal-ids-search";
import type { DecalRow } from "./page-data";

type ApiResponse = {
  ok: boolean;
  decals: DecalRow[];
  total: number;
  totalPages: number;
};

type Props = {
  initialDecals: DecalRow[];
  initialTotalPages: number;
  currentPage: number;
  basePath: string;
  section?: "all" | "curated" | "category";
  category?: string | null;
};

function buildThumbnailUrl(decal: DecalRow): string {
  if (decal.thumbnail_url) return decal.thumbnail_url;
  return `https://www.roblox.com/asset-thumbnail/image?assetId=${decal.asset_id}&width=420&height=420&format=png`;
}

function buildRobloxUrl(assetId: number): string {
  return `https://www.roblox.com/library/${assetId}`;
}

function formatDate(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCount(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value.toLocaleString("en-US");
}

function DecalCard({ decal }: { decal: DecalRow }) {
  const uploaded = formatDate(decal.roblox_created_at);
  const votes = formatCount(decal.vote_count);
  const sales = formatCount(decal.sales);
  const detailsLine = [
    uploaded,
    decal.upvote_percent !== null && decal.upvote_percent !== undefined ? `${decal.upvote_percent}%` : null,
    votes ? `${votes} votes` : null
  ].filter(Boolean).join(" · ");

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-border/70 bg-surface transition duration-200 hover:border-accent/55">
      <div className="relative aspect-square w-full overflow-hidden bg-background/60">
        <RedeemImageGallery
          images={[buildThumbnailUrl(decal)]}
          gameName={decal.name}
          variant="card"
          imageAltBase={`${decal.name} Roblox decal`}
          openLabel={`Open ${decal.name} decal preview`}
          buttonClassName="h-full"
          imageClassName="transition duration-500 group-hover:scale-105"
        />
        {decal.is_for_sale && decal.price_in_robux ? (
          <span className="absolute right-2 top-2 rounded-md bg-accent px-3 py-1 text-xs font-semibold text-white">
            {decal.price_in_robux} R$
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold leading-snug text-foreground line-clamp-2">{decal.name}</h2>
          {decal.creator_name ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="text-[10px] font-semibold uppercase tracking-wide">Creator</span>
              <span className="font-semibold text-foreground line-clamp-1">{decal.creator_name}</span>
              {decal.creator_verified ? (
                <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-accent" aria-label="Verified creator" />
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 rounded-md border border-border/50 bg-surface px-2.5 py-1 text-[11px] font-semibold text-foreground">
          <span>Decal ID</span>
          <span className="font-mono text-[0.78rem]">{decal.asset_id}</span>
          <CopyCodeButton
            code={String(decal.asset_id)}
            tone="surface"
            size="sm"
            analytics={{
              event: "decal_id_copy",
              params: {
                asset_id: decal.asset_id,
                creator: decal.creator_name ?? ""
              }
            }}
          />
        </div>

        <div className="space-y-2 text-xs text-muted">
          {detailsLine ? <p className="font-medium text-muted">{detailsLine}</p> : null}
          {sales ? (
            <span className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-3 py-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Sales</span>
              <span className="font-semibold text-foreground">{sales}</span>
            </span>
          ) : null}
        </div>

        <a
          href={buildRobloxUrl(decal.asset_id)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-dark dark:bg-accent-dark dark:hover:bg-accent"
        >
          View on Roblox
        </a>
      </div>
    </article>
  );
}

export function DecalIdsBrowser({
  initialDecals,
  initialTotalPages,
  currentPage,
  basePath,
  section = "all",
  category = null
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [queryInput, setQueryInput] = useState("");
  const [sortInput, setSortInput] = useState<DecalSortKey>(DEFAULT_SORT);
  const [decals, setDecals] = useState<DecalRow[]>(initialDecals);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  const urlQuery = normalizeSearchQuery(searchParams.get("q"));
  const urlSort = normalizeSortKey(searchParams.get("sort"));
  const searchQueryString = buildSearchQueryString({ query: urlQuery, sort: urlSort });
  const hasFilters = urlQuery.length > 0 || urlSort !== DEFAULT_SORT;

  useEffect(() => {
    setQueryInput(urlQuery);
    setSortInput(urlSort);
  }, [urlQuery, urlSort]);

  useEffect(() => {
    const shouldFetch = hasFetchedRef.current || hasFilters;
    if (!shouldFetch) {
      setDecals(initialDecals);
      setTotalPages(initialTotalPages);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("page", String(currentPage));
    if (section === "curated") params.set("section", "curated");
    if (category) params.set("category", category);
    if (urlQuery) params.set("q", urlQuery);
    if (urlSort !== DEFAULT_SORT) params.set("sort", urlSort);

    fetch(`/api/roblox-decal-ids?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to load results (${res.status})`);
        }
        return (await res.json()) as ApiResponse;
      })
      .then((payload) => {
        if (!payload.ok) {
          throw new Error("Request failed");
        }
        setDecals(payload.decals ?? []);
        setTotalPages(payload.totalPages ?? 1);
        hasFetchedRef.current = true;
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setError("Unable to load decal IDs right now.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [category, currentPage, hasFilters, initialDecals, initialTotalPages, section, urlQuery, urlSort]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = normalizeSearchQuery(queryInput);
    const nextSort = sortInput;
    const nextParams = buildSearchQueryString({ query: nextQuery, sort: nextSort });
    router.push(nextParams ? `${basePath}?${nextParams}` : basePath);
  }

  function handleClear() {
    setQueryInput("");
    setSortInput(DEFAULT_SORT);
    router.push(basePath);
  }

  return (
    <div className="catalog-surface space-y-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex-1 space-y-2">
          <label htmlFor="decal-search" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            Search
          </label>
          <input
            id="decal-search"
            name="q"
            type="search"
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            placeholder="Search decal name, creator, description, or ID"
            className="w-full rounded-md border border-border/60 bg-surface/60 px-4 py-2 text-sm text-foreground placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>
        <div className="w-full space-y-2 md:w-56">
          <label htmlFor="decal-sort" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            Sort
          </label>
          <select
            id="decal-sort"
            name="sort"
            value={sortInput}
            onChange={(event) => setSortInput(event.target.value as DecalSortKey)}
            className="w-full rounded-md border border-border/60 bg-surface/60 px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:bg-accent-dark dark:bg-accent-dark dark:hover:bg-accent"
          >
            Apply
          </button>
          {hasFilters ? (
            <button
              type="button"
              onClick={handleClear}
              className="text-sm font-semibold text-muted transition hover:text-accent"
            >
              Clear
            </button>
          ) : null}
        </div>
      </form>

      {loading ? <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Updating results...</p> : null}
      {error ? <p className="text-sm font-semibold text-rose-400">{error}</p> : null}

      {!decals.length ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
          No decal IDs have been collected yet. Check back soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {decals.map((decal) => (
            <DecalCard key={decal.asset_id} decal={decal} />
          ))}
        </div>
      )}

      <PagePagination
        basePath={basePath}
        currentPage={currentPage}
        totalPages={totalPages}
        query={searchQueryString || undefined}
      />
    </div>
  );
}
