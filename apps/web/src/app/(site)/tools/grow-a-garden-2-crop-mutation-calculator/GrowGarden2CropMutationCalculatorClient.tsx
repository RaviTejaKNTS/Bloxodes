"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import { trackEvent } from "@/lib/analytics";
import type { GrowGarden2Crop, GrowGarden2Mutation } from "@/lib/grow-a-garden-2/value-calculator";
import { cn } from "@/lib/utils";

type Props = {
  crops: GrowGarden2Crop[];
  mutations: GrowGarden2Mutation[];
};

const numberFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const wholeFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function parseInputNumber(value: string): number {
  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned) return 0;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatSheckles(value: number): string {
  if (!Number.isFinite(value)) return "-";
  if (value >= 1_000_000_000) return `${numberFmt.format(value / 1_000_000_000)}B`;
  if (value >= 1_000_000) return `${numberFmt.format(value / 1_000_000)}M`;
  if (value >= 1_000) return `${numberFmt.format(value / 1_000)}K`;
  return wholeFmt.format(value);
}

function formatFullSheckles(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return wholeFmt.format(Math.round(value));
}

export function GrowGarden2CropMutationCalculatorClient({ crops, mutations }: Props) {
  const [cropSearch, setCropSearch] = useState("");
  const [selectedCropId, setSelectedCropId] = useState(crops[0]?.id ?? "");
  const [baseValueInput, setBaseValueInput] = useState("1000");
  const [quantityInput, setQuantityInput] = useState("1");
  const [selectedMutationId, setSelectedMutationId] = useState(mutations.find((m) => m.multiplier)?.id ?? "");
  const [customMultiplierInput, setCustomMultiplierInput] = useState("");

  const selectedCrop = useMemo(
    () => crops.find((crop) => crop.id === selectedCropId) ?? crops[0] ?? null,
    [crops, selectedCropId]
  );

  const visibleCrops = useMemo(() => {
    const search = cropSearch.trim().toLowerCase();
    if (!search) return crops;
    return crops.filter((crop) =>
      [crop.name, crop.rarity, crop.harvestType, crop.whereToGet]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(search))
    );
  }, [crops, cropSearch]);

  const selectedMutation = useMemo(
    () => mutations.find((mutation) => mutation.id === selectedMutationId) ?? mutations.find((m) => m.multiplier) ?? null,
    [mutations, selectedMutationId]
  );

  const baseValue = parseInputNumber(baseValueInput);
  const quantity = Math.max(1, Math.floor(parseInputNumber(quantityInput) || 1));
  const customMultiplier = parseInputNumber(customMultiplierInput);
  const multiplier = selectedMutation?.multiplier ?? (customMultiplier > 0 ? customMultiplier : 1);
  const perCropValue = baseValue * multiplier;
  const totalValue = perCropValue * quantity;
  const valueGain = Math.max(perCropValue - baseValue, 0);
  const needsCustomMultiplier = selectedMutation && selectedMutation.multiplier === null;

  function selectCrop(crop: GrowGarden2Crop) {
    setSelectedCropId(crop.id);
    trackEvent("grow_garden_2_value_calculator_interaction", {
      action: "select_crop",
      item_id: crop.id
    });
  }

  function selectMutation(mutation: GrowGarden2Mutation) {
    setSelectedMutationId(mutation.id);
    if (mutation.multiplier !== null) {
      setCustomMultiplierInput("");
    }
    trackEvent("grow_garden_2_value_calculator_interaction", {
      action: "select_mutation",
      item_id: mutation.id
    });
  }

  return (
    <div className="tool-surface space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
        <section className="space-y-5">
          <div className="rounded-lg border border-border/70 bg-surface/60 p-5 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Choose a Grow a Garden 2 crop</h2>
                <p className="mt-1 text-sm text-muted">
                  The crop picker gives context. Enter the normal value you see in-game, then apply a mutation.
                </p>
              </div>
              {selectedCrop ? (
                <span className="rounded-full border border-border/70 bg-surface px-3 py-1 text-xs font-semibold text-muted">
                  {selectedCrop.rarity ?? "Crop"}
                </span>
              ) : null}
            </div>

            <input
              type="search"
              value={cropSearch}
              onChange={(event) => setCropSearch(event.target.value)}
              placeholder="Search crops, rarity, or harvest type"
              className="mt-4 h-10 w-full rounded-md border border-border/70 bg-surface px-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/30"
            />

            <div className="mt-4 grid max-h-[360px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
              {visibleCrops.map((crop) => {
                const selected = crop.id === selectedCrop?.id;
                return (
                  <button
                    key={crop.id}
                    type="button"
                    onClick={() => selectCrop(crop)}
                    className={cn(
                      "flex min-h-[92px] items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
                      selected ? "border-accent bg-accent/10 ring-2 ring-accent/25" : "border-border/70 bg-surface hover:border-border"
                    )}
                  >
                    {crop.image ? (
                      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border/60 bg-surface-muted">
                        <Image src={crop.image} alt={crop.name} fill sizes="48px" className="object-cover" />
                      </span>
                    ) : (
                      <span className="h-12 w-12 shrink-0 rounded-md border border-border/60 bg-surface-muted" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{crop.name}</span>
                      <span className="mt-1 block text-xs text-muted">
                        {crop.harvestType ?? "Harvest"} · {crop.price ?? "Price unknown"}
                      </span>
                      <span className="mt-1 block text-[11px] font-semibold text-muted">
                        {crop.whereToGet ?? crop.availability ?? "Grow a Garden 2"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-surface/60 p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-foreground">Enter value and quantity</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="block font-semibold text-foreground">Normal crop value</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={baseValueInput}
                  onChange={(event) => setBaseValueInput(event.target.value)}
                  className="h-10 w-full rounded-md border border-border/70 bg-surface px-3 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                />
                <span className="block text-xs text-muted">Use the value before this mutation is applied.</span>
              </label>
              <label className="space-y-2 text-sm">
                <span className="block font-semibold text-foreground">Quantity</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={quantityInput}
                  onChange={(event) => setQuantityInput(event.target.value)}
                  className="h-10 w-full rounded-md border border-border/70 bg-surface px-3 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                />
                <span className="block text-xs text-muted">For checking a stack or several harvested crops.</span>
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-surface/60 p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-foreground">Pick a mutation</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mutations.map((mutation) => {
                const selected = mutation.id === selectedMutation?.id;
                return (
                  <button
                    key={mutation.id}
                    type="button"
                    onClick={() => selectMutation(mutation)}
                    className={cn(
                      "flex min-h-[94px] flex-col justify-between rounded-lg border px-4 py-3 text-left transition-colors",
                      selected ? "border-accent bg-accent/10 ring-2 ring-accent/25" : "border-border/70 bg-surface hover:border-border"
                    )}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-foreground">{mutation.name}</span>
                      <span className="rounded-full bg-surface-muted px-2 py-1 text-[11px] font-semibold text-muted">
                        {mutation.multiplierLabel}
                      </span>
                    </span>
                    <span className="mt-2 text-xs text-muted">{mutation.whereToGet ?? mutation.bestUse ?? "Mutation"}</span>
                  </button>
                );
              })}
            </div>

            {needsCustomMultiplier ? (
              <label className="mt-4 block space-y-2 text-sm">
                <span className="block font-semibold text-foreground">Custom multiplier for {selectedMutation?.name}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Example: 5"
                  value={customMultiplierInput}
                  onChange={(event) => setCustomMultiplierInput(event.target.value)}
                  className="h-10 w-full rounded-md border border-border/70 bg-surface px-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/30"
                />
                <span className="block text-xs text-muted">
                  Enter a multiplier only if you have checked this mutation in game.
                </span>
              </label>
            ) : null}
          </div>
        </section>

        <aside className="space-y-5">
          <div className="sticky top-24 rounded-lg border border-border/70 bg-surface/75 p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-foreground">Estimated value</h2>
            <div className="mt-4 rounded-lg border border-accent/30 bg-accent/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">Total value</p>
              <p className="mt-1 text-4xl font-bold leading-tight text-foreground">{formatSheckles(totalValue)}</p>
              <p className="mt-1 text-sm text-muted">{formatFullSheckles(totalValue)} Sheckles</p>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="rounded-lg border border-border/60 bg-surface px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Selected crop</p>
                <p className="mt-1 text-base font-semibold text-foreground">{selectedCrop?.name ?? "None"}</p>
                <p className="text-xs text-muted">
                  {selectedCrop?.rarity ?? "Rarity unknown"} · {selectedCrop?.harvestType ?? "Harvest unknown"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border/60 bg-surface px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Per crop</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{formatSheckles(perCropValue)}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-surface px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Added value</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{formatSheckles(valueGain)}</p>
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-surface px-4 py-3">
                <p className="text-sm font-semibold text-foreground">Formula</p>
                <p className="mt-2 text-sm text-muted">
                  {formatFullSheckles(baseValue)} × {numberFmt.format(multiplier)} × {quantity} ={" "}
                  {formatFullSheckles(totalValue)} Sheckles
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-surface px-4 py-3">
                <p className="text-sm font-semibold text-foreground">Mutation note</p>
                <p className="mt-2 text-sm text-muted">
                  {selectedMutation?.multiplier === null
                    ? `${selectedMutation.name} is listed without a confirmed multiplier, so this result uses your custom multiplier or defaults to 1x.`
                    : `${selectedMutation?.name ?? "Mutation"} uses the ${numberFmt.format(multiplier)}x multiplier.`}
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
