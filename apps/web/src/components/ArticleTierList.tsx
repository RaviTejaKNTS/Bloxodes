import Link from "next/link";
import type { TierListBlockData, TierListItem } from "@/lib/article-blocks";
import { cn } from "@/lib/utils";

const TIER_TONES: Record<string, string> = {
  s: "bg-rose-500/15 text-rose-950 dark:text-rose-100",
  a: "bg-orange-500/15 text-orange-950 dark:text-orange-100",
  b: "bg-amber-500/15 text-amber-950 dark:text-amber-100",
  c: "bg-emerald-500/15 text-emerald-950 dark:text-emerald-100",
  d: "bg-sky-500/15 text-sky-950 dark:text-sky-100",
};

const DEFAULT_TONE = "bg-foreground/5 text-foreground";

function toneForRank(rank: string) {
  const normalized = rank.trim().toLowerCase().replace(/[^a-z]/g, "");
  return TIER_TONES[normalized] ?? DEFAULT_TONE;
}

const TILE_CLASS = "flex w-[4.5rem] flex-col gap-1 rounded-md p-1 sm:w-20";

function TierItemContent({ item }: { item: TierListItem }) {
  return (
    <>
      <span className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-md bg-background/70">
        <img
          src={item.image}
          alt={item.alt}
          className="h-full w-full object-contain p-1"
          loading="lazy"
          decoding="async"
        />
      </span>
      <span className="line-clamp-2 w-full text-center text-[11px] font-medium leading-[1.35] text-foreground">
        {item.name}
      </span>
    </>
  );
}

function TierItemTile({ item }: { item: TierListItem }) {
  if (!item.href) {
    return (
      <li className={TILE_CLASS}>
        <TierItemContent item={item} />
      </li>
    );
  }

  const linkClassName = cn(TILE_CLASS, "transition-colors hover:bg-background/70");

  return (
    <li>
      {item.href.startsWith("/") ? (
        <Link href={item.href} className={linkClassName}>
          <TierItemContent item={item} />
        </Link>
      ) : (
        <a href={item.href} target="_blank" rel="noreferrer" className={linkClassName}>
          <TierItemContent item={item} />
        </a>
      )}
    </li>
  );
}

export function ArticleTierList({ data }: { data: TierListBlockData }) {
  return (
    <section
      className="article-tier-list not-prose my-8 overflow-hidden rounded-2xl border border-border/60 bg-surface/70 shadow-[0_10px_30px_rgba(0,0,0,0.08)]"
      aria-label={data.title}
      data-article-block="tier-list"
      data-tier-list-id={data.id}
      data-article-lightbox="off"
    >
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
        <h2 className="text-base font-bold leading-6 text-foreground">{data.title}</h2>
        {data.scope ? (
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
              <h3 className="text-lg font-extrabold leading-none sm:text-xl">{tier.rank}</h3>
              {tier.label ? <span className="sr-only">{tier.label}</span> : null}
            </div>
            <ul className="flex min-w-0 flex-1 flex-wrap content-start gap-1.5 p-2 sm:p-2.5">
              {tier.items.map((item) => (
                <TierItemTile key={item.name} item={item} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
