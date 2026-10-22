"use client";

import { CatalogStableItems } from "@/components/catalog/CatalogStableItems";
import { MUSIC_IDS_PAGE_SIZE } from "@/lib/catalog-page-sizes";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MusicIdCard } from "@/components/catalog/MusicIdCard";
import { PagePagination } from "@/components/PagePagination";
import {
  DEFAULT_SORT,
  SORT_OPTIONS,
  buildSearchQueryString,
  normalizeSearchQuery,
  normalizeSortKey,
  type MusicSortKey
} from "@/lib/music-ids-search";
import type { MusicGameDatasetPreset } from "@/lib/game-specific-id-pages";

type MusicRow = {
  asset_id: number;
  title: string;
  artist: string;
  album: string | null;
  genre: string | null;
  duration_seconds: number | null;
  album_art_asset_id: number | null;
  thumbnail_url: string | null;
  rank: number | null;
  source: string | null;
  last_seen_at: string | null;
  popularity_score?: number | null;
};

type ApiResponse = {
  ok: boolean;
  songs: MusicRow[];
  total: number;
  totalPages: number;
};

type Props = {
  initialSongs: MusicRow[];
  initialTotalPages: number;
  currentPage: number;
  basePath: string;
  preset?: MusicGameDatasetPreset;
  idLabel?: "Music ID" | "Sound ID";
  gameSlug?: string;
};

type ContentProps = Props & {
  urlQuery: string;
  urlSort: MusicSortKey;
};

function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function buildThumbnailUrl(song: MusicRow): string {
  if (song.thumbnail_url) return song.thumbnail_url;
  if (!song.album_art_asset_id) return "";
  return `https://www.roblox.com/asset-thumbnail/image?assetId=${song.album_art_asset_id}&width=420&height=420&format=png`;
}

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value: string): string {
  return normalizeKey(value).replace(/\s+/g, "-");
}

function buildArtistPath(artist: string): string {
  return `/catalog/roblox-music-ids/artists/${slugify(artist)}`;
}

function buildGenrePath(genre: string): string {
  return `/catalog/roblox-music-ids/genres/${slugify(genre)}`;
}

export function MusicIdsBrowser(props: Props) {
  return (
    <Suspense fallback={<MusicIdsBrowserContent {...props} urlQuery="" urlSort={DEFAULT_SORT} />}>
      <MusicIdsBrowserWithSearchParams {...props} />
    </Suspense>
  );
}

function MusicIdsBrowserWithSearchParams(props: Props) {
  const searchParams = useSearchParams();

  return (
    <MusicIdsBrowserContent
      {...props}
      urlQuery={normalizeSearchQuery(searchParams.get("q"))}
      urlSort={normalizeSortKey(searchParams.get("sort"))}
    />
  );
}

function MusicIdsBrowserContent({
  initialSongs,
  initialTotalPages,
  currentPage,
  basePath,
  preset,
  idLabel = "Music ID",
  gameSlug,
  urlQuery,
  urlSort
}: ContentProps) {
  const [queryInput, setQueryInput] = useState("");
  const [sortInput, setSortInput] = useState<MusicSortKey>(DEFAULT_SORT);
  const [songs, setSongs] = useState<MusicRow[]>(initialSongs);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  const searchQueryString = buildSearchQueryString({ query: urlQuery, sort: urlSort });
  const hasFilters = urlQuery.length > 0 || urlSort !== DEFAULT_SORT;

  useEffect(() => {
    setQueryInput(urlQuery);
    setSortInput(urlSort);
  }, [urlQuery, urlSort]);

  useEffect(() => {
    const shouldFetch = hasFetchedRef.current || hasFilters;
    if (!shouldFetch) {
      setSongs(initialSongs);
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
    if (preset) params.set("preset", preset);
    if (gameSlug) params.set("game", gameSlug);
    if (urlQuery) params.set("q", urlQuery);
    if (urlSort !== DEFAULT_SORT) params.set("sort", urlSort);

    fetch(`/api/roblox-music-ids?${params.toString()}`, { signal: controller.signal })
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
        setSongs(payload.songs ?? []);
        setTotalPages(payload.totalPages ?? 1);
        hasFetchedRef.current = true;
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setError("Unable to load music IDs right now.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [currentPage, gameSlug, hasFilters, initialSongs, initialTotalPages, preset, urlQuery, urlSort]);

  function navigateToFirstPage(params = "") {
    const target = params ? `${basePath}?${params}` : basePath;
    if (window.location.pathname === basePath) {
      // Filters are client API state. Next's History API integration updates
      // useSearchParams without reusing an ISR route's cached canonical URL.
      window.history.pushState(null, "", target);
    } else {
      // A numbered page needs page one's server props. Next 16.2 can reuse
      // a cached canonical URL with old filters, so load the document.
      window.location.assign(target);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = normalizeSearchQuery(queryInput);
    const nextSort = sortInput;
    const nextParams = buildSearchQueryString({ query: nextQuery, sort: nextSort });
    navigateToFirstPage(nextParams);
  }

  function handleClear() {
    setQueryInput("");
    setSortInput(DEFAULT_SORT);
    navigateToFirstPage();
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="catalog-toolbar">
        <div className="flex-1 space-y-2">
          <label htmlFor="music-search" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            Search
          </label>
          <input
            id="music-search"
            name="q"
            type="search"
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            placeholder="Search title, artist, album, genre, or ID"
            className="w-full rounded-md border border-border/60 bg-surface/60 px-4 py-2 text-sm text-foreground placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>
        <div className="w-full space-y-2 md:w-56">
          <label htmlFor="music-sort" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            Sort
          </label>
          <select
            id="music-sort"
            name="sort"
            value={sortInput}
            onChange={(event) => setSortInput(event.target.value as MusicSortKey)}
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

      <p hidden={!loading} className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Updating results...</p>
      <p hidden={!error} className="text-sm font-semibold text-rose-400">{error}</p>

      <div hidden={!!songs.length} className="rounded-lg border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
          No music IDs have been collected yet. Check back soon.
        </div>
      <>
          <CatalogStableItems slots={MUSIC_IDS_PAGE_SIZE}>{songs.map((song) => (
            <MusicIdCard
              key={song.asset_id}
              idLabel={idLabel}
              minimal={preset === "short-sounds"}
              song={{
                assetId: song.asset_id,
                title: song.title,
                artist: song.artist,
                genre: song.genre,
                durationLabel: formatDuration(song.duration_seconds),
                thumbnailUrl: buildThumbnailUrl(song),
                artistHref: buildArtistPath(song.artist),
                genreHref: song.genre ? buildGenrePath(song.genre) : null
              }}
            />
          ))}</CatalogStableItems>
        </>

      <div hidden={totalPages <= 1}><PagePagination
        basePath={basePath}
        currentPage={currentPage}
        totalPages={totalPages}
        query={searchQueryString || undefined}
        firstPageDocumentNavigation
      /></div>
    </>
  );
}
