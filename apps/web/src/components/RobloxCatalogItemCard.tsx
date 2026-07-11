import Image from "next/image";

export type RobloxCatalogItemCardItem = {
  asset_id: number;
  item_type: string;
  name: string;
  category: string | null;
  subcategory: string | null;
  creator_name: string | null;
  creator_has_verified_badge?: boolean | null;
  favorite_count: number | null;
  price_robux: number | null;
  price_status?: string | null;
  lowest_price_robux?: number | null;
  lowest_resale_price_robux?: number | null;
  is_for_sale?: boolean | null;
  is_limited?: boolean | null;
  is_limited_unique?: boolean | null;
  has_resellers?: boolean | null;
  roblox_url: string;
  thumbnail_url: string | null;
};

type Props = {
  item: RobloxCatalogItemCardItem;
  categoryLabelMode?: "avatar" | "taxonomy";
};

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

function formatPrice(value: number): string {
  if (value === 0) return "Free";
  return `${formatCount(value)} Robux`;
}

function formatItemPrice(item: RobloxCatalogItemCardItem): string {
  if (item.lowest_resale_price_robux && item.lowest_resale_price_robux > 0) {
    return `${formatCount(item.lowest_resale_price_robux)} Robux resale`;
  }
  if (typeof item.price_robux === "number") {
    return formatPrice(item.price_robux);
  }
  if (item.is_for_sale === false || item.price_status?.toLowerCase() === "off sale") {
    return "Off sale";
  }
  return "Price unknown";
}

function prettyLabel(value: string | null | undefined): string {
  if (!value) return "Other";
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\bT Shirt\b/g, "T-Shirt")
    .replace(/\bDress Skirt\b/g, "Dresses & Skirts")
    .replace(/\bBody Parts Bundles\b/g, "Full Bodies")
    .trim();
}

function prettyCategoryLabel(item: Pick<RobloxCatalogItemCardItem, "category" | "subcategory">): string {
  if (item.category === "Body" && item.subcategory === "HairAccessories") {
    return "Accessories";
  }
  return prettyLabel(item.category);
}

function buildFallbackRobloxUrl(item: Pick<RobloxCatalogItemCardItem, "asset_id" | "item_type" | "roblox_url">): string {
  if (item.roblox_url) {
    return item.roblox_url;
  }

  if (item.item_type === "Bundle") {
    return `https://www.roblox.com/bundles/${Math.abs(Math.trunc(item.asset_id))}`;
  }

  return `https://www.roblox.com/catalog/${item.asset_id}`;
}

export function RobloxCatalogItemCard({ item, categoryLabelMode = "avatar" }: Props) {
  const hasThumbnail = Boolean(item.thumbnail_url);
  const creatorName = item.creator_name?.trim() || "Unknown creator";
  const favoriteCount = typeof item.favorite_count === "number" ? item.favorite_count : 0;
  const isLimited = item.is_limited || item.is_limited_unique;
  const hasResale = item.has_resellers || Boolean(item.lowest_resale_price_robux && item.lowest_resale_price_robux > 0);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-border/70 bg-surface transition duration-200 hover:border-accent/55">
      <div className="flex flex-1 flex-col">
        <div className="relative aspect-square w-full overflow-hidden border-b border-border/60 bg-background/70">
          {hasThumbnail ? (
            <Image
              src={item.thumbnail_url!}
              alt={item.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-contain p-3"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted/50" aria-hidden>
              <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="4.5" y="4.5" width="15" height="15" rx="3" />
                <path d="m8 15 2.6-2.6a1.4 1.4 0 0 1 2 0L16 15" />
                <path d="M9 9.5h.01" />
              </svg>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background/85 via-background/25 to-transparent" />
          <div className="absolute left-2 top-2">
            <div className="inline-flex rounded-md bg-black/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-sm">
              {formatItemPrice(item)}
            </div>
          </div>
          {isLimited ? (
            <div className="absolute right-2 top-2">
              <div className="inline-flex rounded-md bg-amber-500/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white shadow-sm">
                Limited
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-4 p-3">
          <div>
            <h2 className="text-sm font-semibold leading-4 text-foreground line-clamp-2">{item.name}</h2>
            <p className="-mt-0.5 block truncate text-xs leading-none text-muted">
              by <span className="font-semibold text-foreground">{creatorName}</span>
              {item.creator_has_verified_badge ? <span className="ml-1 text-accent">Verified</span> : null}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center rounded-md border border-border/60 bg-background/50 px-2.5 py-1 text-[10px] font-medium text-foreground/85">
              {categoryLabelMode === "taxonomy" ? prettyLabel(item.category) : prettyCategoryLabel(item)}
            </span>
            <span className="inline-flex items-center rounded-md border border-border/60 bg-background/50 px-2.5 py-1 text-[10px] font-medium text-foreground/85">
              {prettyLabel(item.subcategory)}
            </span>
            {hasResale ? (
              <span className="inline-flex items-center rounded-md border border-amber-400/50 bg-amber-400/10 px-2.5 py-1 text-[10px] font-medium text-amber-700 dark:text-amber-200">
                Resale
              </span>
            ) : null}
          </div>

          <div className="rounded-md border border-border/60 bg-background/40 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Favorites</p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background/70 text-foreground/80">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                  <path d="m12 17.27 5.18 3.05-1.38-5.89 4.58-3.97-6.03-.51L12 4.4 9.65 9.95l-6.03.51 4.58 3.97-1.38 5.89L12 17.27Z" />
                </svg>
              </span>
              <p className="text-base font-semibold leading-none text-foreground">{formatCount(favoriteCount)}</p>
            </div>
          </div>

          <div className="mt-auto">
            <a
              href={buildFallbackRobloxUrl(item)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent-dark dark:bg-accent-dark dark:hover:bg-accent"
            >
              Open on Roblox
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
