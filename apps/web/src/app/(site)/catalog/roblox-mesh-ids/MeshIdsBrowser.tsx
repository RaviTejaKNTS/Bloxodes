"use client";

import Image from "next/image";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CopyCodeButton } from "@/components/CopyCodeButton";
import { PagePagination } from "@/components/PagePagination";
import {
  DEFAULT_MESH_SORT,
  MESH_SORT_OPTIONS,
  buildMeshQueryString,
  normalizeMeshSearch,
  normalizeMeshSort,
  type MeshSortKey
} from "@/lib/roblox-mesh-ids-search";
import type { RobloxMeshId } from "@/lib/roblox-mesh-ids";

type Props = {
  initialMeshes: RobloxMeshId[];
  initialTotalPages: number;
  currentPage: number;
  basePath: string;
};

type ApiResponse = {
  ok: boolean;
  meshes: RobloxMeshId[];
  total: number;
  totalPages: number;
};

function IdRow({ label, value, mesh }: { label: string; value: number; mesh: RobloxMeshId }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
      <div className="min-w-0">
        <span className="block text-xs font-medium text-muted">{label}</span>
        <code className="block text-sm text-foreground">{value}</code>
      </div>
      <CopyCodeButton
        code={String(value)}
        size="sm"
        analytics={{
          event: "mesh_id_copy",
          params: { asset_id: mesh.asset_id, mesh_id: mesh.mesh_id, copy_kind: label.toLowerCase() }
        }}
      />
    </div>
  );
}

function MeshCard({ mesh, eager = false }: { mesh: RobloxMeshId; eager?: boolean }) {
  return (
    <article className="h-full overflow-hidden rounded-md border border-border/60 bg-surface/20 p-3">
      <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <a
          href={mesh.creator_store_url}
          target="_blank"
          rel="noopener noreferrer"
          className="relative aspect-square overflow-hidden rounded-sm bg-neutral-950"
          aria-label={`Open ${mesh.name} in the Roblox Creator Store`}
        >
          {mesh.thumbnail_url ? (
            <Image
              src={mesh.thumbnail_url}
              alt={`${mesh.name} Roblox mesh preview`}
              fill
              sizes="(max-width: 639px) 100vw, 160px"
              className="object-contain"
              loading={eager ? "eager" : "lazy"}
              fetchPriority={eager ? "high" : "auto"}
              unoptimized
            />
          ) : null}
        </a>

        <div className="flex min-w-0 flex-col gap-3 py-1">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold leading-tight text-foreground md:text-2xl">
              <a
                href={mesh.creator_store_url}
                target="_blank"
                rel="noopener noreferrer"
                className="transition hover:text-accent"
              >
                {mesh.name}
              </a>
            </h2>
            {mesh.creator_name ? <p className="mt-1 text-sm text-muted">by {mesh.creator_name}</p> : null}
          </div>

          <div className="mt-auto grid gap-2">
            <IdRow label="Mesh ID" value={mesh.mesh_id} mesh={mesh} />
            {mesh.texture_id ? <IdRow label="Texture ID" value={mesh.texture_id} mesh={mesh} /> : null}
          </div>
        </div>
      </div>
    </article>
  );
}

export function MeshIdsBrowser(props: Props) {
  return (
    <Suspense
      fallback={
        <MeshIdsBrowserContent {...props} urlQuery="" urlSort={DEFAULT_MESH_SORT} />
      }
    >
      <MeshIdsBrowserWithSearchParams {...props} />
    </Suspense>
  );
}

function MeshIdsBrowserWithSearchParams(props: Props) {
  const params = useSearchParams();
  return (
    <MeshIdsBrowserContent
      {...props}
      urlQuery={normalizeMeshSearch(params.get("q"))}
      urlSort={normalizeMeshSort(params.get("sort"))}
    />
  );
}

function MeshIdsBrowserContent({
  initialMeshes,
  initialTotalPages,
  currentPage,
  basePath,
  urlQuery,
  urlSort
}: Props & { urlQuery: string; urlSort: MeshSortKey }) {
  const router = useRouter();
  const [queryInput, setQueryInput] = useState(urlQuery);
  const [sortInput, setSortInput] = useState<MeshSortKey>(urlSort);
  const [meshes, setMeshes] = useState(initialMeshes);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);
  const queryString = buildMeshQueryString({ query: urlQuery, sort: urlSort });
  const hasFilters = Boolean(queryString);

  useEffect(() => {
    setQueryInput(urlQuery);
    setSortInput(urlSort);
  }, [urlQuery, urlSort]);

  useEffect(() => {
    if (!fetchedRef.current && !hasFilters) {
      setMeshes(initialMeshes);
      setTotalPages(initialTotalPages);
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(currentPage) });
    if (urlQuery) params.set("q", urlQuery);
    if (urlSort !== DEFAULT_MESH_SORT) params.set("sort", urlSort);
    setLoading(true);
    setError(null);
    fetch(`/api/roblox-mesh-ids?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return (await response.json()) as ApiResponse;
      })
      .then((payload) => {
        if (!payload.ok) throw new Error("Request failed");
        setMeshes(payload.meshes);
        setTotalPages(payload.totalPages);
        fetchedRef.current = true;
      })
      .catch((requestError: Error) => {
        if (requestError.name !== "AbortError") setError("Unable to load mesh IDs right now.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [currentPage, hasFilters, initialMeshes, initialTotalPages, urlQuery, urlSort]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = buildMeshQueryString({
      query: normalizeMeshSearch(queryInput),
      sort: sortInput
    });
    router.push(nextQuery ? `${basePath}?${nextQuery}` : basePath);
  }

  function clear() {
    setQueryInput("");
    setSortInput(DEFAULT_MESH_SORT);
    router.push(basePath);
  }

  return (
    <>
      <form onSubmit={submit} aria-busy={loading} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_13rem_auto]">
        <label>
          <span className="sr-only">Search Roblox meshes</span>
          <input
            type="search"
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            placeholder="Search meshes, creators, or IDs"
            className="h-11 w-full rounded-md border border-border/70 bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>
        <label>
          <span className="sr-only">Sort Roblox meshes</span>
          <select
            value={sortInput}
            onChange={(event) => setSortInput(event.target.value as MeshSortKey)}
            className="h-11 w-full rounded-md border border-border/70 bg-background px-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            {MESH_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-3">
          <button type="submit" className="h-11 rounded-md bg-accent px-5 text-sm font-semibold text-white transition hover:bg-accent-dark">
            Apply
          </button>
          {hasFilters ? (
            <button type="button" onClick={clear} className="text-sm font-semibold text-muted transition hover:text-accent">
              Clear
            </button>
          ) : null}
        </div>
      </form>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {meshes.length ? (
        <>
          {meshes.map((mesh, index) => (
            <div key={mesh.asset_id} data-journey-item className="h-full">
              <MeshCard mesh={mesh} eager={index < 4} />
            </div>
          ))}
        </>
      ) : (
        <p className="rounded-lg border border-dashed border-border/70 p-8 text-center text-muted">
          No Roblox meshes match that search.
        </p>
      )}

      <PagePagination
        basePath={basePath}
        currentPage={currentPage}
        totalPages={totalPages}
        query={queryString || undefined}
      />
    </>
  );
}
