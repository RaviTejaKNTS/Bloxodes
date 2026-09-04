"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { RotateCcw, Search } from "lucide-react";
import { ProgressBar } from "@/components/ProgressBar";
import { CollectionImagePlaceholder } from "@/components/game-collections/CollectionImagePlaceholder";
import { GameCollectionViewShell } from "@/components/game-collections/GameCollectionViewShell";
import {
  dispatchCollectionChecklistProgress,
  trackCollectionChecklistEvent,
  useCollectionChecklistProgress,
  type CollectionChecklistProgressOptions
} from "@/lib/collection-checklist-progress-client";

export type CollectionChecklistItem = {
  id: string;
  name: string;
  image?: string | null;
  [key: string]: unknown;
};

export type CollectionChecklistSection = {
  id: string;
  label: string;
  items: CollectionChecklistItem[];
  note?: string | null;
};

type Filter = "all" | "remaining" | "completed";

const PREFERRED_FIELDS = [
  "region",
  "location",
  "landmark",
  "access",
  "requirements",
  "reward",
  "coordinates",
  "approach",
  "vehicle",
  "environment",
  "animalForm",
  "notes"
];

const FIELD_LABELS: Record<string, string> = {
  collectionOrder: "Order",
  region: "Region",
  area: "Area",
  nearestLandmark: "Nearest landmark",
  exactSpot: "Exact spot",
  accessNotes: "Access",
  cardSummary: "Summary",
  location: "Location",
  landmark: "Landmark",
  access: "Access",
  requirements: "Requirements",
  reward: "Reward",
  coordinates: "Coordinates",
  approach: "Approach",
  vehicle: "Recommended vehicle",
  environment: "Environment",
  animalForm: "Animal form",
  notes: "Notes"
};

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(normalizeText).filter(Boolean).join("; ");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => `${humanize(key)}: ${normalizeText(entry)}`)
      .filter((entry) => !entry.endsWith(": "))
      .join("; ");
  }
  return String(value).replace(/\s+/g, " ").trim();
}

function humanize(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function resolveImageSrc(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || value.startsWith("/")) return value;
  return `/${value}`;
}

function itemSearchText(item: CollectionChecklistItem): string {
  const searchableFields = [
    ...PREFERRED_FIELDS,
    "collectionOrder",
    "area",
    "nearestLandmark",
    "exactSpot",
    "accessNotes",
    "cardSummary"
  ];
  return [item.name, ...searchableFields.map((key) => normalizeText(item[key]))].join(" ").toLowerCase();
}

function getFieldKeys(items: CollectionChecklistItem[], configured?: string[]): string[] {
  const candidateKeys = configured?.length ? configured : PREFERRED_FIELDS;
  return candidateKeys.filter((key, index) => {
    if (candidateKeys.indexOf(key) !== index) return false;
    return items.some((item) => normalizeText(item[key]));
  });
}

function getItemPosition(item: CollectionChecklistItem, fallback: number): string {
  const value = item.collectionOrder ?? item.number ?? item.order ?? item.position ?? item.index;
  const normalized = normalizeText(value);
  return normalized ? `#${normalized.replace(/^#/, "")}` : `#${fallback}`;
}

function itemMatches(item: CollectionChecklistItem, query: string, filter: Filter, checked: Set<string>): boolean {
  if (filter === "completed" && !checked.has(item.id)) return false;
  if (filter === "remaining" && checked.has(item.id)) return false;
  return !query || itemSearchText(item).includes(query);
}

