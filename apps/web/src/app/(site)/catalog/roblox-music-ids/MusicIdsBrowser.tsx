"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CopyCodeButton } from "@/components/CopyCodeButton";
import { MusicCoverImage } from "@/components/MusicCoverImage";
import { PagePagination } from "@/components/PagePagination";
import {
  DEFAULT_SORT,
  SORT_OPTIONS,
  buildSearchQueryString,
  normalizeSearchQuery,
  normalizeSortKey,
  type MusicSortKey
} from "@/lib/music-ids-search";

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

function buildRobloxUrl(assetId: number): string {
  return `https://www.roblox.com/library/${assetId}`;
}

function isRecentlySeen(value: string | null, days = 30): boolean {
  if (!value) return false;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return false;
  return Date.now() - time <= days * 24 * 60 * 60 * 1000;
}

function getSourceBadgeLabel(source: string | null): string | null {
  switch (source) {
    case "creator_store_trending":
      return "Trending";
    case "creator_store_top_current":
      return "Current chart";
    case "creator_store_top_week":
      return "Weekly chart";
    case "creator_store_top_month":
      return "Monthly chart";
    case "creator_store_top_year":
      return "Yearly chart";
    case "music_discovery_top_100":
    case "music_discovery_top_songs":
      return "Top chart";
    default:
      return null;
  }
}

function getMusicBadgeLabels(song: MusicRow): string[] {
  const labels: string[] = [];
  const sourceBadge = getSourceBadgeLabel(song.source);
  if (sourceBadge) labels.push(sourceBadge);
  if (isRecentlySeen(song.last_seen_at)) labels.push("Recently seen");
  if (!labels.length && (song.popularity_score ?? 0) >= 1500) labels.push("Popular");
  return labels.slice(0, 2);
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

export function MusicIdsBrowser({ initialSongs, initialTotalPages, currentPage, basePath }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [queryInput, setQueryInput] = useState("");
  const [sortInput, setSortInput] = useState<MusicSortKey>(DEFAULT_SORT);
  const [songs, setSongs] = useState<MusicRow[]>(initialSongs);
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
  }, [currentPage, hasFilters, initialSongs, initialTotalPages, urlQuery, urlSort]);

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

      {loading ? <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Updating results...</p> : null}
      {error ? <p className="text-sm font-semibold text-rose-400">{error}</p> : null}

      {!songs.length ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
          No music IDs have been collected yet. Check back soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {songs.map((song) => {
            const durationLabel = formatDuration(song.duration_seconds);
            const badges = getMusicBadgeLabels(song);
            return (
              <article
                key={song.asset_id}
                className="group flex h-full flex-col overflow-hidden rounded-lg border border-border/70 bg-surface transition duration-200 hover:border-accent/55"
              >
                <div className="flex flex-1 flex-col gap-4 p-4">
                  <div className="flex items-start gap-4">
                    <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md border border-border/60 bg-background/60">
                      <MusicCoverImage
                        src={buildThumbnailUrl(song)}
                        alt={`${song.title} Roblox music`}
                        sizes="80px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <h2 className="text-lg font-semibold leading-snug text-foreground line-clamp-2">{song.title}</h2>
                      <div className="space-y-1 text-xs text-muted">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Artist</span>
                          <Link
                            href={buildArtistPath(song.artist)}
                            className="font-semibold text-foreground transition hover:text-accent"
                          >
                            {song.artist}
                          </Link>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Album</span>
                          <span className="text-foreground">{song.album ?? "Single / Unknown"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-md border border-border/50 bg-surface px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
                      <span>Music ID</span>
                      <span className="font-mono text-[0.82rem]">{song.asset_id}</span>
                      <CopyCodeButton
                        code={String(song.asset_id)}
                        tone="surface"
                        size="sm"
                        analytics={{
                          event: "music_id_copy",
                          params: {
                            asset_id: song.asset_id,
                            artist: song.artist,
                            genre: song.genre ?? ""
                          }
                        }}
                      />
                    </div>
                    {song.rank ? (
                      <span className="inline-flex items-center rounded-md bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent">
                        Top #{song.rank}
                      </span>
                    ) : null}
                    {badges.map((badge) => (
                      <span
                        key={badge}
                        className="inline-flex items-center rounded-md border border-border/60 bg-background/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-3 py-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Duration</span>
                      <span className="font-semibold text-foreground">{durationLabel ?? "-"}</span>
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-3 py-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Genre</span>
                      {song.genre ? (
                        <Link
                          href={buildGenrePath(song.genre)}
                          className="font-semibold text-foreground transition hover:text-accent"
                        >
                          {song.genre}
                        </Link>
                      ) : (
                        <span className="font-semibold text-foreground">-</span>
                      )}
                    </span>
                  </div>

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
                    <a
                      href={buildRobloxUrl(song.asset_id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:bg-accent-dark dark:bg-accent-dark dark:hover:bg-accent"
                    >
                      Play on Roblox
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
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
