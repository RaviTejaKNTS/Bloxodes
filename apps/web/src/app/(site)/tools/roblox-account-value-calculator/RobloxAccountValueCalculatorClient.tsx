"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, BadgeCheck, Calculator, ExternalLink, Loader2, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { calculateDevexPayout } from "@/lib/devex/calculator";
import { DEVEX_MIN } from "@/lib/devex/constants";
import {
  calculateRapConcentration,
  calculateVisibleRobuxTotal,
  getInventoryValueState,
  parseManualRobux
} from "@/lib/roblox-account-value";
import type {
  InventoryStatus,
  ProfileResponse,
  ProfileResponseOk,
  ProfileSuggestion
} from "@/lib/roblox-profile-checker";

const fullNumber = new Intl.NumberFormat("en-US");
const compactNumber = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const STATUS_COPY: Record<
  ReturnType<typeof getInventoryValueState>,
  { label: string; className: string; description: string }
> = {
  complete: {
    label: "Complete public inventory",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    description: "The public collectible pages checked did not report more items."
  },
  partial: {
    label: "Partial public inventory",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
    description: "The RAP shown is a minimum based on the collectibles Roblox returned."
  },
  private: {
    label: "Private inventory",
    className: "border-border bg-surface-muted text-muted",
    description: "Roblox says this inventory is private, so public RAP cannot be calculated."
  },
  unavailable: {
    label: "Inventory unavailable",
    className: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    description: "Roblox did not return inventory data. This is not treated as a zero value."
  },
  empty: {
    label: "No public collectibles",
    className: "border-border bg-surface-muted text-muted",
    description: "The public inventory lookup succeeded and returned no limited collectibles."
  }
};

function formatRobux(value: number | null) {
  return value === null ? "Not available" : `R$ ${fullNumber.format(value)}`;
}

function formatCheckedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Checked recently";
  return `Profile data from ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function accountAge(created: string | null) {
  if (!created) return "Not available";
  const date = new Date(created);
  if (Number.isNaN(date.getTime())) return "Not available";
  const years = Math.max(0, Math.floor((Date.now() - date.getTime()) / (365.2425 * 24 * 60 * 60 * 1000)));
  return `${years} ${years === 1 ? "year" : "years"}`;
}

function statusForInventory(status: InventoryStatus) {
  if (status === "private") return "private_inventory";
  if (status === "unavailable") return "inventory_unavailable";
  return "public_inventory";
}

function ValueCard({ label, value, note, emphasized = false }: { label: string; value: string; note: string; emphasized?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${emphasized ? "border-accent/40 bg-accent/5" : "border-border bg-surface"}`}>
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted">{note}</p>
    </div>
  );
}

