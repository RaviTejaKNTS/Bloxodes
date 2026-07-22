"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { CopyCodeButton } from "@/components/CopyCodeButton";
import { trackEvent } from "@/lib/analytics";

export type PromoRewardClaimType =
  | "web_promo_code"
  | "experience_code"
  | "event_task"
  | "creator_challenge"
  | "catalog_claim"
  | "collaboration"
  | "gift_card_promotion";

export type PromoRewardItem = {
  id: string;
  assetId: number;
  rewardName: string;
  claimType: PromoRewardClaimType;
  promoCode: string | null;
  eventName: string | null;
  requirementText: string | null;
  destinationUrl: string | null;
  robloxItemUrl: string | null;
  thumbnailUrl: string | null;
  status: "source_listed_unverified" | "verified_claimable" | "unavailable" | "expired";
  sortOrder: number;
};

type FilterKey = "promo" | "experience" | "past";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "promo", label: "Promo codes" },
  { key: "experience", label: "In-game codes" },
  { key: "past", label: "Past rewards" }
];

function matchesFilter(item: PromoRewardItem, filter: FilterKey) {
  if (filter === "promo") {
    return item.claimType === "web_promo_code" && item.status === "verified_claimable";
  }
  if (filter === "experience") {
    return item.claimType === "experience_code" && !["expired", "unavailable"].includes(item.status);
  }
  return ["expired", "unavailable"].includes(item.status);
}

function matchesQuery(item: PromoRewardItem, query: string) {
  return [item.rewardName, item.promoCode, item.eventName, item.requirementText].some((value) =>
    value?.toLowerCase().includes(query)
  );
}

function typeLabel(item: PromoRewardItem) {
  if (item.claimType === "web_promo_code") return "Roblox promo code";
  if (item.claimType === "experience_code") return "In-game code";
  return "Reward item";
}

function actionLabel(item: PromoRewardItem) {
  if (item.claimType === "web_promo_code") return "Redeem on Roblox";
  if (item.claimType === "experience_code") return "Play on Roblox";
  return "Open on Roblox";
}

function experienceName(item: PromoRewardItem) {
  if (item.eventName) return item.eventName;
  if (item.destinationUrl?.includes("/6901029464/")) return "Mansion of Wonder";
  if (item.destinationUrl?.includes("/5306359293/")) return "Island of Move";
  return null;
}

function resultLabel(filter: FilterKey, count: number) {
  const noun = filter === "promo" ? "promo code" : filter === "experience" ? "in-game code" : "past reward";
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function PromoRewardRow({ item, eager = false }: { item: PromoRewardItem; eager?: boolean }) {
  const displayName = item.rewardName || `Roblox reward ${item.assetId}`;
  const isPast = item.status === "expired" || item.status === "unavailable";
  const experience = experienceName(item);

  return (
    <article className="flex gap-4 rounded-lg border border-border/70 bg-surface/60 p-3 sm:items-center sm:p-4">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md bg-background/70 sm:h-28 sm:w-28">
        {item.thumbnailUrl ? (
          <Image
            src={item.thumbnailUrl}
            alt={`${displayName} Roblox item`}
            fill
            sizes="112px"
            className="object-contain p-2"
            priority={eager}
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center px-2 text-center text-xs text-muted">No image</div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted">{typeLabel(item)}</span>
          {isPast ? (
            <span className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] font-semibold text-muted">
              {item.status === "expired" ? "Expired" : "Unavailable"}
            </span>
          ) : null}
        </div>

        <div>
          <h3 className="text-base font-semibold leading-snug text-foreground sm:text-lg">{displayName}</h3>
          {experience ? <p className="mt-0.5 text-sm text-muted">Use in {experience}</p> : null}
        </div>

        {item.promoCode ? (
          <div className="flex max-w-md items-center justify-between gap-3 rounded-md border border-border/60 bg-background/70 px-3 py-2">
            <code className="min-w-0 truncate text-sm font-semibold text-foreground">{item.promoCode}</code>
            <CopyCodeButton
              code={item.promoCode}
              size="sm"
              analytics={{
                event: "promo_reward_code_copy",
                params: { asset_id: item.assetId, claim_type: item.claimType }
              }}
            />
          </div>
        ) : item.requirementText ? (
          <p className="text-sm leading-relaxed text-muted">
            <span className="font-semibold text-foreground">How to get it: </span>
            {item.requirementText}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {!isPast && item.destinationUrl ? (
            <a
              href={item.destinationUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackEvent("promo_reward_destination_open", {
                  asset_id: item.assetId,
                  claim_type: item.claimType
                })
              }
              className="inline-flex items-center justify-center rounded-md bg-accent px-3 py-2 text-xs font-semibold text-white transition hover:bg-accent-dark dark:bg-accent-dark dark:hover:bg-accent"
            >
              {actionLabel(item)}
            </a>
          ) : null}
          {item.robloxItemUrl ? (
            <a
              href={item.robloxItemUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md border border-border/70 bg-background px-3 py-2 text-xs font-semibold text-foreground transition hover:border-accent/40 hover:text-accent"
            >
              View item
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function PromoRewardsBrowser({ items }: { items: PromoRewardItem[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("promo");
  const normalizedQuery = query.trim().toLowerCase();
  const availableItems = useMemo(() => items.filter((item) => matchesFilter(item, filter)), [filter, items]);

  const filteredItems = useMemo(
    () =>
      availableItems.filter((item) => !normalizedQuery || matchesQuery(item, normalizedQuery)),
    [availableItems, normalizedQuery]
  );

  return (
    <section aria-label="Roblox promo codes and reward items" className="catalog-surface space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" aria-label="Choose reward type">
          {FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => {
                setFilter(option.key);
                setQuery("");
              }}
              aria-pressed={filter === option.key}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                filter === option.key
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-border/60 bg-surface/60 text-muted hover:border-accent/30 hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted" aria-live="polite">
          {resultLabel(filter, filteredItems.length)}
        </p>
      </div>

      {availableItems.length >= 8 ? (
        <>
          <label htmlFor="promo-reward-search" className="sr-only">
            Search codes and rewards
          </label>
          <input
            id="promo-reward-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search codes and rewards"
            className="w-full rounded-md border border-border/60 bg-background px-4 py-2.5 text-base text-foreground outline-none transition placeholder:text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/15"
          />
        </>
      ) : null}

      {filteredItems.length ? (
        <div className="space-y-3">
          {filteredItems.map((item, index) => (
            <PromoRewardRow key={item.id} item={item} eager={index < 3} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
          {normalizedQuery ? "No codes or rewards match that search." : "Nothing is available in this section right now."}
        </div>
      )}
    </section>
  );
}
