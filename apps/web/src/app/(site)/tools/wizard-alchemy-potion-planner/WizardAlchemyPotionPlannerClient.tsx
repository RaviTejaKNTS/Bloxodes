"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Calculator, FlaskConical, RotateCcw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WizardAlchemyMaterial, WizardAlchemyPotion } from "@/lib/wizard-alchemy/data";

type Props = {
  potions: WizardAlchemyPotion[];
  materials: WizardAlchemyMaterial[];
};

function formatMagic(value: number) {
  return `${value.toLocaleString()} Magic`;
}

function toId(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function getElementFromShard(name: string) {
  return name.replace(/\s+Shard$/i, "");
}

function ItemImage({
  src,
  alt,
  className,
  size
}: {
  src?: string;
  alt: string;
  className: string;
  size: number;
}) {
  return (
    <span className={cn("block shrink-0 overflow-hidden rounded-lg border border-border/60 bg-surface-muted", className)}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={size}
          height={size}
          className="h-full w-full object-cover"
        />
      ) : null}
    </span>
  );
}

export function WizardAlchemyPotionPlannerClient({ potions, materials }: Props) {
  const sortedPotions = useMemo(
    () => [...potions].sort((a, b) => a.minMagic - b.minMagic || a.name.localeCompare(b.name)),
    [potions]
  );
  const normalMaterials = useMemo(
    () => materials.filter((item) => typeof item.magicPower === "number").sort((a, b) => (a.magicPower ?? 0) - (b.magicPower ?? 0)),
    [materials]
  );
  const shards = useMemo(
    () => materials.filter((item) => item.collectionSection === "Elemental shards"),
    [materials]
  );
  const [selectedPotionName, setSelectedPotionName] = useState(sortedPotions[0]?.name ?? "");
  const [selectedShardName, setSelectedShardName] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const selectedPotion = useMemo(
    () => sortedPotions.find((potion) => potion.name === selectedPotionName) ?? sortedPotions[0],
    [selectedPotionName, sortedPotions]
  );
  const selectedShard = shards.find((shard) => shard.name === selectedShardName) ?? null;
  const totalMagic = useMemo(
    () =>
      normalMaterials.reduce((sum, material) => {
        const quantity = quantities[material.name] ?? 0;
        return sum + quantity * (material.magicPower ?? 0);
      }, 0),
    [normalMaterials, quantities]
  );
  const selectedMaterials = normalMaterials
    .filter((material) => (quantities[material.name] ?? 0) > 0)
    .map((material) => ({
      ...material,
      quantity: quantities[material.name] ?? 0,
      total: (quantities[material.name] ?? 0) * (material.magicPower ?? 0)
    }))
    .sort((a, b) => b.total - a.total);
  const targetMagic = selectedPotion?.minMagic ?? 0;
  const shortfall = Math.max(0, targetMagic - totalMagic);
  const overBy = Math.max(0, totalMagic - targetMagic);
  const canBrew = totalMagic >= targetMagic;
  const unlockablePotions = sortedPotions.filter((potion) => potion.minMagic <= totalMagic).slice(-6).reverse();
  const suggestedSingle = shortfall
    ? normalMaterials
        .filter((material) => (material.magicPower ?? 0) >= shortfall)
        .sort((a, b) => (a.magicPower ?? 0) - (b.magicPower ?? 0))[0] ?? null
    : null;
  const suggestedFarm = shortfall
    ? [...normalMaterials]
        .sort((a, b) => (b.magicPower ?? 0) - (a.magicPower ?? 0))
        .slice(0, 4)
    : [];
  const recommendedShardMatch =
    selectedPotion?.recommendedShard && selectedShardName
      ? selectedPotion.recommendedShard === selectedShardName
      : null;

  function updateQuantity(name: string, value: number) {
    setQuantities((current) => ({
      ...current,
      [name]: Math.max(0, Math.min(999, Number.isFinite(value) ? Math.floor(value) : 0))
    }));
  }

  function clearPlanner() {
    setQuantities({});
    setSelectedShardName("");
  }

  function applyStarterMix() {
    setQuantities({
      Blueberry: 1,
      "Withered Mushroom": 1,
      "Seagull Egg": 1
    });
    setSelectedShardName("");
  }

  function applyLateMix() {
    setQuantities({
      "Lava Behemoth Remains": 2,
      "Golem Core": 2,
      "Furnace Core": 2,
      "Scepter Gem": 1
    });
    setSelectedShardName("Fire Shard");
  }

  return (
    <div className="tool-surface rounded-xl border border-border/70 bg-surface/70 p-4 shadow-sm md:p-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Target potion</span>
              <select
                value={selectedPotion?.name ?? ""}
                onChange={(event) => setSelectedPotionName(event.target.value)}
                className="h-11 w-full rounded-md border border-border/70 bg-background px-3 text-sm text-foreground outline-none focus:border-accent"
              >
                {sortedPotions.map((potion) => (
                  <option key={potion.name} value={potion.name}>
                    {potion.name} - {potion.minMagic} Magic
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Optional shard</span>
              <select
                value={selectedShardName}
                onChange={(event) => setSelectedShardName(event.target.value)}
                className="h-11 w-full rounded-md border border-border/70 bg-background px-3 text-sm text-foreground outline-none focus:border-accent"
              >
                <option value="">No shard selected</option>
                {shards.map((shard) => (
                  <option key={shard.name} value={shard.name}>
                    {shard.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={applyStarterMix}
              className="inline-flex items-center gap-2 rounded-md border border-border/70 bg-card px-3 py-2 text-sm font-semibold text-foreground transition hover:border-accent/70"
            >
              <FlaskConical className="h-4 w-4" aria-hidden />
              Starter mix
            </button>
            <button
              type="button"
              onClick={applyLateMix}
              className="inline-flex items-center gap-2 rounded-md border border-border/70 bg-card px-3 py-2 text-sm font-semibold text-foreground transition hover:border-accent/70"
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              Late mix
            </button>
            <button
              type="button"
              onClick={clearPlanner}
              className="inline-flex items-center gap-2 rounded-md border border-border/70 bg-card px-3 py-2 text-sm font-semibold text-foreground transition hover:border-accent/70"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Clear
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {normalMaterials.map((material) => {
              const inputId = `material-${toId(material.name)}`;
              return (
                <label key={material.name} htmlFor={inputId} className="rounded-lg border border-border/70 bg-card p-3">
                  <span className="flex items-center gap-3">
                    <ItemImage src={material.image} alt={material.name} className="h-11 w-11" size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 break-words text-sm font-semibold leading-tight text-foreground">{material.name}</span>
                      <span className="mt-1 block text-xs font-semibold text-muted">{formatMagic(material.magicPower ?? 0)}</span>
                    </span>
                    <input
                      id={inputId}
                      type="number"
                      min={0}
                      max={999}
                      value={quantities[material.name] ?? 0}
                      onChange={(event) => updateQuantity(material.name, Number(event.target.value))}
                      className="h-9 w-16 shrink-0 rounded-md border border-border/70 bg-background px-2 text-right text-sm font-semibold text-foreground outline-none focus:border-accent"
                    />
                  </span>
                </label>
              );
            })}
          </div>
        </section>

        <aside className="space-y-4">
          <div className={cn("rounded-lg border p-4", canBrew ? "border-emerald-500/40 bg-emerald-500/10" : "border-amber-500/40 bg-amber-500/10")}>
            <div className="flex items-start justify-between gap-3">
              {selectedPotion ? (
                <div className="flex min-w-0 items-center gap-3">
                  <ItemImage src={selectedPotion.image} alt={selectedPotion.name} className="h-14 w-14" size={56} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-accent">Target potion</p>
                    <p className="truncate text-base font-semibold text-foreground">{selectedPotion.name}</p>
                    <p className="text-xs text-muted">{formatMagic(targetMagic)} needed</p>
                  </div>
                </div>
              ) : null}
              <Calculator className="mt-1 h-4 w-4 shrink-0 text-accent" aria-hidden />
            </div>
            <p className="mt-3 text-3xl font-black text-foreground">{formatMagic(totalMagic)}</p>
            <p className="mt-3 text-sm font-semibold text-foreground">
              {canBrew ? `Ready, with ${formatMagic(overBy)} extra Magic.` : `Missing ${formatMagic(shortfall)}.`}
            </p>
          </div>

          {selectedPotion ? (
            <div className="rounded-lg border border-border/70 bg-card p-4">
              <h3 className="text-base font-semibold text-foreground">Potion details</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-md bg-surface px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Power</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{selectedPotion.power ?? "Utility"}</p>
                </div>
                <div className="rounded-md bg-surface px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Shard</p>
                  <p className="mt-1 line-clamp-1 text-sm font-semibold text-foreground">{selectedPotion.recommendedShard ?? "None listed"}</p>
                </div>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-muted">{selectedPotion.effect}</p>
              {selectedPotion.compatibleRace ? (
                <p className="mt-2 text-xs font-semibold text-muted">Best race fit: {selectedPotion.compatibleRace}</p>
              ) : null}
              {selectedShard ? (
                <div className="mt-3 flex items-center gap-3 rounded-md border border-border/70 bg-surface p-3">
                  <ItemImage src={selectedShard.image} alt={selectedShard.name} className="h-10 w-10" size={40} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Selected shard</p>
                    <p className="truncate text-sm font-semibold text-foreground">{selectedShard.name}</p>
                    <p className="line-clamp-1 text-xs text-muted">
                      {recommendedShardMatch === true
                        ? "Matches this potion"
                        : recommendedShardMatch === false
                          ? `Leans ${getElementFromShard(selectedShard.name)} instead`
                          : selectedShard.elementEffect}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {!canBrew && suggestedSingle ? (
            <div className="rounded-lg border border-border/70 bg-card p-4">
              <h3 className="text-base font-semibold text-foreground">Add this next</h3>
              <div className="mt-3 flex items-center gap-3">
                <ItemImage src={suggestedSingle.image} alt={suggestedSingle.name} className="h-11 w-11" size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{suggestedSingle.name}</p>
                  <p className="text-xs text-muted">{formatMagic(suggestedSingle.magicPower ?? 0)}</p>
                </div>
              </div>
            </div>
          ) : null}

          {!canBrew && !suggestedSingle ? (
            <div className="rounded-lg border border-border/70 bg-card p-4">
              <h3 className="text-base font-semibold text-foreground">Best farm targets</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                {suggestedFarm.map((material) => (
                  <li key={material.name} className="flex items-center gap-3">
                    <ItemImage src={material.image} alt={material.name} className="h-9 w-9" size={36} />
                    <span className="min-w-0 flex-1 truncate font-semibold text-foreground">{material.name}</span>
                    <span className="shrink-0 text-xs">{formatMagic(material.magicPower ?? 0)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-lg border border-border/70 bg-card p-4">
            <h3 className="text-base font-semibold text-foreground">You can brew now</h3>
            {unlockablePotions.length ? (
              <ul className="mt-2 space-y-2 text-sm text-muted">
                {unlockablePotions.map((potion) => (
                  <li key={potion.name} className="flex justify-between gap-3">
                    <span>{potion.name}</span>
                    <span className="shrink-0 font-semibold text-foreground">{potion.minMagic}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">Add 6 Magic to reach the first potion.</p>
            )}
          </div>

          {selectedMaterials.length ? (
            <div className="rounded-lg border border-border/70 bg-card p-4">
              <h3 className="text-base font-semibold text-foreground">Current mix</h3>
              <ul className="mt-2 space-y-2 text-sm text-muted">
                {selectedMaterials.slice(0, 8).map((material) => (
                  <li key={material.name} className="flex justify-between gap-3">
                    <span>{material.quantity} x {material.name}</span>
                    <span className="font-semibold text-foreground">{material.total}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
