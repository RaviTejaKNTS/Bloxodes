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
  claimInstructions: string | null;
  destinationUrl: string | null;
  robloxItemUrl: string | null;
  thumbnailUrl: string | null;
  status: "source_listed_unverified" | "verified_claimable" | "unavailable" | "expired";
  sortOrder: number;
};

type FilterKey = "all" | "web" | "experience" | "event" | "challenge";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All rewards" },
  { key: "web", label: "Web codes" },
  { key: "experience", label: "Experience codes" },
  { key: "event", label: "Event rewards" },
  { key: "challenge", label: "Creator challenges" }
];

function claimTypeLabel(claimType: PromoRewardClaimType) {
  switch (claimType) {
    case "web_promo_code":
      return "Web promo code";
    case "experience_code":
      return "Experience code";
    case "event_task":
      return "Event reward";
    case "creator_challenge":
      return "Creator challenge";
    case "catalog_claim":
      return "Catalog claim";
    case "collaboration":
      return "Collaboration";
    case "gift_card_promotion":
      return "Gift card promotion";
  }
}

function matchesFilter(item: PromoRewardItem, filter: FilterKey) {
  if (filter === "all") return true;
  if (filter === "web") return item.claimType === "web_promo_code";
  if (filter === "experience") return item.claimType === "experience_code";
  if (filter === "challenge") return item.claimType === "creator_challenge";
  return ["event_task", "catalog_claim", "collaboration", "gift_card_promotion"].includes(item.claimType);
}

function matchesQuery(item: PromoRewardItem, query: string) {
  return [
    item.rewardName,
    item.promoCode,
    item.eventName,
    item.requirementText,
    item.claimInstructions,
    String(item.assetId)
  ].some((value) => value?.toLowerCase().includes(query));
}

function actionLabel(item: PromoRewardItem) {
  if (item.claimType === "web_promo_code") return "Open Roblox redemption";
  if (item.claimType === "experience_code") return "Open the experience";
  return "Open on Roblox";
}

function statusDisplay(status: PromoRewardItem["status"]) {
  switch (status) {
    case "verified_claimable":
      return {
        label: "Verified claimable",
        className: "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      };
    case "unavailable":
      return {
        label: "Item unavailable",
        className: "border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-300"
      };
    case "expired":
      return {
        label: "Expired",
        className: "border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-300"
      };
    default:
      return {
        label: "Source listed",
        className: "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      };
  }
}

function PromoRewardCard({ item, eager = false }: { item: PromoRewardItem; eager?: boolean }) {
  const displayName = item.rewardName || `Roblox item ${item.assetId}`;
  const status = statusDisplay(item.status);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-border/70 bg-surface/60 transition hover:border-accent/40">
      <div className="relative aspect-square w-full border-b border-border/50 bg-background/70">
        {item.thumbnailUrl ? (
          <Image
            src={item.thumbnailUrl}
            alt={`${displayName} Roblox reward`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-contain p-3"
            priority={eager}
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted">
            Roblox thumbnail unavailable
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-[11px] font-semibold text-foreground">
            {claimTypeLabel(item.claimType)}
          </span>
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${status.className}`}>
            {status.label}
          </span>
        </div>

        <h3 className="text-lg font-semibold leading-snug text-foreground">{displayName}</h3>

        {item.promoCode ? (
          <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/70 px-3 py-2">
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
        ) : null}

        {item.eventName ? (
          <p className="text-sm leading-relaxed text-muted">
            <span className="font-semibold text-foreground">Source event: </span>
            {item.eventName}
          </p>
        ) : null}

        {item.requirementText || item.claimInstructions ? (
          <p className="text-sm leading-relaxed text-muted">
            <span className="font-semibold text-foreground">How it was listed: </span>
            {item.requirementText || item.claimInstructions}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          {item.destinationUrl ? (
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
              View reward
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function PromoRewardsBrowser({ items }: { items: PromoRewardItem[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const normalizedQuery = query.trim().toLowerCase();

  const filteredItems = useMemo(
    () =>
      items.filter(
        (item) => matchesFilter(item, filter) && (!normalizedQuery || matchesQuery(item, normalizedQuery))
      ),
    [filter, items, normalizedQuery]
  );

  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
        No promotional rewards are available yet. Check back after the next source refresh.
      </div>
    );
  }

  return (
    <section aria-label="Roblox promotional rewards browser" className="catalog-surface space-y-6">
      <div className="space-y-3">
        <label htmlFor="promo-reward-search" className="sr-only">
          Search promotional rewards
        </label>
        <input
          id="promo-reward-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search reward, code, event, or asset ID"
          className="w-full rounded-md border border-border/60 bg-background px-4 py-3 text-base text-foreground outline-none transition placeholder:text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/15"
        />
        <div className="flex flex-wrap gap-2" aria-label="Filter promotional rewards">
          {FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setFilter(option.key)}
              aria-pressed={filter === option.key}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
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
          Showing {filteredItems.length} of {items.length} rewards
        </p>
      </div>

      {filteredItems.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {filteredItems.map((item, index) => (
            <PromoRewardCard key={item.id} item={item} eager={index < 4} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
          No rewards matched that search and filter.
        </div>
      )}
    </section>
  );
}
