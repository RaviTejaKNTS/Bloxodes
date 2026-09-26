"use client";

import Link from "next/link";
import { useDeferredValue, useId, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

export type CollectionFinderEntry = {
  id: string;
  name: string;
  section: string;
  hint?: string;
  href: string;
  searchText: string;
};

function normalize(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
}

function score(entry: CollectionFinderEntry, query: string): number {
  const name = normalize(entry.name);
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.split(/\W+/).some((word) => word.startsWith(query))) return 2;
  if (name.includes(query)) return 3;
  if (normalize(entry.searchText).includes(query)) return 4;
  return 5;
}

export function CollectionItemFinder({ entries }: { entries: CollectionFinderEntry[] }) {
  const inputId = useId();
  const [value, setValue] = useState("");
  const query = normalize(useDeferredValue(value));
  const matches = useMemo(() => {
    if (query.length < 2) return [];
    return entries
      .map((entry) => ({ entry, rank: score(entry, query) }))
      .filter(({ rank }) => rank < 5)
      .sort((left, right) => left.rank - right.rank || left.entry.name.localeCompare(right.entry.name));
  }, [entries, query]);

  return (
    <div className="max-w-2xl space-y-3 border-b border-border/60 pb-6">
      <label htmlFor={inputId} className="block text-sm font-semibold text-foreground">Find an item in this collection</label>
      <div className="flex items-center gap-2">
        <Input
          id={inputId}
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search by name, group or key detail"
          autoComplete="off"
          className="h-11 min-w-0 flex-1"
        />
        {value ? (
          <button type="button" onClick={() => setValue("")} className="rounded-md px-3 py-2 text-sm text-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            Clear
          </button>
        ) : null}
      </div>
      {query.length >= 2 ? (
        <div>
          <p aria-live="polite" className="mb-2 text-sm text-muted">
            {matches.length ? `${matches.length.toLocaleString("en-US")} matching items` : "No matching items"}
            {matches.length > 20 ? ". Showing the first 20; add more letters to narrow the search." : "."}
          </p>
          {matches.length ? (
            <ul className="divide-y divide-border/50 rounded-md border border-border/60 bg-surface/40">
              {matches.slice(0, 20).map(({ entry }) => (
                <li key={entry.id}>
                  <Link href={entry.href} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-2.5 text-sm hover:bg-surface focus-visible:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                    <span className="font-medium text-foreground">{entry.name}</span>
                    <span className="text-muted">{entry.section}{entry.hint ? ` · ${entry.hint}` : ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