export function RobloxAccountValueCalculatorClient() {
  const [username, setUsername] = useState("");
  const [currentBalance, setCurrentBalance] = useState("");
  const [earnedRobux, setEarnedRobux] = useState("");
  const [result, setResult] = useState<ProfileResponseOk | null>(null);
  const [suggestions, setSuggestions] = useState<ProfileSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const requestSequence = useRef(0);

  const balance = useMemo(() => parseManualRobux(currentBalance), [currentBalance]);
  const earned = useMemo(() => parseManualRobux(earnedRobux), [earnedRobux]);
  const inventoryState = result ? getInventoryValueState(result.collectibles) : null;
  const publicRap = result?.collectibles.status === "public" ? result.collectibles.totalRap : null;
  const visibleTotal = calculateVisibleRobuxTotal(publicRap, balance.value);
  const devex = earned.value === null ? null : calculateDevexPayout(earned.value);
  const concentration = result
    ? calculateRapConcentration(result.collectibles.items, result.collectibles.totalRap)
    : null;

  async function lookup(value: string, { scroll = false }: { scroll?: boolean } = {}) {
    const trimmed = value.trim().replace(/^@+/, "");
    if (!trimmed) {
      setError("Enter a Roblox username to check.");
      setResult(null);
      setSuggestions([]);
      return;
    }
    if (balance.error || earned.error) {
      setError("Fix the optional Robux fields before checking this profile.");
      return;
    }

    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    setLoading(true);
    setError(null);
    setSuggestions([]);

    try {
      const params = new URLSearchParams({ username: trimmed });
      const response = await fetch(`/api/roblox-profile-checker?${params}`);
      const payload = (await response.json()) as ProfileResponse;
      if (requestSequence.current !== sequence) return;

      if (!payload.ok) {
        setError(`${payload.error.message}${payload.error.hint ? ` ${payload.error.hint}` : ""}`);
        setSuggestions(payload.suggestions ?? []);
        setResult(null);
        return;
      }

      setResult(payload);
      const url = new URL(window.location.href);
      url.searchParams.set("username", payload.profile.username);
      window.history.replaceState(null, "", url.toString());
      if (scroll) {
        requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
    } catch {
      if (requestSequence.current !== sequence) return;
      setError("Bloxodes could not reach Roblox. Try again in a moment.");
      setResult(null);
    } finally {
      if (requestSequence.current === sequence) setLoading(false);
    }
  }

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("username");
    if (fromUrl?.trim()) {
      setUsername(fromUrl.trim());
      void lookup(fromUrl.trim());
    }
    // Query-string lookups start after hydration while the complete form remains server rendered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void lookup(username, { scroll: true });
  }

  function handleSuggestion(value: string) {
    setUsername(value);
    void lookup(value, { scroll: true });
  }

  function resetProfile() {
    requestSequence.current += 1;
    setResult(null);
    setSuggestions([]);
    setError(null);
    setUsername("");
    const url = new URL(window.location.href);
    url.searchParams.delete("username");
    window.history.replaceState(null, "", url.toString());
  }

  return (
    <div className="tool-surface space-y-6">
      <form onSubmit={handleSubmit} className="panel space-y-5 p-5 sm:p-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">Check a Roblox profile&apos;s visible value</h2>
          <p className="text-sm leading-6 text-muted">
            This measures public collectible RAP and optional numbers you enter. It is not an account sale price, and
            ordinary Roblox account sales are prohibited.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="min-w-0 flex-1 space-y-2">
            <span className="text-sm font-semibold text-foreground">Roblox username</span>
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="For example, builderman"
              autoComplete="off"
              spellCheck={false}
              maxLength={21}
              className="h-12 rounded-full px-5"
            />
          </label>
          <Button type="submit" disabled={loading} className="mt-auto h-12 rounded-full px-6">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {loading ? "Checking..." : "Check visible value"}
          </Button>
        </div>

        <details className="rounded-2xl border border-border bg-surface-muted/40 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">Add your own numbers (optional)</summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">Current Robux balance</span>
              <Input
                value={currentBalance}
                onChange={(event) => setCurrentBalance(event.target.value)}
                inputMode="numeric"
                placeholder="Not publicly available"
                autoComplete="off"
              />
              <span className="block text-xs leading-5 text-muted">Self-entered and kept in this browser tab only.</span>
              {balance.error ? <span className="block text-xs text-rose-600 dark:text-rose-400">{balance.error}</span> : null}
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">Earned Robux for DevEx</span>
              <Input
                value={earnedRobux}
                onChange={(event) => setEarnedRobux(event.target.value)}
                inputMode="numeric"
                placeholder={`Minimum ${fullNumber.format(DEVEX_MIN)}`}
                autoComplete="off"
              />
              <span className="block text-xs leading-5 text-muted">Use only Robux you believe qualifies as Earned Robux.</span>
              {earned.error ? <span className="block text-xs text-rose-600 dark:text-rose-400">{earned.error}</span> : null}
            </label>
          </div>
          <p className="mt-4 text-xs leading-5 text-muted">
            These values are calculated locally. They are not sent with the Roblox username lookup, stored, or added
            together in a way that double-counts Earned Robux.
          </p>
        </details>
      </form>

      {error ? (
        <div role="alert" className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
          <div className="flex gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>{error}</p></div>
          {suggestions.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <Button key={suggestion.username} type="button" variant="outline" size="sm" className="rounded-full" onClick={() => handleSuggestion(suggestion.username)}>
                  @{suggestion.username}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {result && inventoryState ? (
        <div ref={resultRef} className="space-y-6" data-inventory-state={statusForInventory(result.collectibles.status)}>
          <section className="panel p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              {result.profile.headshotUrl ? (
                <img src={result.profile.headshotUrl} alt={`${result.profile.username} Roblox avatar`} className="h-20 w-20 rounded-2xl bg-surface-muted object-cover" />
              ) : (
                <div className="h-20 w-20 rounded-2xl bg-surface-muted" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-2xl font-semibold text-foreground">{result.profile.displayName}</h2>
                  {result.profile.hasVerifiedBadge ? <BadgeCheck className="h-5 w-5 text-sky-500" aria-label="Verified" /> : null}
                  {result.profile.isBanned ? <span className="rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300">Banned</span> : null}
                </div>
                <p className="text-sm text-muted">@{result.profile.username} · User ID {fullNumber.format(result.profile.userId)}</p>
                <p className="mt-2 text-sm text-muted">{formatCheckedAt(result.checkedAt)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="rounded-full" onClick={() => void lookup(result.profile.username)}>
                  <RefreshCw className="h-4 w-4" /> Recheck
                </Button>
                <Button type="button" variant="ghost" className="rounded-full" onClick={resetProfile}>Check another</Button>
              </div>
            </div>
            <div className={`mt-5 rounded-xl border px-4 py-3 ${STATUS_COPY[inventoryState].className}`}>
              <p className="text-sm font-semibold">{STATUS_COPY[inventoryState].label}</p>
              <p className="mt-1 text-xs leading-5">{STATUS_COPY[inventoryState].description}</p>
            </div>
          </section>

          <section aria-labelledby="value-summary" className="space-y-3">
            <div>
              <h2 id="value-summary" className="text-2xl font-semibold text-foreground">Visible value summary</h2>
              <p className="mt-1 text-sm text-muted">Only public RAP and the optional balance you entered are included.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <ValueCard
                label="Public inventory RAP"
                value={inventoryState === "partial" && publicRap !== null ? `At least ${formatRobux(publicRap)}` : formatRobux(publicRap)}
                note={
                  inventoryState === "private"
                    ? "Hidden by the account's inventory privacy setting."
                    : inventoryState === "unavailable"
                      ? "Roblox did not return enough inventory data to calculate RAP."
                      : "Sum of recentAveragePrice for the public collectibles successfully checked."
                }
                emphasized={balance.value === null}
              />
              {balance.value !== null ? (
                <ValueCard label="Robux balance you entered" value={formatRobux(balance.value)} note="Self-entered and not verified by Bloxodes or Roblox." />
              ) : null}
              {visibleTotal !== null ? (
                <ValueCard
                  label="Visible Robux total"
                  value={`${inventoryState === "partial" ? "At least " : ""}${formatRobux(visibleTotal)}`}
                  note="Public collectible RAP + self-entered balance. This is not a cash value or account sale price."
                  emphasized
                />
              ) : null}
            </div>
          </section>

          {devex ? (
            <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <Calculator className="mt-1 h-5 w-5 text-accent" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-semibold text-foreground">Earned Robux DevEx estimate</h2>
                  <p className="mt-2 text-3xl font-semibold text-foreground">{usd.format(devex.usd)}</p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Based only on the {formatRobux(earned.value)} you identified as Earned Robux. It is separate from
                    RAP and your generic balance. {devex.eligible ? "The amount meets the numerical minimum." : `It is ${fullNumber.format(devex.shortfallRobux)} Earned Robux below the numerical minimum.`} Roblox reviews all eligibility.
                  </p>
                  <a href="/tools/roblox-devex-calculator" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
                    Open the full DevEx calculator <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Public inventory breakdown</h2>
              <p className="mt-1 text-sm text-muted">
                {result.collectibles.status === "public"
                  ? `${result.collectibles.hasMore ? `${fullNumber.format(result.collectibles.fetchedItemCount)}+` : fullNumber.format(result.collectibles.fetchedItemCount)} collectibles checked${concentration !== null ? ` · top 5 represent ${concentration}% of fetched RAP` : ""}.`
                  : "No public collectible breakdown is available for this lookup."}
              </p>
            </div>
            {result.collectibles.items.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {result.collectibles.items.slice(0, 12).map((item, index) => (
                  <a
                    key={`${item.assetId}-${item.serialNumber ?? "copy"}-${index}`}
                    href={`https://www.roblox.com/catalog/${item.assetId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="group rounded-2xl border border-border bg-surface p-3 transition hover:border-accent"
                  >
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="mx-auto h-24 w-24 rounded-xl bg-surface-muted object-contain" loading="lazy" />
                    ) : (
                      <div className="mx-auto h-24 w-24 rounded-xl bg-surface-muted" aria-hidden />
                    )}
                    <p className="mt-3 line-clamp-2 text-sm font-semibold text-foreground group-hover:text-accent">{item.name}</p>
                    <p className="mt-1 text-xs text-muted">
                      {item.recentAveragePrice === null ? "RAP unavailable" : `${formatRobux(item.recentAveragePrice)} RAP`}
                      {item.serialNumber ? ` · #${item.serialNumber}` : ""}
                    </p>
                  </a>
                ))}
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Profile context</h2>
              <p className="mt-1 text-sm text-muted">These public facts describe the profile. They do not add monetary value to the calculation.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ["Account age", accountAge(result.profile.created)],
                ["Followers", result.stats.followers === null ? "Unavailable" : compactNumber.format(result.stats.followers)],
                ["Friends", result.stats.friends === null ? "Unavailable" : compactNumber.format(result.stats.friends)],
                ["Experience visits", result.stats.totalPlaceVisits === null ? "Unavailable" : compactNumber.format(result.stats.totalPlaceVisits)],
                ["Created experiences", fullNumber.format(result.createdGames.length)],
                ["Groups", fullNumber.format(result.groups.length)],
                ["Roblox badges", fullNumber.format(result.robloxBadges.length)],
                ["Previous usernames", fullNumber.format(result.previousUsernames.length)]
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-border bg-surface p-4">
                  <p className="text-xl font-semibold text-foreground">{value}</p>
                  <p className="mt-1 text-xs text-muted">{label}</p>
                </div>
              ))}
            </div>
          </section>

          {result.warnings.length ? (
            <div role="status" className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
              <p className="font-semibold">Some Roblox data may be incomplete</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className="rounded-full">
              <a href={`/tools/roblox-profile-checker?username=${encodeURIComponent(result.profile.username)}`}>View full profile check</a>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <a href={result.profileUrl} target="_blank" rel="noreferrer">Open Roblox profile <ExternalLink className="h-4 w-4" /></a>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
