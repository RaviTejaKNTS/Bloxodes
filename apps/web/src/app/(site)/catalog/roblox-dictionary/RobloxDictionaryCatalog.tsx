import Link from "next/link";

export type DictionaryTerm = {
  term: string;
  slug: string;
  aliases: string[];
  expansion: string | null;
  definition: string;
  example: string;
  category: string;
  termType: string;
  status: "current" | "legacy";
  robloxSpecific: boolean;
  safetyNote: string | null;
  sourceUrls: string[];
  lastVerifiedAt: string;
  sortOrder: number;
};

export type DictionaryCategory = {
  key: string;
  label: string;
  shortLabel: string;
  blurb: string;
};

export type DictionaryFilters = {
  query: string;
  category: string | null;
  status: "current" | "legacy" | null;
  letter: string | null;
};

const LETTERS = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

const CATEGORY_TONES: Record<string, { rule: string; tile: string; badge: string }> = {
  "chat-and-social": {
    rule: "bg-sky-500/75",
    tile: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    badge: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300"
  },
  gameplay: {
    rule: "bg-emerald-500/75",
    tile: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    badge: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
  },
  "accounts-and-safety": {
    rule: "bg-amber-500/75",
    tile: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    badge: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
  },
  "avatars-and-marketplace": {
    rule: "bg-fuchsia-500/75",
    tile: "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
    badge: "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300"
  },
  "creator-and-studio": {
    rule: "bg-violet-500/75",
    tile: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    badge: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300"
  },
  "classic-roblox": {
    rule: "bg-rose-500/75",
    tile: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    badge: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300"
  }
};

const DEFAULT_TONE = {
  rule: "bg-accent/75",
  tile: "border-accent/25 bg-accent/10 text-accent",
  badge: "border-accent/25 bg-accent/10 text-accent"
};

function firstLetter(term: string) {
  const first = term.trim().charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : "#";
}

