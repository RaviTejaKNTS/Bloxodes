"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Dices, RotateCcw, Target, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WizardAlchemyRace } from "@/lib/wizard-alchemy/data";

type Props = {
  races: WizardAlchemyRace[];
};

const chanceTargets = [0.5, 0.75, 0.9, 0.95] as const;

function parseChancePercent(chance: string) {
  const match = chance.match(/[\d.]+/);
  if (!match) return 0;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed / 100 : 0;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  const percent = value * 100;
  if (percent >= 10) return `${percent.toFixed(1)}%`;
  if (percent >= 1) return `${percent.toFixed(2)}%`;
  return `${percent.toFixed(3)}%`;
}

function rollsForTargetChance(chance: number, target: number) {
  if (chance <= 0 || chance >= 1) return null;
  return Math.ceil(Math.log(1 - target) / Math.log(1 - chance));
}

function chanceAfterRolls(chance: number, rolls: number) {
  if (chance <= 0 || rolls <= 0) return 0;
  return 1 - Math.pow(1 - chance, rolls);
}

function sortRaces(races: WizardAlchemyRace[]) {
  return [...races].sort((a, b) => parseChancePercent(b.rollChance) - parseChancePercent(a.rollChance));
}

function RacePortrait({
  race,
  size = "sm"
}: {
  race: WizardAlchemyRace;
  size?: "sm" | "lg";
}) {
  const dimension = size === "lg" ? 56 : 48;

  return (
    <span
      className={cn(
        "block shrink-0 overflow-hidden rounded-lg border border-border/60 bg-surface-muted",
        size === "lg" ? "h-14 w-14" : "h-12 w-12"
      )}
    >
      {race.image ? (
        <Image
          src={race.image}
          alt={race.name}
          width={dimension}
          height={dimension}
          className="h-full w-full object-cover"
        />
      ) : null}
    </span>
  );
}