export function CollectionChecklist({
  code,
  gameName,
  collectionLabel,
  sections,
  cardFields,
  toolbar,
  progressOptions
}: {
  code: string;
  gameName: string;
  collectionLabel: string;
  sections: CollectionChecklistSection[];
  cardFields?: string[] | null;
  toolbar?: ReactNode;
  progressOptions: CollectionChecklistProgressOptions;
}) {
  const { checked, toggle, reset } = useCollectionChecklistProgress(progressOptions);
  const allItems = useMemo(() => sections.flatMap((section) => section.items), [sections]);
  const fieldKeys = useMemo(() => getFieldKeys(allItems, cardFields ?? undefined), [allItems, cardFields]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sectionId, setSectionId] = useState("all");

  const total = allItems.length;
  const done = Math.min(checked.size, total);
  const percent = total ? Math.round((done / total) * 100) : 0;
  const normalizedQuery = query.trim().toLowerCase();

  useEffect(() => {
    dispatchCollectionChecklistProgress(progressOptions, done, total);
  }, [done, progressOptions.code, progressOptions.eventName, total]);

  useEffect(() => {
    setQuery("");
    setFilter("all");
    setSectionId("all");
  }, [code]);

  const visibleSections = useMemo(
    () => sections
      .filter((section) => sectionId === "all" || section.id === sectionId)
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => itemMatches(item, normalizedQuery, filter, checked))
      }))
      .filter((section) => section.items.length > 0),
    [checked, filter, normalizedQuery, sectionId, sections]
  );
  const itemPositions = useMemo(() => new Map(allItems.map((item, index) => [item.id, index + 1])), [allItems]);
  const eventPayload = { collection_code: code };

  const handleToggle = (itemId: string, isChecked: boolean) => {
    toggle(itemId);
    trackCollectionChecklistEvent(progressOptions.analyticsPrefix, "item_toggle", {
      ...eventPayload,
      item_id: itemId,
      checked: !isChecked
    });
  };

  return (
    <GameCollectionViewShell availableViews={["cards", "list"]} defaultView="cards" toolbar={toolbar}>
      <section aria-label={`${collectionLabel} checklist`} className="space-y-7">
        <div className="rounded-lg border border-border/70 bg-surface p-5 md:p-6">
          <p className="text-sm font-medium text-foreground" role="status" aria-live="polite">
            {done} of {total} found · {percent}% complete
          </p>
          <ProgressBar percent={percent} className="mt-4 h-2" label={`${gameName} ${collectionLabel} progress`} />
        </div>

      <div className="grid gap-3 rounded-lg border border-border/70 bg-surface/70 p-4 md:grid-cols-[minmax(0,1fr)_12rem_12rem_auto] md:items-center">
        <label className="relative block min-w-0">
          <span className="sr-only">Search {collectionLabel}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${collectionLabel.toLowerCase()}`}
            className="h-11 w-full rounded-md border border-border/70 bg-background pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-accent/70 focus:ring-2 focus:ring-accent/15"
          />
        </label>
        <label className="block min-w-0">
          <span className="sr-only">Filter by progress</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} className="h-11 w-full rounded-md border border-border/70 bg-background px-3 text-sm font-medium text-foreground outline-none focus:border-accent/70">
            <option value="all">All entries</option>
            <option value="remaining">Not found</option>
            <option value="completed">Found</option>
          </select>
        </label>
        {sections.length > 1 ? (
          <label className="block min-w-0">
            <span className="sr-only">Filter by section</span>
            <select value={sectionId} onChange={(event) => setSectionId(event.target.value)} className="h-11 w-full rounded-md border border-border/70 bg-background px-3 text-sm font-medium text-foreground outline-none focus:border-accent/70">
              <option value="all">All sections</option>
              {sections.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}
            </select>
          </label>
        ) : <div aria-hidden className="hidden md:block" />}
        {done > 0 ? (
          <button
            type="button"
            onClick={() => {
              reset();
              trackCollectionChecklistEvent(progressOptions.analyticsPrefix, "progress_reset", eventPayload);
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border/70 bg-background px-3 text-sm font-semibold text-foreground transition hover:border-accent/70 hover:text-accent"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Reset
          </button>
        ) : null}
      </div>

      {visibleSections.length ? (
        <div className="game-collection-cards-view space-y-9">
          {visibleSections.map((section) => {
            const sectionDone = section.items.filter((item) => checked.has(item.id)).length;
            const sectionTotal = section.items.length;
            const sourceSection = sections.find((entry) => entry.id === section.id);
            const sourceTotal = sourceSection?.items.length ?? sectionTotal;
            const sourceDone = sourceSection?.items.filter((item) => checked.has(item.id)).length ?? sectionDone;
            return (
              <div key={section.id} id={section.id} className="scroll-mt-28 space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <h2 className="text-2xl font-semibold leading-tight text-foreground">{section.label}</h2>
                  <div className="flex items-center gap-3 text-sm text-muted">
                    <ProgressBar percent={sourceTotal ? (sourceDone / sourceTotal) * 100 : 0} className="h-1.5 w-28" label={`${section.label} progress`} />
                    <span className="whitespace-nowrap">{sourceDone}/{sourceTotal}</span>
                  </div>
                </div>
                {section.note ? <p className="max-w-3xl whitespace-pre-line text-sm leading-6 text-muted">{section.note}</p> : null}
                {filter !== "all" || normalizedQuery || sectionTotal !== sourceTotal ? (
                  <p className="text-sm text-muted">Showing {sectionDone} of {sectionTotal} visible entries.</p>
                ) : null}
                <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {section.items.map((item) => {
                    const isChecked = checked.has(item.id);
                    const position = itemPositions.get(item.id) ?? 0;
                    const image = resolveImageSrc(item.image);
                    const inputId = `collection-check-${code}-${item.id}`;
                    return (
                      <label id={`item-${item.id}`} key={item.id} className={`group flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-lg border bg-surface transition hover:border-accent/60 ${isChecked ? "border-accent/50" : "border-border/70"}`}>
                        <div className="flex min-w-0 items-start gap-3 p-4">
                          <input
                            id={inputId}
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggle(item.id, isChecked)}
                            aria-label={`${item.name}, ${isChecked ? "found" : "not found"}`}
                            className="mt-0.5 h-6 w-6 shrink-0 cursor-pointer rounded border-border/80 bg-background accent-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                            style={{ accentColor: "rgb(var(--color-accent))" }}
                          />
                          <span className="min-w-0">
                            <span className="block text-xs font-medium text-muted">{getItemPosition(item, position)}</span>
                            <span className={`mt-1 block break-words text-base font-semibold leading-snug text-foreground ${isChecked ? "line-through decoration-accent/70" : ""}`}>{item.name}</span>
                          </span>
                        </div>
                        <div className="relative aspect-[16/9] w-full border-y border-border/60 bg-background/40">
                          {image ? (
                            <Image src={image} alt={item.name} fill sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw" className="object-contain p-4" unoptimized />
                          ) : (
                            <CollectionImagePlaceholder title={item.name} />
                          )}
                        </div>
                        {fieldKeys.length ? (
                          <dl className="min-w-0 space-y-3 p-4">
                            {fieldKeys.map((key) => {
                              const value = normalizeText(item[key]);
                              if (!value) return null;
                              return (
                                <div key={key} className="grid min-w-0 grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-3">
                                  <dt className="min-w-0 break-words text-xs font-medium text-muted">{FIELD_LABELS[key] ?? humanize(key)}</dt>
                                  <dd className="min-w-0 break-words text-sm leading-5 text-foreground">{value}</dd>
                                </div>
                              );
                            })}
                          </dl>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {visibleSections.length ? (
        <div className="game-collection-list-view space-y-9">
          {visibleSections.map((section) => {
            const sectionDone = section.items.filter((item) => checked.has(item.id)).length;
            const sectionTotal = section.items.length;
            const sourceSection = sections.find((entry) => entry.id === section.id);
            const sourceTotal = sourceSection?.items.length ?? sectionTotal;
            const sourceDone = sourceSection?.items.filter((item) => checked.has(item.id)).length ?? sectionDone;
            return (
              <div key={section.id} className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <h2 className="text-2xl font-semibold leading-tight text-foreground">{section.label}</h2>
                  <div className="flex items-center gap-3 text-sm text-muted">
                    <ProgressBar percent={sourceTotal ? (sourceDone / sourceTotal) * 100 : 0} className="h-1.5 w-28" label={`${section.label} progress`} />
                    <span className="whitespace-nowrap">{sourceDone}/{sourceTotal}</span>
                  </div>
                </div>
                {section.note ? <p className="max-w-3xl whitespace-pre-line text-sm leading-6 text-muted">{section.note}</p> : null}
                {filter !== "all" || normalizedQuery || sectionTotal !== sourceTotal ? (
                  <p className="text-sm text-muted">Showing {sectionDone} of {sectionTotal} visible entries.</p>
                ) : null}
                <div className="table-scroll-wrapper rounded-lg border border-border/70 bg-surface">
                  <table className="w-full min-w-[42rem] text-sm">
                    <thead>
                      <tr>
                        <th className="w-16 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-muted">Done</th>
                        <th className="min-w-52 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-muted">Entry</th>
                        <th className="w-28 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-muted">Image</th>
                        {fieldKeys.map((key) => (
                          <th key={key} className="min-w-40 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                            {FIELD_LABELS[key] ?? humanize(key)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.items.map((item) => {
                        const isChecked = checked.has(item.id);
                        const position = itemPositions.get(item.id) ?? 0;
                        const image = resolveImageSrc(item.image);
                        const inputId = `collection-check-${code}-${item.id}-list`;
                        return (
                          <tr key={item.id} id={`item-${item.id}-row`} className={`border-t border-border/60 ${isChecked ? "bg-accent/5" : ""}`}>
                            <td className="px-4 py-4 align-top">
                              <input
                                id={inputId}
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggle(item.id, isChecked)}
                                aria-label={`${item.name}, ${isChecked ? "found" : "not found"}`}
                                className="h-6 w-6 cursor-pointer rounded border-border/80 bg-background accent-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                                style={{ accentColor: "rgb(var(--color-accent))" }}
                              />
                            </td>
                            <th scope="row" className="px-4 py-4 text-left align-top">
                              <span className="block text-xs font-medium text-muted">{getItemPosition(item, position)}</span>
                              <span className={`mt-1 block break-words font-semibold leading-snug text-foreground ${isChecked ? "line-through decoration-accent/70" : ""}`}>{item.name}</span>
                            </th>
                            <td className="px-4 py-4 align-top">
                              <div className="relative h-20 w-24 overflow-hidden rounded-md bg-background/40">
                                {image ? (
                                  <Image src={image} alt={item.name} fill sizes="6rem" className="object-contain p-2" unoptimized />
                                ) : (
                                  <CollectionImagePlaceholder title={item.name} compact />
                                )}
                              </div>
                            </td>
                            {fieldKeys.map((key) => (
                              <td key={key} className="min-w-40 px-4 py-4 align-top text-sm leading-5 text-foreground">
                                {normalizeText(item[key]) || <span className="text-muted">-</span>}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/70 bg-surface/60 p-8 text-center text-sm text-muted">
          No entries match those filters.
        </div>
      )}
      </section>
    </GameCollectionViewShell>
  );
}