function identityLabel(term: string) {
  const compact = term.replace(/[^a-z0-9+#]/gi, "").toUpperCase();
  return compact.length > 0 && compact.length <= 4 ? compact : firstLetter(term);
}

function matchesQuery(item: DictionaryTerm, query: string) {
  const normalizedQuery = query.toLowerCase();
  return [item.term, item.expansion ?? "", ...item.aliases, item.definition, item.category, item.termType].some(
    (value) => value.toLowerCase().includes(normalizedQuery)
  );
}

export function filterDictionaryItems(items: DictionaryTerm[], filters: DictionaryFilters) {
  return items.filter((item) => {
    if (filters.category && item.category !== filters.category) return false;
    if (filters.status && item.status !== filters.status) return false;
    if (filters.letter && firstLetter(item.term) !== filters.letter) return false;
    if (filters.query && !matchesQuery(item, filters.query)) return false;
    return true;
  });
}

function buildFilterHref(filters: DictionaryFilters, updates: Partial<DictionaryFilters>) {
  const next = { ...filters, ...updates };
  const params = new URLSearchParams();
  if (next.query) params.set("q", next.query);
  if (next.category) params.set("category", next.category);
  if (next.status) params.set("status", next.status);
  if (next.letter) params.set("letter", next.letter);
  const queryString = params.toString();
  return queryString ? `/catalog/roblox-dictionary?${queryString}` : "/catalog/roblox-dictionary";
}

function DictionaryTermCard({ item, categoryLabel }: { item: DictionaryTerm; categoryLabel: string }) {
  const tone = CATEGORY_TONES[item.category] ?? DEFAULT_TONE;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-border/70 bg-surface transition duration-200 hover:-translate-y-0.5 hover:border-accent/55 hover:shadow-lg hover:shadow-black/5">
      <span aria-hidden className={`absolute inset-x-0 top-0 h-1 ${tone.rule}`} />

      <div className="flex flex-1 flex-col gap-4 p-4 pt-5 sm:p-5 sm:pt-6">
        <div className="flex items-start gap-4">
          <div
            aria-hidden
            className={`flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-md border px-1 text-center font-semibold uppercase ${
              identityLabel(item.term).length > 2 ? "text-base" : "text-2xl"
            } ${tone.tile}`}
          >
            {identityLabel(item.term)}
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="break-words text-xl font-semibold leading-snug text-foreground">{item.term}</h3>
              {item.status === "legacy" ? (
                <span className="rounded-md border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
                  Legacy
                </span>
              ) : null}
            </div>
            {item.expansion ? (
              <p className="text-sm leading-snug text-muted">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Means </span>
                <span className="font-semibold text-foreground">{item.expansion}</span>
              </p>
            ) : (
              <p className="text-xs font-semibold text-muted">{categoryLabel}</p>
            )}
          </div>
        </div>

        <p className="text-sm leading-relaxed text-muted">{item.definition}</p>

        <div className="border-l-2 border-accent/35 pl-3.5">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">In a sentence</p>
          <p className="text-sm italic leading-relaxed text-foreground/85">&ldquo;{item.example}&rdquo;</p>
        </div>

        {item.aliases.length ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-muted">Also seen as</span>
            {item.aliases.map((alias) => (
              <span key={alias} className="rounded-md bg-background/70 px-2 py-0.5 text-xs text-foreground">
                {alias}
              </span>
            ))}
          </div>
        ) : null}

        {item.safetyNote ? (
          <div className="rounded-md border border-amber-500/25 bg-amber-500/10 px-3.5 py-3 text-xs leading-relaxed text-muted">
            <span className="font-semibold text-amber-800 dark:text-amber-300">Safety note: </span>
            {item.safetyNote}
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border/50 pt-3 text-[11px] font-semibold">
          <span className={`rounded-md border px-2 py-0.5 ${tone.badge}`}>{categoryLabel}</span>
          <span className="rounded-md border border-border/60 bg-background/55 px-2 py-0.5 text-muted">{item.termType}</span>
          {item.robloxSpecific ? (
            <span className="rounded-md border border-border/60 bg-background/55 px-2 py-0.5 text-muted">Roblox-specific</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function RobloxDictionaryDirectory({
  items,
  categories,
  filters
}: {
  items: DictionaryTerm[];
  categories: DictionaryCategory[];
  filters: DictionaryFilters;
}) {
  const filteredItems = filterDictionaryItems(items, filters);
  const sortedItems = [...filteredItems].sort((a, b) => a.term.localeCompare(b.term, "en", { numeric: true }));
  const categoryByKey = new Map(categories.map((category) => [category.key, category]));
  const visibleSections = categories
    .map((category) => ({
      ...category,
      items: sortedItems.filter((item) => item.category === category.key)
    }))
    .filter((section) => section.items.length > 0);
  const hasFilters = Boolean(filters.query || filters.category || filters.status || filters.letter);
  const availableLetters = new Set(items.map((item) => firstLetter(item.term)));

  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
        No Roblox dictionary terms are available yet.
      </div>
    );
  }

  return (
    <section className="catalog-surface space-y-8" aria-label="Roblox dictionary terms">
      <div className="space-y-5 rounded-lg border border-border/70 bg-surface/45 p-4 sm:p-5">
        <form action="/catalog/roblox-dictionary" method="get" className="flex flex-col gap-4 md:flex-row md:items-end">
          {filters.letter ? <input type="hidden" name="letter" value={filters.letter} /> : null}
          <div className="flex-1 space-y-2">
            <label htmlFor="dictionary-search" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Search
            </label>
            <input
              id="dictionary-search"
              name="q"
              type="search"
              defaultValue={filters.query}
              placeholder="Search term, acronym, alias, or meaning"
              className="w-full rounded-md border border-border/60 bg-surface/60 px-4 py-2 text-sm text-foreground placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <div className="w-full space-y-2 md:w-56">
            <label htmlFor="dictionary-category" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Category
            </label>
            <select
              id="dictionary-category"
              name="category"
              defaultValue={filters.category ?? ""}
              className="w-full rounded-md border border-border/60 bg-surface/60 px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.key} value={category.key}>
                  {category.shortLabel}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full space-y-2 md:w-48">
            <label htmlFor="dictionary-status" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Status
            </label>
            <select
              id="dictionary-status"
              name="status"
              defaultValue={filters.status ?? ""}
              className="w-full rounded-md border border-border/60 bg-surface/60 px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              <option value="">All terms</option>
              <option value="current">Current</option>
              <option value="legacy">Legacy</option>
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
              <Link href="/catalog/roblox-dictionary" className="text-sm font-semibold text-muted transition hover:text-accent">
                Clear
              </Link>
            ) : null}
          </div>
        </form>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">First letter</p>
          <div className="flex max-w-full flex-nowrap gap-1.5 overflow-x-auto pb-1" aria-label="Filter dictionary by first letter">
            <Link
              href={buildFilterHref(filters, { letter: null })}
              scroll={false}
              aria-current={!filters.letter ? "page" : undefined}
              className={`inline-flex h-9 shrink-0 items-center justify-center rounded-md border px-3 text-xs font-semibold transition ${
                !filters.letter
                  ? "border-accent/60 bg-accent text-white"
                  : "border-border/60 bg-background/60 text-muted hover:border-accent/40 hover:text-foreground"
              }`}
            >
              All
            </Link>
            {LETTERS.filter((letter) => availableLetters.has(letter)).map((letter) => {
              const isActive = filters.letter === letter;
              return (
                <Link
                  key={letter}
                  href={buildFilterHref(filters, { letter: isActive ? null : letter })}
                  scroll={false}
                  aria-current={isActive ? "page" : undefined}
                  className={`inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-md border px-2 text-xs font-semibold transition ${
                    isActive
                      ? "border-accent/60 bg-accent text-white"
                      : "border-border/60 bg-background/60 text-muted hover:border-accent/40 hover:text-foreground"
                  }`}
                >
                  {letter}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {visibleSections.length ? (
        visibleSections.map((section) => (
          <section key={section.key} className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-2xl font-semibold text-foreground">{section.label}</h2>
                <p className="max-w-3xl text-sm text-muted">{section.blurb}</p>
              </div>
              <span className="rounded-md border border-border/60 bg-surface/60 px-2.5 py-1 text-xs font-semibold text-muted">
                {section.items.length} {section.items.length === 1 ? "term" : "terms"}
              </span>
            </div>
            <div className="journey-content-stream journey-content-stream--dictionary grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {section.items.map((item) => (
                <div key={item.slug} data-journey-item className="h-full">
                  <DictionaryTermCard
                    item={item}
                    categoryLabel={categoryByKey.get(item.category)?.shortLabel ?? item.category}
                  />
                </div>
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="rounded-lg border border-dashed border-border/60 bg-surface/60 p-8 text-center">
          <p className="font-semibold text-foreground">No dictionary terms matched those filters.</p>
          <p className="mt-2 text-sm text-muted">Try a shorter search, another first letter, or clear the active category.</p>
        </div>
      )}
    </section>
  );
}
