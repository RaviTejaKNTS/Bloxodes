import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { TierListBlockData, TierListItem } from "@/lib/article-blocks";
import { cn } from "@/lib/utils";

const TIER_TONES: Record<string, string> = {
  s: "bg-emerald-500/15 text-emerald-950 dark:text-emerald-100",
  a: "bg-lime-500/15 text-lime-950 dark:text-lime-100",
  b: "bg-amber-500/15 text-amber-950 dark:text-amber-100",
  c: "bg-orange-500/15 text-orange-950 dark:text-orange-100",
  d: "bg-rose-500/15 text-rose-950 dark:text-rose-100",
};

const DEFAULT_TONE = "bg-foreground/5 text-foreground";

function toneForRank(rank: string) {
  const normalized = rank.trim().toLowerCase().replace(/[^a-z]/g, "");
  return TIER_TONES[normalized] ?? DEFAULT_TONE;
}

/**
 * All rows share one image height so mixed aspect ratios pack flush; the
 * whole block steps down a bucket as the largest tier grows, with max-width
 * capping panoramas (~1.8x) and min-width keeping tall images tappable.
 */
const SIZE_BUCKETS = [
  { maxItems: 6, img: "h-[84px] min-w-[44px] max-w-[151px]" },
  { maxItems: 10, img: "h-[72px] min-w-[40px] max-w-[130px]" },
  { maxItems: Infinity, img: "h-[60px] min-w-[36px] max-w-[108px]" },
] as const;

function imageClassForBlock(data: TierListBlockData): string {
  const largestTier = Math.max(...data.tiers.map((tier) => tier.items.length));
  const bucket = SIZE_BUCKETS.find((candidate) => largestTier <= candidate.maxItems) ?? SIZE_BUCKETS[2];
  return bucket.img;
}

type CollectionLink = { href: string; label: string };

function humanizeSlug(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Prefer the explicit block-level collection link; otherwise derive one when
 * every item links to the same site-relative page (ignoring #fragments).
 */
function resolveCollectionLink(data: TierListBlockData): CollectionLink | null {
  if (data.collection) {
    return { href: data.collection.href, label: data.collection.label ?? "View collection" };
  }

  const items = data.tiers.flatMap((tier) => tier.items);
  if (!items.length) return null;
  const paths = items.map((item) => (item.href?.startsWith("/") ? item.href.split("#")[0] : null));
  const first = paths[0];
  if (!first || paths.some((path) => path !== first)) return null;

  const segment = first.split("/").filter(Boolean).pop();
  return { href: first, label: segment ? `${humanizeSlug(segment)} collection` : "View collection" };
}

function TierItemTile({ item, imageClassName }: { item: TierListItem; imageClassName: string }) {
  return (
    <li className="flex flex-none flex-col items-center">
      {item.image && item.alt ? (
        <img
          src={item.image}
          alt={item.alt}
          className={cn("w-auto rounded-lg object-cover", imageClassName)}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span
          className={cn(
            "flex items-center justify-center rounded-lg border border-dashed border-border/70 bg-background/70 px-2 text-center text-xs font-semibold text-muted-foreground",
            imageClassName
          )}
          aria-label={`${item.name}, image unavailable`}
          data-tier-list-text-item="true"
        >
          {item.name}
        </span>
      )}
      {item.image && item.alt ? (
        <span className="line-clamp-2 w-0 min-w-full pt-1 text-center text-[10px] font-medium leading-[1.2] text-foreground">
          {item.name}
        </span>
      ) : null}
    </li>
  );
}

export function ArticleTierList({ data }: { data: TierListBlockData }) {
  const imageClassName = imageClassForBlock(data);
  const collection = resolveCollectionLink(data);

  return (
    <section
      className="article-tier-list not-prose my-8 overflow-hidden rounded-2xl border border-border/60 bg-surface/70 shadow-[0_10px_30px_rgba(0,0,0,0.08)]"
      aria-label={data.title}
      data-article-block="tier-list"
      data-tier-list-id={data.id}
      data-article-lightbox="off"
    >
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
        <h2 className="m-0 text-base font-bold leading-6 text-foreground">{data.title}</h2>
        {collection ? (
          collection.href.startsWith("/") ? (
            <Link
              href={collection.href}
              className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-accent hover:underline"
            >
              {collection.label}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <a
              href={collection.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-accent hover:underline"
            >
              {collection.label}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          )
        ) : data.scope ? (
          <span className="shrink-0 text-xs font-medium text-muted-foreground">{data.scope}</span>
        ) : null}
      </header>

      <div className="divide-y divide-border/60">
        {data.tiers.map((tier) => (
          <section key={tier.rank} className="flex" aria-label={`${tier.rank} tier`}>
            <div
              className={cn(
                "flex w-12 shrink-0 items-center justify-center border-r border-border/60 sm:w-14",
                toneForRank(tier.rank)
              )}
            >
              <h3 className="m-0 text-lg font-extrabold leading-none sm:text-xl">{tier.rank}</h3>
              {tier.label ? <span className="sr-only">{tier.label}</span> : null}
            </div>
            <ul className="flex min-w-0 flex-1 flex-wrap items-start gap-x-1 gap-y-1.5 p-1.5 sm:p-2">
              {tier.items.map((item) => (
                <TierItemTile key={item.name} item={item} imageClassName={imageClassName} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
