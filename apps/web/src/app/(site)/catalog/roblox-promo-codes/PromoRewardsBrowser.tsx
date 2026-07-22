import Image from "next/image";
import { CopyCodeButton } from "@/components/CopyCodeButton";

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

function actionLabel(item: PromoRewardItem) {
  if (item.claimType === "web_promo_code") return "Redeem on Roblox";
  if (item.claimType === "experience_code") return "Play on Roblox";
  return "Open on Roblox";
}

function actionUrl(item: PromoRewardItem) {
  if (item.claimType === "web_promo_code") return "https://www.roblox.com/redeem";
  return item.destinationUrl;
}

function experienceName(item: PromoRewardItem) {
  if (item.eventName) return item.eventName;
  if (item.destinationUrl?.includes("/6901029464/")) return "Mansion of Wonder";
  if (item.destinationUrl?.includes("/5306359293/")) return "Island of Move";
  return null;
}

function PromoRewardRow({
  item,
  eager = false,
  headingLevel = "h3"
}: {
  item: PromoRewardItem;
  eager?: boolean;
  headingLevel?: "h3" | "h4";
}) {
  const displayName = item.rewardName || `Roblox reward ${item.assetId}`;
  const isPast = item.status === "expired" || item.status === "unavailable";
  const destinationUrl = actionUrl(item);
  const ItemHeading = headingLevel;

  return (
    <article className="grid h-full grid-cols-[5.5rem_minmax(0,1fr)] gap-3 rounded-md border border-border/60 bg-transparent p-3">
      <div className="relative min-h-32 w-full overflow-hidden rounded-md bg-surface/50">
        {item.thumbnailUrl ? (
          <Image
            src={item.thumbnailUrl}
            alt={`${displayName} Roblox item`}
            fill
            sizes="88px"
            className="object-contain p-1.5"
            priority={eager}
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center px-1 text-center text-[10px] text-muted">No image</div>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div>
          <ItemHeading className="line-clamp-2 text-base font-semibold leading-snug text-foreground">
            {displayName}
          </ItemHeading>
          {isPast ? (
            <span className="mt-1 inline-flex rounded-full border border-border/70 px-2 py-0.5 text-[11px] font-semibold text-muted">
              {item.status === "expired" ? "Expired" : "Unavailable"}
            </span>
          ) : null}
        </div>

        {item.promoCode ? (
          <div className="flex items-center justify-between gap-2 border-y border-border/50 py-2">
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

        <div className="mt-auto flex flex-wrap gap-2">
          {!isPast && destinationUrl ? (
            <a
              href={destinationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md bg-accent px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-dark dark:bg-accent-dark dark:hover:bg-accent"
            >
              {actionLabel(item)}
            </a>
          ) : null}
          {item.robloxItemUrl ? (
            <a
              href={item.robloxItemUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md border border-border/70 px-2.5 py-1.5 text-xs font-semibold text-foreground transition hover:border-accent/40 hover:text-accent"
            >
              View item
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function PromoRewardSections({ items }: { items: PromoRewardItem[] }) {
  const availablePromoCodes = items.filter(
    (item) => item.claimType === "web_promo_code" && item.status === "verified_claimable"
  );
  const inGameCodes = items.filter(
    (item) => item.claimType === "experience_code" && !["expired", "unavailable"].includes(item.status)
  );
  const islandOfMoveCodes = inGameCodes.filter((item) => experienceName(item) === "Island of Move");
  const mansionOfWonderCodes = inGameCodes.filter((item) => experienceName(item) === "Mansion of Wonder");
  const otherInGameCodes = inGameCodes.filter(
    (item) => !["Island of Move", "Mansion of Wonder"].includes(experienceName(item) ?? "")
  );
  const pastRewards = items.filter((item) => ["expired", "unavailable"].includes(item.status));

  return (
    <div className="space-y-10">
      <section aria-labelledby="available-promo-codes" className="catalog-surface space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="available-promo-codes" className="text-2xl font-semibold text-foreground">
            Available Roblox promo codes
          </h2>
          <p className="text-sm text-muted">
            {availablePromoCodes.length} {availablePromoCodes.length === 1 ? "item" : "items"}
          </p>
        </div>
        {availablePromoCodes.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {availablePromoCodes.map((item, index) => (
              <PromoRewardRow key={item.id} item={item} eager={index < 3} />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border/60 bg-surface/60 p-6 text-muted">
            There are no available website promo codes right now.
          </p>
        )}
      </section>

      <section aria-labelledby="in-game-codes" className="catalog-surface space-y-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="in-game-codes" className="text-2xl font-semibold text-foreground">
            Roblox codes redeemed in experiences
          </h2>
          <p className="text-sm text-muted">
            {inGameCodes.length} {inGameCodes.length === 1 ? "item" : "items"}
          </p>
        </div>
        <p>Enter these codes inside the named Roblox experience, not on the website redeem page.</p>

        {islandOfMoveCodes.length ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-xl font-semibold text-foreground">Island of Move codes</h3>
              <p>Launch Island of Move, select Play It, then choose Redeem Code.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {islandOfMoveCodes.map((item) => (
                <PromoRewardRow key={item.id} item={item} headingLevel="h4" />
              ))}
            </div>
          </div>
        ) : null}

        {mansionOfWonderCodes.length ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-xl font-semibold text-foreground">Mansion of Wonder codes</h3>
              <p>Launch Mansion of Wonder, open Get Swag at the Swag Booth, then choose Redeem Code.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {mansionOfWonderCodes.map((item) => (
                <PromoRewardRow key={item.id} item={item} headingLevel="h4" />
              ))}
            </div>
          </div>
        ) : null}

        {otherInGameCodes.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {otherInGameCodes.map((item) => (
              <PromoRewardRow key={item.id} item={item} headingLevel="h3" />
            ))}
          </div>
        ) : null}

        {!inGameCodes.length ? (
          <p className="rounded-lg border border-dashed border-border/60 bg-surface/60 p-6 text-muted">
            There are no available in-game codes right now.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="expired-promo-codes" className="catalog-surface space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="expired-promo-codes" className="text-2xl font-semibold text-foreground">
            Expired Roblox promo codes
          </h2>
          <p className="text-sm text-muted">
            {pastRewards.length} {pastRewards.length === 1 ? "item" : "items"}
          </p>
        </div>
        {pastRewards.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {pastRewards.map((item) => (
              <PromoRewardRow key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border/60 bg-surface/60 p-6 text-muted">
            There are no expired promo codes listed.
          </p>
        )}
      </section>
    </div>
  );
}
