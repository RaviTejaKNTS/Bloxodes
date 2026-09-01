"use client";

import { useMemo, useState } from "react";

import { trackEvent } from "@/lib/analytics";
import {
  addCalendarDays,
  calculateCommissionBreakEven,
  calculateMarketplaceCommission,
  calculateMarketplaceRate,
  MARKETPLACE_MAX_PRICE,
  MARKETPLACE_MAX_SALES,
  MARKETPLACE_UPLOAD_FEE,
  PUBLISHING_ADVANCES,
  type SaleLocation
} from "@/lib/roblox-platform-tools/marketplace-fee-calculator";

function parseWholeNumber(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function formatRobux(value: number): string {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} Robux`;
}

function NumberField({
  label,
  value,
  onChange,
  help,
  min = 0
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  help: string;
  min?: number;
}) {
  return (
    <label className="flex flex-col gap-2 rounded-lg border border-border/60 bg-surface px-4 py-3 shadow-soft">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <input
        type="number"
        min={min}
        step={1}
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-border/60 bg-white/5 px-3 py-2 text-base text-foreground outline-none ring-2 ring-transparent transition focus:ring-accent/50 dark:bg-white/10"
      />
      <span className="text-xs leading-5 text-muted">{help}</span>
    </label>
  );
}

export function MarketplaceFeeCalculatorClient() {
  const [location, setLocation] = useState<SaleLocation>("marketplace");
  const [listedPriceInput, setListedPriceInput] = useState("200");
  const [floorInput, setFloorInput] = useState("100");
  const [salesInput, setSalesInput] = useState("1");
  const [sameOwner, setSameOwner] = useState(false);
  const [itemType, setItemType] = useState("hat");
  const [customAdvanceInput, setCustomAdvanceInput] = useState("");
  const [includeUploadFee, setIncludeUploadFee] = useState(true);
  const [saleDate, setSaleDate] = useState("");

  const listedPrice = parseWholeNumber(listedPriceInput);
  const currentFloor = parseWholeNumber(floorInput);
  const sales = parseWholeNumber(salesInput);
  const customAdvance = customAdvanceInput.trim() ? parseWholeNumber(customAdvanceInput) : null;
  const selectedAdvance = PUBLISHING_ADVANCES.find((entry) => entry.value === itemType)?.robux ?? 0;
  const advance = customAdvanceInput.trim() ? customAdvance : selectedAdvance;
  const rate = useMemo(
    () => listedPrice === null || currentFloor === null ? null : calculateMarketplaceRate(listedPrice, currentFloor),
    [listedPrice, currentFloor]
  );
  const result = useMemo(
    () => listedPrice === null || currentFloor === null || sales === null
      ? null
      : calculateMarketplaceCommission({ listedPrice, currentFloor, sales, location, sameOwner }),
    [listedPrice, currentFloor, sales, location, sameOwner]
  );
  const upfrontCost = advance === null ? null : advance + (includeUploadFee ? MARKETPLACE_UPLOAD_FEE : 0);
  const breakEvenSales = result && upfrontCost !== null
    ? calculateCommissionBreakEven(upfrontCost, result.ownerCombinedPerSale)
    : null;
  const releaseDate = saleDate ? addCalendarDays(saleDate, 30) : null;

  const invalidMessage = (() => {
    if (listedPrice === null || currentFloor === null || sales === null) return "Enter positive whole Robux amounts and a positive whole sales count.";
    if (listedPrice > MARKETPLACE_MAX_PRICE || currentFloor > MARKETPLACE_MAX_PRICE) return `Prices must be no more than ${MARKETPLACE_MAX_PRICE.toLocaleString("en-US")} Robux.`;
    if (sales > MARKETPLACE_MAX_SALES) return `This calculator accepts up to ${MARKETPLACE_MAX_SALES.toLocaleString("en-US")} sales.`;
    if (listedPrice < currentFloor) return "The listed price cannot be below the current price floor.";
    if (location === "marketplace" && rate?.kind === "unsupported") return "Marketplace rates above 10 times the current floor are outside the published checkpoint range.";
    if (customAdvanceInput.trim() && customAdvance === null) return "Enter a non-negative whole Robux custom advance.";
    return "Check the listed price and current floor.";
  })();

  function selectLocation(nextLocation: SaleLocation) {
    setLocation(nextLocation);
    trackEvent("calculator_mode_change", {
      tool_code: "roblox-marketplace-fee-calculator",
      location: nextLocation
    });
  }

  return (
    <div className="tool-surface space-y-6">
      <div className="inline-flex overflow-hidden rounded-md border border-border/70 bg-surface text-sm font-semibold shadow-soft">
        <button
          type="button"
          onClick={() => selectLocation("marketplace")}
          className={`px-4 py-2 transition ${location === "marketplace" ? "bg-accent text-white dark:bg-accent-dark" : "text-foreground"}`}
        >
          Marketplace sale
        </button>
        <button
          type="button"
          onClick={() => selectLocation("in-experience")}
          className={`px-4 py-2 transition ${location === "in-experience" ? "bg-accent text-white dark:bg-accent-dark" : "text-foreground"}`}
        >
          In-experience sale
        </button>
      </div>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="panel space-y-5 p-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Set up the sale</h2>
            <p className="mt-2 text-sm leading-6 text-muted">For paid, non-Limited avatar items sold by their original creator.</p>
          </div>

          <NumberField label="Listed price" value={listedPriceInput} onChange={setListedPriceInput} help="The buyer-facing whole Robux price." min={1} />
          <NumberField label="Current price floor" value={floorInput} onChange={setFloorInput} help="Check Creator Hub and enter the live floor for this item type." min={1} />
          <NumberField label="Expected sales" value={salesInput} onChange={setSalesInput} help="Use 1 for a per-sale calculation." min={1} />

          {location === "in-experience" ? (
            <label className="flex items-start gap-3 rounded-lg border border-border/60 bg-surface p-4 text-sm">
              <input type="checkbox" checked={sameOwner} onChange={(event) => setSameOwner(event.target.checked)} className="mt-1" />
              <span><strong className="text-foreground">I also own the selling experience</strong><br /><span className="text-muted">Combine the 30% item-creator share with the 40% experience-owner share.</span></span>
            </label>
          ) : null}

          <details className="rounded-lg border border-border/60 bg-surface p-4">
            <summary className="cursor-pointer font-semibold text-foreground">Add publishing costs and sale date</summary>
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-semibold text-foreground">
                Item type
                <select value={itemType} onChange={(event) => setItemType(event.target.value)} className="mt-2 w-full rounded-md border border-border/60 bg-background px-3 py-2 font-normal">
                  {PUBLISHING_ADVANCES.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}: {entry.robux.toLocaleString("en-US")} Robux</option>)}
                </select>
              </label>
              <NumberField label="Custom advance, optional" value={customAdvanceInput} onChange={setCustomAdvanceInput} help="Overrides the dated item-type value above." />
              <label className="flex items-center gap-3 text-sm text-foreground">
                <input type="checkbox" checked={includeUploadFee} onChange={(event) => setIncludeUploadFee(event.target.checked)} />
                Include the {MARKETPLACE_UPLOAD_FEE}-Robux upload fee
              </label>
              <label className="block text-sm font-semibold text-foreground">
                Sale date, optional
                <input type="date" value={saleDate} onChange={(event) => setSaleDate(event.target.value)} className="mt-2 w-full rounded-md border border-border/60 bg-background px-3 py-2 font-normal" />
              </label>
            </div>
          </details>
        </div>

        <div className="panel space-y-5 p-6" aria-live="polite">
          {!result ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-900 dark:text-amber-200">{invalidMessage}</div>
          ) : (
            <>
              <div className="rounded-lg border border-accent/40 bg-accent/5 p-5">
                <p className="text-sm font-medium text-muted">Item creator share per sale</p>
                <p className="mt-2 text-4xl font-semibold tracking-tight text-foreground">{formatRobux(result.creatorPerSale)}</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {location === "marketplace"
                    ? `${result.rate.ratePercent.toLocaleString("en-US", { maximumFractionDigits: 2 })}% at ${result.rate.floorMultiple.toLocaleString("en-US", { maximumFractionDigits: 2 })} times the current floor.`
                    : "The published in-experience item-creator share is 30%."}
                </p>
              </div>

              {location === "marketplace" && result.rate.kind === "estimated" ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-900 dark:text-amber-200">
                  This rate is a linear interpolation estimate between Roblox&apos;s published checkpoints. Roblox does not publish a continuous formula or fractional settlement rule.
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-border/60 bg-surface p-4"><p className="text-sm text-muted">Item creator</p><p className="mt-1 text-xl font-semibold text-foreground">{formatRobux(result.creatorPerSale)}</p></div>
                <div className="rounded-lg border border-border/60 bg-surface p-4"><p className="text-sm text-muted">Experience owner</p><p className="mt-1 text-xl font-semibold text-foreground">{formatRobux(result.gameOwnerPerSale)}</p></div>
                <div className="rounded-lg border border-border/60 bg-surface p-4"><p className="text-sm text-muted">Roblox</p><p className="mt-1 text-xl font-semibold text-foreground">{formatRobux(result.robloxPerSale)}</p></div>
              </div>

              {sameOwner && location === "in-experience" ? (
                <div className="rounded-lg border border-accent/30 bg-surface p-4"><p className="text-sm text-muted">Your combined creator and experience-owner share</p><p className="mt-1 text-2xl font-semibold text-foreground">{formatRobux(result.ownerCombinedPerSale)} per sale</p></div>
              ) : null}

              <div className="rounded-lg border border-border/60 bg-surface p-4">
                <h3 className="text-lg font-semibold text-foreground">{sales === 1 ? "One-sale totals" : `${sales?.toLocaleString("en-US")} sale scenario`}</h3>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-4"><dt className="text-muted">Buyer spend</dt><dd className="font-semibold text-foreground">{formatRobux(result.buyerSpend)}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-muted">Item creator total</dt><dd className="font-semibold text-foreground">{formatRobux(result.creatorTotal)}</dd></div>
                  {location === "in-experience" ? <div className="flex justify-between gap-4"><dt className="text-muted">Experience owner total</dt><dd className="font-semibold text-foreground">{formatRobux(result.gameOwnerTotal)}</dd></div> : null}
                  <div className="flex justify-between gap-4"><dt className="text-muted">Roblox total</dt><dd className="font-semibold text-foreground">{formatRobux(result.robloxTotal)}</dd></div>
                </dl>
              </div>

              {upfrontCost !== null && breakEvenSales !== null ? (
                <div className="rounded-lg border border-border/60 bg-surface p-4">
                  <h3 className="text-lg font-semibold text-foreground">Commission-only break-even</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">About <strong className="text-foreground">{breakEvenSales.toLocaleString("en-US")} sales</strong> to cover {formatRobux(upfrontCost)} from the owner-side commission shown here. This does not model advance rebates.</p>
                  {releaseDate ? <p className="mt-2 text-sm text-muted">A sale on {saleDate} reaches 30 calendar days on <strong className="text-foreground">{releaseDate}</strong>. Actual availability depends on Roblox&apos;s transaction status.</p> : null}
                </div>
              ) : null}

              <div className="rounded-lg border border-sky-500/25 bg-sky-500/10 p-4 text-sm leading-6 text-foreground">
                Regional pricing or Managed Pricing may change the buyer&apos;s price. Check Creator Hub transactions for the credited whole-Robux amount.
              </div>
              <a href="https://create.roblox.com/docs/marketplace/marketplace-fees-and-commissions" target="_blank" rel="noreferrer" className="inline-flex text-sm font-semibold text-accent underline-offset-4 hover:underline">Check Roblox&apos;s current Marketplace fee documentation</a>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
