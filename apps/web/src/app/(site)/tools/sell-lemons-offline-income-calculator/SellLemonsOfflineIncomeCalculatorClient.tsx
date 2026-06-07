'use client';

import { FormEvent, useMemo, useState } from "react";
import { trackEvent } from "@/lib/analytics";

const cashFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2
});

const compactCashFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2
});

const timeFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1
});

function parseInput(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function formatCash(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  if (value >= 1_000_000) return `$${compactCashFormat.format(value)}`;
  return `$${cashFormat.format(value)}`;
}

function formatRate(value: number): string {
  return `${formatCash(value)}/s`;
}

function formatDuration(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "Not enough income yet";
  if (hours < 1) return `${timeFormat.format(hours * 60)} min`;
  if (hours < 24) return `${timeFormat.format(hours)} hr`;
  const days = hours / 24;
  return `${timeFormat.format(days)} days`;
}

function multiplierFromBonus(percent: number): number {
  return 1 + percent / 100;
}

function ResultCard({
  label,
  value,
  detail,
  tone = "default"
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "accent" | "warning";
}) {
  const toneClass =
    tone === "accent"
      ? "border-accent/40 bg-accent/5"
      : tone === "warning"
        ? "border-amber-400/40 bg-amber-400/10"
        : "border-border/60 bg-surface";

  return (
    <div className={`rounded-lg border px-4 py-4 shadow-soft ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold leading-tight text-foreground">{value}</p>
      <p className="mt-2 text-sm text-muted">{detail}</p>
    </div>
  );
}

export function SellLemonsOfflineIncomeCalculatorClient() {
  const [incomePerSecondInput, setIncomePerSecondInput] = useState("1000000");
  const [offlineHoursInput, setOfflineHoursInput] = useState("8");
  const [baseMultiplierInput, setBaseMultiplierInput] = useState("1");
  const [boostMultiplierInput, setBoostMultiplierInput] = useState("1");
  const [investorBonusInput, setInvestorBonusInput] = useState("0");
  const [targetCashInput, setTargetCashInput] = useState("100000000");

  const incomePerSecond = parseInput(incomePerSecondInput);
  const offlineHours = parseInput(offlineHoursInput);
  const baseMultiplier = parseInput(baseMultiplierInput) || 1;
  const boostMultiplier = parseInput(boostMultiplierInput) || 1;
  const investorBonus = Math.max(0, Number(investorBonusInput) || 0);
  const targetCash = parseInput(targetCashInput);

  const result = useMemo(() => {
    const investorMultiplier = multiplierFromBonus(investorBonus);
    const effectiveIncomePerSecond = incomePerSecond * baseMultiplier * boostMultiplier * investorMultiplier;
    const incomePerHour = effectiveIncomePerSecond * 3600;
    const offlineEarnings = incomePerHour * offlineHours;
    const timeToTargetHours = targetCash > 0 && incomePerHour > 0 ? targetCash / incomePerHour : 0;
    const targetReached = targetCash > 0 && offlineEarnings >= targetCash;

    return {
      investorMultiplier,
      effectiveIncomePerSecond,
      incomePerHour,
      offlineEarnings,
      timeToTargetHours,
      targetReached
    };
  }, [incomePerSecond, baseMultiplier, boostMultiplier, investorBonus, offlineHours, targetCash]);

  function commitInputs(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIncomePerSecondInput(incomePerSecondInput.trim());
    setOfflineHoursInput(offlineHoursInput.trim());
    setBaseMultiplierInput(baseMultiplierInput.trim());
    setBoostMultiplierInput(boostMultiplierInput.trim());
    setInvestorBonusInput(investorBonusInput.trim());
    setTargetCashInput(targetCashInput.trim());
    trackEvent("calculator_input_commit", {
      tool_code: "sell-lemons-offline-income-calculator",
      offline_hours: offlineHours,
      has_target: targetCash > 0
    });
  }

  return (
    <div className="tool-surface space-y-8">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <form onSubmit={commitInputs} className="panel space-y-5 p-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Estimate offline cash</h2>
            <p className="text-sm text-muted">
              Enter the income rate your game shows, then add only the multipliers you want included in the estimate.
            </p>
          </div>

          <label className="flex flex-col gap-2 rounded-lg border border-border/60 bg-surface px-4 py-3 shadow-soft">
            <span className="text-sm font-semibold text-foreground">Income per second</span>
            <input
              aria-label="Income per second"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={incomePerSecondInput}
              onChange={(event) => setIncomePerSecondInput(event.target.value)}
              className="w-full rounded-md border border-border/60 bg-white/5 px-3 py-2 text-base text-foreground outline-none ring-2 ring-transparent transition focus:ring-accent/50 dark:bg-white/10"
              placeholder="Use the rate shown in game"
            />
            <span className="text-xs text-muted">Use your current visible rate. The calculator does not infer hidden income formulas.</span>
          </label>

          <label className="flex flex-col gap-2 rounded-lg border border-border/60 bg-surface px-4 py-3 shadow-soft">
            <span className="text-sm font-semibold text-foreground">Offline time in hours</span>
            <input
              aria-label="Offline time in hours"
              type="number"
              min={0}
              step="0.25"
              inputMode="decimal"
              value={offlineHoursInput}
              onChange={(event) => setOfflineHoursInput(event.target.value)}
              className="w-full rounded-md border border-border/60 bg-white/5 px-3 py-2 text-base text-foreground outline-none ring-2 ring-transparent transition focus:ring-accent/50 dark:bg-white/10"
              placeholder="Example: 8"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 rounded-lg border border-border/60 bg-surface px-4 py-3 shadow-soft">
              <span className="text-sm font-semibold text-foreground">Base multiplier</span>
              <input
                aria-label="Base multiplier"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={baseMultiplierInput}
                onChange={(event) => setBaseMultiplierInput(event.target.value)}
                className="w-full rounded-md border border-border/60 bg-white/5 px-3 py-2 text-base text-foreground outline-none ring-2 ring-transparent transition focus:ring-accent/50 dark:bg-white/10"
                placeholder="1"
              />
              <span className="text-xs text-muted">Use 1 if your income/sec already includes it.</span>
            </label>

            <label className="flex flex-col gap-2 rounded-lg border border-border/60 bg-surface px-4 py-3 shadow-soft">
              <span className="text-sm font-semibold text-foreground">Boost multiplier</span>
              <input
                aria-label="Boost multiplier"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={boostMultiplierInput}
                onChange={(event) => setBoostMultiplierInput(event.target.value)}
                className="w-full rounded-md border border-border/60 bg-white/5 px-3 py-2 text-base text-foreground outline-none ring-2 ring-transparent transition focus:ring-accent/50 dark:bg-white/10"
                placeholder="1"
              />
              <span className="text-xs text-muted">Use 1 if no timed boost should be counted.</span>
            </label>
          </div>

          <label className="flex flex-col gap-2 rounded-lg border border-border/60 bg-surface px-4 py-3 shadow-soft">
            <span className="text-sm font-semibold text-foreground">Investor bonus percent</span>
            <input
              aria-label="Investor bonus percent"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={investorBonusInput}
              onChange={(event) => setInvestorBonusInput(event.target.value)}
              className="w-full rounded-md border border-border/60 bg-white/5 px-3 py-2 text-base text-foreground outline-none ring-2 ring-transparent transition focus:ring-accent/50 dark:bg-white/10"
              placeholder="Example: 350"
            />
            <span className="text-xs text-muted">A 350% bonus is treated as 4.5x for this estimate.</span>
          </label>

          <label className="flex flex-col gap-2 rounded-lg border border-border/60 bg-surface px-4 py-3 shadow-soft">
            <span className="text-sm font-semibold text-foreground">Optional target cash</span>
            <input
              aria-label="Optional target cash"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={targetCashInput}
              onChange={(event) => setTargetCashInput(event.target.value)}
              className="w-full rounded-md border border-border/60 bg-white/5 px-3 py-2 text-base text-foreground outline-none ring-2 ring-transparent transition focus:ring-accent/50 dark:bg-white/10"
              placeholder="Leave blank if you only want earnings"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-accent/90 dark:bg-accent-dark"
          >
            Update estimate
          </button>
        </form>

        <div className="panel flex h-full flex-col gap-5 p-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Estimated result</h2>
            <p className="text-sm text-muted">
              This is simple planning math from the values you entered. Check the game after logging back in before spending around the exact number.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ResultCard
              label="Offline earnings"
              value={formatCash(result.offlineEarnings)}
              detail={`For ${timeFormat.format(offlineHours || 0)} offline hours.`}
              tone="accent"
            />
            <ResultCard
              label="Income per hour"
              value={formatCash(result.incomePerHour)}
              detail={`Based on ${formatRate(result.effectiveIncomePerSecond)} effective income.`}
            />
            <ResultCard
              label="Effective income"
              value={formatRate(result.effectiveIncomePerSecond)}
              detail={`Includes ${timeFormat.format(baseMultiplier)}x base, ${timeFormat.format(boostMultiplier)}x boost, and ${timeFormat.format(result.investorMultiplier)}x investor math.`}
            />
            <ResultCard
              label="Time to target"
              value={targetCash > 0 ? formatDuration(result.timeToTargetHours) : "No target set"}
              detail={
                targetCash > 0
                  ? result.targetReached
                    ? `Your offline window reaches ${formatCash(targetCash)} by this estimate.`
                    : `Target: ${formatCash(targetCash)}.`
                  : "Enter a target to compare your return time."
              }
              tone={targetCash > 0 && !result.targetReached ? "warning" : "default"}
            />
          </div>

          <div className="rounded-lg border border-border/60 bg-background/60 px-4 py-4 text-sm text-muted">
            Sell Lemons can keep earning while you are away, but this calculator does not know whether a timed boost expires offline, whether your session applies a cap, or whether your displayed rate already includes a multiplier. Use the result as a planning estimate.
          </div>
        </div>
      </section>
    </div>
  );
}
