"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { CopyCodeButton } from "@/components/CopyCodeButton";
import type { RobloxFontId } from "@/lib/roblox-font-ids";

type SortKey = "popular" | "name" | "styles";

function sortFonts(fonts: RobloxFontId[], sort: SortKey): RobloxFontId[] {
  return [...fonts].sort((left, right) => {
    if (sort === "name") return left.name.localeCompare(right.name);
    if (sort === "styles") {
      return right.native_styles.length - left.native_styles.length || left.name.localeCompare(right.name);
    }
    return (right.vote_count ?? -1) - (left.vote_count ?? -1) || left.name.localeCompare(right.name);
  });
}

function FontCard({ font, eager = false }: { font: RobloxFontId; eager?: boolean }) {
  return (
    <article className="h-full overflow-hidden rounded-md border border-border/60 bg-surface/20 p-3">
      <div className="flex min-h-28 items-center justify-start rounded-sm bg-neutral-950 px-5 py-4">
        {font.thumbnail_url ? (
          <Image
            src={font.thumbnail_url}
            alt={`${font.name} Roblox font preview`}
            width={1200}
            height={80}
            sizes="(max-width: 767px) 100vw, 75vw"
            className="h-auto max-h-20 w-full object-contain object-left"
            loading={eager ? "eager" : "lazy"}
            fetchPriority={eager ? "high" : "auto"}
            unoptimized
          />
        ) : (
          <span className="text-sm text-neutral-400">Preview unavailable</span>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 px-1 pb-1 pt-4">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold leading-tight text-foreground md:text-2xl">
            <a
              href={font.creator_store_url}
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-accent"
            >
              {font.name}
            </a>
          </h2>
          <code className="mt-1 block truncate text-sm text-muted">{font.asset_id}</code>
        </div>
        <CopyCodeButton
          code={String(font.asset_id)}
          size="sm"
          analytics={{ event: "font_id_copy", params: { asset_id: font.asset_id, copy_kind: "id" } }}
        />
      </div>
    </article>
  );
}

export function FontIdsBrowser({ fonts }: { fonts: RobloxFontId[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("popular");
  const filteredFonts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matching = needle
      ? fonts.filter((font) =>
          [font.name, font.designer ?? "", ...font.native_styles].some((value) =>
            value.toLowerCase().includes(needle)
          )
        )
      : fonts;
    return sortFonts(matching, sort);
  }, [fonts, query, sort]);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <label className="space-y-1 text-sm font-medium text-foreground">
          <span className="sr-only">Search Roblox fonts</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${fonts.length} fonts`}
            className="h-11 w-full rounded-md border border-border/70 bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>
        <label className="space-y-1 text-sm font-medium text-foreground">
          <span className="sr-only">Sort Roblox fonts</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="h-11 w-full rounded-md border border-border/70 bg-background px-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            <option value="popular">Most popular</option>
            <option value="name">Name A to Z</option>
            <option value="styles">Most styles</option>
          </select>
        </label>
      </div>

      {filteredFonts.length ? (
        <>
          {filteredFonts.map((font, index) => (
            <div key={font.asset_id} data-journey-item className="h-full">
              <FontCard font={font} eager={index < 4} />
            </div>
          ))}
        </>
      ) : (
        <p className="rounded-lg border border-dashed border-border/70 p-8 text-center text-muted">
          No official Roblox fonts match that search.
        </p>
      )}
    </>
  );
}