export function WizardAlchemyRaceRerollCalculatorClient({ races }: Props) {
  const sortedRaces = useMemo(() => sortRaces(races), [races]);
  const defaultRaceName = sortedRaces.find((race) => race.name === "Night Knight")?.name ?? sortedRaces[0]?.name ?? "";
  const [selectedRaceName, setSelectedRaceName] = useState(defaultRaceName);
  const [rerolls, setRerolls] = useState(25);

  const selectedRace = useMemo(
    () => sortedRaces.find((race) => race.name === selectedRaceName) ?? sortedRaces[0],
    [selectedRaceName, sortedRaces]
  );
  const selectedChance = selectedRace ? parseChancePercent(selectedRace.rollChance) : 0;
  const expectedRolls = selectedChance > 0 ? 1 / selectedChance : null;
  const chanceWithRerolls = chanceAfterRolls(selectedChance, rerolls);
  const missChance = Math.max(0, 1 - chanceWithRerolls);
  const milestoneRows = chanceTargets.map((target) => ({
    target,
    rolls: rollsForTargetChance(selectedChance, target)
  }));

  function updateRerolls(value: number) {
    setRerolls(Math.max(0, Math.min(10000, Number.isFinite(value) ? Math.floor(value) : 0)));
  }

  function reset() {
    setSelectedRaceName(defaultRaceName);
    setRerolls(25);
  }

  return (
    <div className="tool-surface rounded-xl border border-border/70 bg-surface/70 p-4 shadow-sm md:p-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)]">
        <section className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Target race</span>
              <select
                value={selectedRace?.name ?? ""}
                onChange={(event) => setSelectedRaceName(event.target.value)}
                className="h-11 w-full rounded-md border border-border/70 bg-background px-3 text-sm text-foreground outline-none focus:border-accent"
              >
                {sortedRaces.map((race) => (
                  <option key={race.name} value={race.name}>
                    {race.name} - {race.rollChance}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Rerolls</span>
              <input
                type="number"
                min={0}
                max={10000}
                value={rerolls}
                onChange={(event) => updateRerolls(Number(event.target.value))}
                className="h-11 w-full rounded-md border border-border/70 bg-background px-3 text-sm font-semibold text-foreground outline-none focus:border-accent"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            {[10, 25, 50, 100, 250].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => updateRerolls(value)}
                className={cn(
                  "inline-flex h-9 items-center rounded-md border px-3 text-sm font-semibold transition",
                  rerolls === value
                    ? "border-accent bg-accent text-white dark:bg-accent-dark"
                    : "border-border/70 bg-card text-foreground hover:border-accent/70"
                )}
              >
                {value}
              </button>
            ))}
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border/70 bg-card px-3 text-sm font-semibold text-foreground transition hover:border-accent/70"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Reset
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {sortedRaces.map((race) => {
              const chance = parseChancePercent(race.rollChance);
              const selected = selectedRace?.name === race.name;
              return (
                <button
                  key={race.name}
                  type="button"
                  onClick={() => setSelectedRaceName(race.name)}
                  className={cn(
                    "flex min-h-[88px] items-center gap-3 rounded-lg border bg-card p-3 text-left transition hover:border-accent/70",
                    selected ? "border-accent ring-2 ring-accent/30" : "border-border/70"
                  )}
                >
                  <RacePortrait race={race} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="break-words text-sm font-semibold leading-tight text-foreground">{race.name}</p>
                      <span className="shrink-0 rounded-full bg-surface-muted px-2 py-1 text-xs font-bold text-foreground">
                        {formatPercent(chance)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">{race.rarity}</p>
                    <p className="mt-1 line-clamp-1 text-xs font-semibold text-muted">{race.keepPriority}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-lg border border-accent/40 bg-accent/10 p-4">
            <div className="flex items-start justify-between gap-3">
              {selectedRace ? (
                <div className="flex min-w-0 items-center gap-3">
                  <RacePortrait race={selectedRace} size="lg" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-accent">Target race</p>
                    <p className="truncate text-base font-semibold text-foreground">{selectedRace.name}</p>
                    <p className="text-xs text-muted">{selectedRace.rollChance} base chance</p>
                  </div>
                </div>
              ) : null}
              <Target className="mt-1 h-4 w-4 shrink-0 text-accent" aria-hidden />
            </div>
            <p className="mt-3 text-4xl font-black text-foreground">{formatPercent(chanceWithRerolls)}</p>
            <p className="mt-1 text-sm text-muted">Chance after {rerolls.toLocaleString()} rerolls</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/70 bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Dices className="h-4 w-4" aria-hidden />
                Average
              </div>
              <p className="mt-3 text-2xl font-black text-foreground">
                {expectedRolls ? `${Math.ceil(expectedRolls).toLocaleString()} rolls` : "Unknown"}
              </p>
            </div>

            <div className="rounded-lg border border-border/70 bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <TrendingUp className="h-4 w-4" aria-hidden />
                Miss chance
              </div>
              <p className="mt-3 text-2xl font-black text-foreground">{formatPercent(missChance)}</p>
            </div>
          </div>

          {selectedRace ? (
            <div className="rounded-lg border border-border/70 bg-card p-4">
              <h3 className="text-base font-semibold text-foreground">Keep call</h3>
              <p className="mt-1 text-sm font-semibold text-foreground">{selectedRace.keepPriority}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-md bg-surface px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Best for</p>
                  <p className="mt-1 line-clamp-2 text-sm font-semibold text-foreground">{selectedRace.bestFor}</p>
                </div>
                <div className="rounded-md bg-surface px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Limit</p>
                  <p className="mt-1 line-clamp-2 text-sm font-semibold text-foreground">{selectedRace.mainLimit}</p>
                </div>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-muted">{selectedRace.coreBonus}</p>
              {selectedRace.passive ? <p className="mt-1 line-clamp-2 text-sm text-muted">{selectedRace.passive}</p> : null}
            </div>
          ) : null}

          <div className="rounded-lg border border-border/70 bg-card p-4">
            <h3 className="text-base font-semibold text-foreground">Rerolls to feel safer</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {milestoneRows.map((row) => (
                <div key={row.target} className="rounded-md bg-surface px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{formatPercent(row.target)} chance</p>
                  <p className="mt-1 text-lg font-black text-foreground">
                    {row.rolls ? row.rolls.toLocaleString() : "Unknown"}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">Uses the listed base chance only. Luck boosts or pity would change the result.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
