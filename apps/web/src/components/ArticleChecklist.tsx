"use client";

import { useEffect, useMemo, useState } from "react";
import { FiCheckCircle } from "react-icons/fi";
import type { ArticleChecklistBlockData, ArticleChecklistItem } from "@/lib/article-blocks";
import { ProgressBar } from "@/components/ProgressBar";
import { cn } from "@/lib/utils";

type ChecklistGroup = {
  title: string | null;
  description?: string;
  items: ArticleChecklistItem[];
};

function storageKey(articleSlug: string, blockId: string): string {
  return `article-checklist:${articleSlug}:${blockId}`;
}

function readProgress(key: string, availableIds: Set<string>): Set<string> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === "string" && availableIds.has(value)));
  } catch {
    return new Set();
  }
}

function writeProgress(key: string, checked: Set<string>): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(checked)));
  } catch {
    // Keep the checklist usable when storage is disabled.
  }
}

function ChecklistItemCard({
  item,
  checked,
  onToggle,
}: {
  item: ArticleChecklistItem;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 text-sm transition",
        "border-border/60 bg-surface/85 shadow-[0_1px_6px_rgba(0,0,0,0.06)] hover:border-accent/70 hover:shadow-[0_6px_18px_rgba(0,0,0,0.12)]",
        checked ? "bg-surface/70" : "bg-surface/90"
      )}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} className="peer sr-only" />
      <span
        className={cn(
          "relative mt-0.5 flex h-6 w-6 items-center justify-center overflow-hidden rounded-[6px] border transition duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40",
          checked
            ? "border-accent shadow-[0_6px_18px_rgba(0,0,0,0.15)]"
            : "border-border/80 hover:border-foreground/70 hover:ring-2 hover:ring-accent/30"
        )}
        aria-hidden
      >
        <span className="absolute inset-0 rounded-[5px] bg-white dark:bg-background" />
        <span
          className={cn(
            "absolute inset-0 origin-left rounded-[5px] bg-accent transition-transform duration-200 ease-out",
            checked ? "scale-x-100" : "scale-x-0"
          )}
        />
        {checked ? (
          <FiCheckCircle className="relative z-10 h-3.5 w-3.5 text-background transition-colors duration-150" />
        ) : null}
      </span>
      <div className="flex-1 space-y-1 leading-snug">
        {item.href ? (
          <a
            href={item.href}
            target={item.href.startsWith("/") ? undefined : "_blank"}
            rel={item.href.startsWith("/") ? undefined : "noreferrer"}
            className={cn(
              "font-semibold text-foreground underline decoration-accent/70 underline-offset-2",
              checked ? "line-through decoration-2" : undefined
            )}
            onClick={(event) => event.stopPropagation()}
          >
            {item.label}
          </a>
        ) : (
          <div className={cn("font-semibold text-foreground", checked ? "line-through decoration-2" : undefined)}>
            {item.label}
          </div>
        )}
        {item.description ? <p className="text-xs text-muted-foreground">{item.description}</p> : null}
      </div>
    </label>
  );
}

export function ArticleChecklist({
  articleSlug,
  data,
}: {
  articleSlug: string;
  data: ArticleChecklistBlockData;
}) {
  const groups = useMemo<ChecklistGroup[]>(() => {
    const result: ChecklistGroup[] = [];
    if (data.items?.length) result.push({ title: null, items: data.items });
    for (const section of data.sections ?? []) {
      result.push({ title: section.title, description: section.description, items: section.items });
    }
    return result;
  }, [data.items, data.sections]);
  const allItems = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const availableIds = useMemo(() => new Set(allItems.map((item) => item.id)), [allItems]);
  const key = storageKey(articleSlug, data.id);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    setChecked(readProgress(key, availableIds));
  }, [availableIds, key]);

  const toggle = (itemId: string) => {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      writeProgress(key, next);
      return next;
    });
  };

  const done = checked.size;
  const total = allItems.length;
  const percent = total ? Math.round((done / total) * 100) : 0;

  return (
    <section
      className="article-checklist not-prose my-8 flex flex-col gap-5"
      aria-label={data.title}
      data-article-block="checklist"
      data-checklist-id={data.id}
    >
      <div className="space-y-1.5 px-1">
        <h2 className="text-lg font-extrabold leading-snug text-foreground">{data.title}</h2>
        {data.description ? <p className="text-sm leading-6 text-muted-foreground">{data.description}</p> : null}
        <div className="flex flex-wrap items-center gap-2.5">
          <ProgressBar percent={percent} className="h-2.5 flex-1" label={`Progress for ${data.title}`} />
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface/70 px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm">
            <span className="text-foreground">{done}/{total}</span>
            <span>tasks done</span>
            <span className="text-border">.</span>
            <span className="text-foreground">{percent}%</span>
            <span>complete</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {groups.map((group, groupIndex) => (
          <section key={group.title ?? `items-${groupIndex}`} className="space-y-3">
            {group.title ? (
              <div className="space-y-1 px-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span>{group.title}</span>
                </div>
                {group.description ? <p className="text-xs text-muted-foreground">{group.description}</p> : null}
                <div className="h-px w-full bg-border/60" />
              </div>
            ) : null}
            <div className="flex flex-col gap-2">
              {group.items.map((item) => (
                <ChecklistItemCard
                  key={item.id}
                  item={item}
                  checked={checked.has(item.id)}
                  onToggle={() => toggle(item.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
