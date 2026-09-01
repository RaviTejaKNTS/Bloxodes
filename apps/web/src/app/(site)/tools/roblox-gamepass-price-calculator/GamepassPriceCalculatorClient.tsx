"use client";

import { type FormEvent, useMemo, useState } from "react";

import { trackEvent } from "@/lib/analytics";
import {
  calculateGamepassPriceForTarget,
  calculateGamepassSplit,
  formatTenths,
  GAMEPASS_MAX_CREATOR_TARGET,
  GAMEPASS_MAX_EXPECTED_SALES,
  GAMEPASS_MAX_PRICE
} from "@/lib/roblox-platform-tools/gamepass-calculator";

type Mode = "listed-price" | "desired-earnings";

function parseWholeNumber(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function formatRobux(value: bigint | number): string {
  return `${typeof value === "bigint" ? value.toLocaleString("en-US") : value.toLocaleString("en-US")} Robux`;
}

function InputCard({
  label,
  value,
  onChange,
  help,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  help: string;
  placeholder: string;
}) {
  return (
    <label className="flex flex-col gap-2 rounded-lg border border-border/60 bg-surface px-4 py-3 shadow-soft">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <input
        type="number"
        min={1}
        step={1}
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-border/60 bg-white/5 px-3 py-2 text-base text-foreground outline-none ring-2 ring-transparent transition focus:ring-accent/50 dark:bg-white/10"
        placeholder={placeholder}
      />
      <span className="text-xs leading-5 text-muted">{help}</span>
    </label>
  );
}

export function GamepassPriceCalculatorClient() {
  const [mode, setMode] = useState<Mode>("listed-price");
  const [listedPriceInput, setListedPriceInput] = useState("100");
  const [desiredEarningsInput, setDesiredEarningsInput] = useState("100");
  const [expectedSalesInput, setExpectedSalesInput] = useState("");

  const listedPrice = parseWholeNumber(listedPriceInput);
  const desiredEarnings = parseWholeNumber(desiredEarningsInput);
  const enteredSales = expectedSalesInput.trim() ? parseWholeNumber(expectedSalesInput) : 1;
  const showProjection = expectedSalesInput.trim().length > 0;
  const listedResult = useMemo(
    () => listedPrice === null || enteredSales === null ? null : calculateGamepassSplit(listedPrice, enteredSales),
    [listedPrice, enteredSales]
  );
  const targetResult = useMemo(
    () => desiredEarnings === null || enteredSales === null
      ? null
      : calculateGamepassPriceForTarget(desiredEarnings, enteredSales),
    [desiredEarnings, enteredSales]
  );
  const activeResult = mode === "listed-price" ? listedResult : targetResult;
  const invalidPrice = mode === "listed-price" && listedPrice !== null && listedPrice > GAMEPASS_MAX_PRICE;
  const unreachableTarget =
    mode === "desired-earnings" &&
    desiredEarnings !== null &&
    desiredEarnings > GAMEPASS_MAX_CREATOR_TARGET;
  const invalidSales = enteredSales !== null && enteredSales > GAMEPASS_MAX_EXPECTED_SALES;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    trackEvent("calculator_input_commit", {
      tool_code: "roblox-gamepass-price-calculator",
      mode,
      listed_price: listedPrice,
      desired_earnings: desiredEarnings,
      expected_sales: enteredSales
    });
  }

  return (
    <div className="tool-surface space-y-6">
      <div className="inline-flex overflow-hidden rounded-md border border-border/70 bg-surface text-sm font-semibold shadow-soft">
        <button
          type="button"
          onClick={() => setMode("listed-price")}
          className={`px-4 py-2 transition ${mode === "listed-price" ? "bg-accent text-white dark:bg-accent-dark" : "text-foreground"}`}
        >
          Start with a price
        </button>
        <button
          type="button"
          onClick={() => setMode("desired-earnings")}
          className={`px-4 py-2 transition ${mode === "desired-earnings" ? "bg-accent text-white dark:bg-accent-dark" : "text-foreground"}`}
        >
          Start with earnings
        </button>
      </div>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <form onSubmit={handleSubmit} className="panel space-y-5 p-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              {mode === "listed-price" ? "Check a pass price" : "Work backwards from your target"}
            </h2>
            <p className="text-sm leading-6 text-muted">
              The calculator uses Roblox&apos;s published 70% creator share and 30% Marketplace Fee.
            </p>
          </div>

          {mode === "listed-price" ? (
            <InputCard
              label="Default pass price"
              value={listedPriceInput}
              onChange={setListedPriceInput}
              help="Enter a whole number from 1 to 1,000,000,000 Robux."
              placeholder="100"
            />
          ) : (
            <InputCard
              label="Desired creator earnings per sale"
              value={desiredEarningsInput}
              onChange={setDesiredEarningsInput}
              help="The largest formula-based target for one pass is 700,000,000 Robux."
              placeholder="100"
            />
          )}

          <InputCard
            label="Expected sales, optional"
            value={expectedSalesInput}
            onChange={setExpectedSalesInput}
            help={`Add up to ${GAMEPASS_MAX_EXPECTED_SALES.toLocaleString("en-US")} sales for a planning scenario.`}
            placeholder="For example, 100"
          />

          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-accent-dark dark:bg-accent-dark dark:hover:bg-accent"
          >
            Update estimate
          </button>
        </form>

        <div className="panel space-y-5 p-6" aria-live="polite">
          {!activeResult ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
              {invalidPrice
                ? "A Roblox pass can cost at most 1,000,000,000 Robux."
                : unreachableTarget
                  ? "One pass cannot reach a formula-based creator share above 700,000,000 Robux."
                : invalidSales
                  ? `This calculator accepts up to ${GAMEPASS_MAX_EXPECTED_SALES.toLocaleString("en-US")} expected sales.`
                  : "Enter positive whole Robux amounts to calculate the published split."}
            </div>
          ) : (
            <>
              {mode === "desired-earnings" && targetResult ? (
                <div className="rounded-lg border border-accent/40 bg-accent/5 p-5">
                  <p className="text-sm font-medium text-muted">Formula-based minimum default price</p>
                  <p className="mt-2 text-4xl font-semibold tracking-tight text-foreground">{formatRobux(targetResult.price)}</p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    The published formula reaches {formatTenths(targetResult.creatorShareTenths)} Robux, which is {formatTenths(targetResult.formulaExcessTenths)} Robux above your target. A clean 70/30 split uses {formatRobux(targetResult.cleanSplitPrice)}.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-accent/40 bg-accent/5 p-5">
                  <p className="text-sm font-medium text-muted">Published 70% share estimate</p>
                  <p className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
                    {formatTenths(activeResult.creatorShareTenths)} Robux
                  </p>
                  <p className="mt-2 text-sm text-muted">Per sale at a default price of {formatRobux(activeResult.price)}.</p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border/60 bg-surface p-4">
                  <p className="text-sm text-muted">Creator share estimate</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">{formatTenths(activeResult.creatorShareTenths)} Robux</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-surface p-4">
                  <p className="text-sm text-muted">Roblox Marketplace Fee estimate</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">{formatTenths(activeResult.robloxFeeTenths)} Robux</p>
                </div>
              </div>

              {showProjection ? (
                <div className="rounded-lg border border-border/60 bg-surface p-4">
                  <h3 className="text-lg font-semibold text-foreground">Sales scenario</h3>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-4"><dt className="text-muted">Buyer spend</dt><dd className="font-semibold text-foreground">{formatRobux(activeResult.buyerSpend)}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-muted">Creator share estimate</dt><dd className="font-semibold text-foreground">{formatTenths(activeResult.creatorTotalTenths)} Robux</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-muted">Roblox fee estimate</dt><dd className="font-semibold text-foreground">{formatTenths(activeResult.robloxTotalTenths)} Robux</dd></div>
                  </dl>
                </div>
              ) : null}

              {activeResult.hasFractionalSplit ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-900 dark:text-amber-200">
                  This price produces a fractional 70/30 formula. Roblox does not publish the whole-Robux settlement rule, so check Creator Hub transaction reporting for the credited amount.
                </div>
              ) : null}

              <div className="rounded-lg border border-sky-500/25 bg-sky-500/10 p-4 text-sm leading-6 text-foreground">
                This uses your default pass price. Managed Pricing and price tests can show a different price to a buyer, so actual earnings can vary by sale.
              </div>

              <a
                href="https://create.roblox.com/docs/production/monetization/passes"
                target="_blank"
                rel="noreferrer"
                className="inline-flex text-sm font-semibold text-accent underline-offset-4 hover:underline"
              >
                Check the current Roblox passes documentation
              </a>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
