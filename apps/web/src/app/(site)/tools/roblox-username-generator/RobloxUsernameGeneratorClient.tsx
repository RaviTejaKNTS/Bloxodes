"use client";

import {
  FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { AlertCircle, Check, Copy, Loader2, Pin, RefreshCw, Shuffle, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ROBLOX_USERNAME_VIBES,
  type RobloxUsernameVibe
} from "@/data/roblox-username-parts";
import type {
  CheckedUsernameResult,
  RobloxUsernameValidationStatus,
  UsernamePreference
} from "@/lib/roblox-username-generator";

type GenerateResponse =
  | {
      ok: true;
      results: CheckedUsernameResult[];
      attempted: number;
      exhausted: boolean;
      warnings: string[];
      retryAfterSeconds?: number | null;
    }
  | ApiErrorResponse;

type CheckResponse = { ok: true; result: CheckedUsernameResult } | ApiErrorResponse;

type ApiErrorResponse = {
  ok: false;
  error: { code: string; message: string; retryAfterSeconds?: number | null };
};

const PIN_STORAGE_KEY = "bloxodes:roblox-username-generator:pins";
const DEFAULT_RESULT_COUNT = 12;
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 20;
const VIBE_LABELS: Record<RobloxUsernameVibe, string> = {
  any: "Any",
  cool: "Cool",
  cute: "Cute",
  aesthetic: "Aesthetic",
  funny: "Funny",
  fantasy: "Fantasy",
  space: "Space",
  nature: "Nature",
  sporty: "Sporty",
  competitive: "Competitive",
  classic: "Classic"
};

const STATUS_STYLES: Record<RobloxUsernameValidationStatus, string> = {
  available: "text-emerald-600 dark:text-emerald-400",
  taken: "text-rose-600 dark:text-rose-400",
  inappropriate: "text-amber-700 dark:text-amber-400",
  invalid: "text-amber-700 dark:text-amber-400",
  unverified: "text-muted"
};

function checkedTime(value: string | null): string {
  if (!value) return "Not verified";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Checked recently";
  return `Checked ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function resultKey(result: CheckedUsernameResult): string {
  return result.username.toLowerCase();
}

export function RobloxUsernameGeneratorClient() {
  const [keyword, setKeyword] = useState("");
  const [vibes, setVibes] = useState<RobloxUsernameVibe[]>(["any"]);
  const [minLength, setMinLength] = useState(8);
  const [maxLength, setMaxLength] = useState(14);
  const [preference, setPreference] = useState<UsernamePreference>("balanced");
  const [allowNumbers, setAllowNumbers] = useState(true);
  const [allowUnderscore, setAllowUnderscore] = useState(false);
  const [alliteration, setAlliteration] = useState(false);
  const [mustIncludeKeyword, setMustIncludeKeyword] = useState(true);
  const [results, setResults] = useState<CheckedUsernameResult[]>([]);
  const [pinnedNames, setPinnedNames] = useState<string[]>([]);
  const [pinsReady, setPinsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rechecking, setRechecking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [activeRemix, setActiveRemix] = useState<string | null>(null);
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const lengthTrackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(PIN_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as unknown;
        if (Array.isArray(parsed)) {
          setPinnedNames(
            parsed.filter((value): value is string => typeof value === "string" && /^[A-Za-z0-9_]{3,20}$/.test(value)).slice(0, 20)
          );
        }
      }
    } catch {
      // Saved pins are optional. A blocked or malformed localStorage value should not break the tool.
    } finally {
      setPinsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!pinsReady) return;
    try {
      window.localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(pinnedNames));
    } catch {
      // The generator remains fully usable when localStorage is unavailable.
    }
  }, [pinnedNames, pinsReady]);

  const pinnedSet = useMemo(() => new Set(pinnedNames.map((name) => name.toLowerCase())), [pinnedNames]);
  const pinnedResults = useMemo(() => results.filter((result) => pinnedSet.has(resultKey(result))), [pinnedSet, results]);

  function toggleVibe(vibe: RobloxUsernameVibe) {
    setVibes((current) => {
      if (vibe === "any") return ["any"];
      const withoutAny = current.filter((item) => item !== "any");
      if (withoutAny.includes(vibe)) {
        const next = withoutAny.filter((item) => item !== vibe);
        return next.length ? next : ["any"];
      }
      return [...withoutAny, vibe].slice(0, 4);
    });
  }

  async function requestGeneration({ mode = "generate", sourceUsername = "" }: { mode?: "generate" | "remix"; sourceUsername?: string } = {}) {
    const pinned = mode === "generate" ? results.filter((result) => pinnedSet.has(resultKey(result))) : [];
    setLoading(true);
    setError(null);
    setWarnings([]);
    setCopiedName(null);
    setActiveRemix(mode === "remix" ? sourceUsername : null);

    try {
      const response = await fetch("/api/roblox-username-generator", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          sourceUsername,
          keyword,
          vibes,
          minLength,
          maxLength,
          allowNumbers,
          allowUnderscore,
          alliteration,
          mustIncludeKeyword: Boolean(keyword) && mustIncludeKeyword,
          preference,
          amount: mode === "generate" ? Math.max(4, DEFAULT_RESULT_COUNT - pinned.length) : DEFAULT_RESULT_COUNT
        })
      });
      const payload = (await response.json()) as GenerateResponse;
      if (!payload.ok) {
        setError(payload.error.message);
        return;
      }

      const seen = new Set(pinned.map(resultKey));
      const next = [
        ...pinned,
        ...payload.results.filter((result) => {
          const key = resultKey(result);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
      ].slice(0, DEFAULT_RESULT_COUNT);
      setResults(next);
      setWarnings(payload.warnings ?? []);
    } catch {
      setError("Could not reach the username checker. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void requestGeneration();
  }

  async function handleRecheck(username: string) {
    setRechecking(username.toLowerCase());
    setError(null);
    try {
      const response = await fetch("/api/roblox-username-generator", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "check", username })
      });
      const payload = (await response.json()) as CheckResponse;
      if (!payload.ok) {
        setError(payload.error.message);
        return;
      }
      setResults((current) =>
        current.map((result) =>
          result.username.toLowerCase() === username.toLowerCase()
            ? { ...payload.result, tags: result.tags }
            : result
        )
      );
    } catch {
      setError("Could not recheck this username with Roblox.");
    } finally {
      setRechecking(null);
    }
  }

  async function copyName(username: string) {
    try {
      await navigator.clipboard.writeText(username);
      setCopiedName(username.toLowerCase());
      window.setTimeout(() => setCopiedName(null), 1600);
    } catch {
      setError("Your browser could not copy the username. Select it and copy it manually.");
    }
  }

  async function copyPinned() {
    if (!pinnedResults.length) return;
    try {
      await navigator.clipboard.writeText(pinnedResults.map((result) => result.username).join("\n"));
      setCopiedName("__pinned__");
      window.setTimeout(() => setCopiedName(null), 1600);
    } catch {
      setError("Your browser could not copy the pinned names.");
    }
  }

  function togglePin(username: string) {
    setPinnedNames((current) => {
      const key = username.toLowerCase();
      return current.some((name) => name.toLowerCase() === key)
        ? current.filter((name) => name.toLowerCase() !== key)
        : [...current, username].slice(0, 20);
    });
  }

  function clearTool() {
    setKeyword("");
    setVibes(["any"]);
    setMinLength(8);
    setMaxLength(14);
    setPreference("balanced");
    setAllowNumbers(true);
    setAllowUnderscore(false);
    setAlliteration(false);
    setMustIncludeKeyword(true);
    setResults([]);
    setPinnedNames([]);
    setWarnings([]);
    setError(null);
    setActiveRemix(null);
  }

  function clampLength(value: number) {
    return Math.min(MAX_USERNAME_LENGTH, Math.max(MIN_USERNAME_LENGTH, value));
  }

  function updateLengthThumb(thumb: "min" | "max", value: number) {
    const next = clampLength(value);
    if (thumb === "min") {
      setMinLength(Math.min(next, maxLength - 1));
      return;
    }
    setMaxLength(Math.max(next, minLength + 1));
  }

  function lengthFromClientX(clientX: number) {
    const track = lengthTrackRef.current;
    if (!track) return null;
    const bounds = track.getBoundingClientRect();
    if (!bounds.width) return null;
    const ratio = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width));
    return Math.round(MIN_USERNAME_LENGTH + ratio * (MAX_USERNAME_LENGTH - MIN_USERNAME_LENGTH));
  }

  function handleThumbPointerDown(thumb: "min" | "max", event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const value = lengthFromClientX(event.clientX);
    if (value !== null) updateLengthThumb(thumb, value);
  }

  function handleThumbPointerMove(thumb: "min" | "max", event: ReactPointerEvent<HTMLButtonElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const value = lengthFromClientX(event.clientX);
    if (value !== null) updateLengthThumb(thumb, value);
  }

  function handleTrackPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const value = lengthFromClientX(event.clientX);
    if (value === null) return;
    updateLengthThumb(
      Math.abs(value - minLength) <= Math.abs(value - maxLength) ? "min" : "max",
      value
    );
  }

  function handleThumbKeyDown(thumb: "min" | "max", event: ReactKeyboardEvent<HTMLButtonElement>) {
    const current = thumb === "min" ? minLength : maxLength;
    const lowerBound = thumb === "min" ? MIN_USERNAME_LENGTH : minLength + 1;
    const upperBound = thumb === "min" ? maxLength - 1 : MAX_USERNAME_LENGTH;
    let next: number | null = null;

    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = current - 1;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next = current + 1;
    if (event.key === "PageDown") next = current - 5;
    if (event.key === "PageUp") next = current + 5;
    if (event.key === "Home") next = lowerBound;
    if (event.key === "End") next = upperBound;
    if (next === null) return;

    event.preventDefault();
    updateLengthThumb(thumb, Math.min(upperBound, Math.max(lowerBound, next)));
  }

  const scarcityHint = maxLength <= 5
    ? "Names this short are extremely scarce. Allowing numbers or choosing a longer maximum will return more options."
    : null;
  const minLengthPosition = ((minLength - MIN_USERNAME_LENGTH) / (MAX_USERNAME_LENGTH - MIN_USERNAME_LENGTH)) * 100;
  const maxLengthPosition = ((maxLength - MIN_USERNAME_LENGTH) / (MAX_USERNAME_LENGTH - MIN_USERNAME_LENGTH)) * 100;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-background shadow-soft">
      <div className="grid lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
        <form onSubmit={handleSubmit} className="space-y-6 p-5 md:p-6 lg:border-r lg:border-border">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">Build your username shortlist</h2>
            <p className="text-sm leading-relaxed text-muted">
              Add a safe nickname or theme word, choose the feel, and we will check the strongest ideas with Roblox.
            </p>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-foreground">Keyword or nickname <span className="font-normal text-muted">(optional)</span></span>
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              maxLength={12}
              autoComplete="off"
              placeholder="Nova, Panda, Racer"
              className="h-11 bg-background"
            />
            <span className="block text-xs leading-relaxed text-muted">
              Use one safe word. Do not enter your real full name, birthday, email, phone number, school, or address.
            </span>
          </label>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-foreground">Choose up to four vibes</legend>
            <div className="flex flex-wrap gap-2">
              {ROBLOX_USERNAME_VIBES.map((vibe) => {
                const checked = vibes.includes(vibe);
                return (
                  <label
                    key={vibe}
                    className={`cursor-pointer rounded-md border px-3 py-2 text-sm transition focus-within:ring-2 focus-within:ring-accent/50 ${
                      checked ? "border-accent bg-accent/10 text-foreground" : "border-border bg-surface/40 text-muted hover:text-foreground"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => toggleVibe(vibe)}
                    />
                    {VIBE_LABELS[vibe]}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-foreground">Username length</span>
              <output className="rounded-md border border-border bg-surface/50 px-2.5 py-1 text-sm font-medium tabular-nums text-foreground" aria-live="polite">
                {minLength}–{maxLength} characters
              </output>
            </div>

            <div
              ref={lengthTrackRef}
              className="relative h-8 touch-none select-none"
              role="group"
              aria-label="Username length range"
              data-testid="username-length-slider"
              onPointerDown={handleTrackPointerDown}
            >
              <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-muted" />
              <div
                className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-accent"
                style={{ left: `${minLengthPosition}%`, width: `${maxLengthPosition - minLengthPosition}%` }}
              />
              <button
                type="button"
                role="slider"
                aria-valuemin={MIN_USERNAME_LENGTH}
                aria-valuemax={maxLength - 1}
                aria-valuenow={minLength}
                aria-valuetext={`Minimum ${minLength} characters`}
                aria-label="Minimum username length"
                className="absolute top-1/2 z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-2 border-background bg-accent shadow-md outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                style={{ left: `${minLengthPosition}%` }}
                onPointerDown={(event) => handleThumbPointerDown("min", event)}
                onPointerMove={(event) => handleThumbPointerMove("min", event)}
                onKeyDown={(event) => handleThumbKeyDown("min", event)}
              />
              <button
                type="button"
                role="slider"
                aria-valuemin={minLength + 1}
                aria-valuemax={MAX_USERNAME_LENGTH}
                aria-valuenow={maxLength}
                aria-valuetext={`Maximum ${maxLength} characters`}
                aria-label="Maximum username length"
                className="absolute top-1/2 z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-2 border-background bg-accent shadow-md outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                style={{ left: `${maxLengthPosition}%` }}
                onPointerDown={(event) => handleThumbPointerDown("max", event)}
                onPointerMove={(event) => handleThumbPointerMove("max", event)}
                onKeyDown={(event) => handleThumbKeyDown("max", event)}
              />
            </div>

            <div className="flex justify-between text-xs tabular-nums text-muted" aria-hidden="true">
              <span>{MIN_USERNAME_LENGTH}</span>
              <span>{MAX_USERNAME_LENGTH}</span>
            </div>
          </div>
          {scarcityHint ? <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">{scarcityHint}</p> : null}

          <label className="block space-y-2">
            <span className="text-sm font-medium text-foreground">Name preference</span>
            <select
              value={preference}
              onChange={(event) => setPreference(event.target.value as UsernamePreference)}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="clean">Clean: easier to read</option>
              <option value="balanced">Balanced</option>
              <option value="unique">Unique: more variations</option>
            </select>
          </label>

          <details className="border-t border-border pt-4">
            <summary className="cursor-pointer text-sm font-medium text-foreground">More options</summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { label: "Allow numbers", checked: allowNumbers, change: setAllowNumbers },
                { label: "Allow one underscore", checked: allowUnderscore, change: setAllowUnderscore },
                { label: "Alliteration", checked: alliteration, change: setAlliteration },
                { label: "Must include keyword", checked: mustIncludeKeyword, change: setMustIncludeKeyword, disabled: !keyword }
              ].map((option) => (
                <label key={option.label} className="flex items-center gap-3 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={option.checked}
                    disabled={option.disabled}
                    onChange={(event) => option.change(event.target.checked)}
                    className="h-4 w-4 rounded border-border accent-accent disabled:opacity-40"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </details>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" className="h-11" disabled={loading || minLength > maxLength}>
              {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
              {loading ? "Checking with Roblox" : results.length ? "Generate more" : "Generate usernames"}
            </Button>
            {(results.length > 0 || keyword) ? (
              <Button type="button" variant="outline" className="h-11" onClick={clearTool} disabled={loading}>
                <X aria-hidden="true" />
                Clear
              </Button>
            ) : null}
          </div>
        </form>

        <div className="min-w-0 bg-surface/30 p-5 md:p-6" aria-live="polite" aria-busy={loading}>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold text-foreground">
                {activeRemix ? `Remixes for ${activeRemix}` : "Available username ideas"}
              </h2>
              <p className="text-sm text-muted">Availability can change at any time. Recheck before you finish on Roblox.</p>
            </div>
            {pinnedResults.length ? (
              <Button type="button" variant="outline" size="sm" onClick={() => void copyPinned()}>
                <Copy aria-hidden="true" />
                {copiedName === "__pinned__" ? "Copied" : `Copy pinned (${pinnedResults.length})`}
              </Button>
            ) : null}
          </div>

          {error ? (
            <div className="mt-4 flex gap-3 rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-foreground" role="alert">
              <AlertCircle className="mt-0.5 shrink-0 text-rose-500" aria-hidden="true" />
              <p>{error}</p>
            </div>
          ) : null}

          {warnings.length ? (
            <div className="mt-4 space-y-1 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-foreground">
              {warnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          ) : null}

          {loading && !results.length ? (
            <div className="divide-y divide-border" aria-label="Checking username ideas">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="flex items-center justify-between gap-4 py-5">
                  <div className="space-y-2">
                    <div className="h-5 w-36 animate-pulse rounded bg-surface-muted" />
                    <div className="h-3 w-24 animate-pulse rounded bg-surface-muted" />
                  </div>
                  <div className="h-8 w-24 animate-pulse rounded bg-surface-muted" />
                </div>
              ))}
            </div>
          ) : results.length ? (
            <ul className="divide-y divide-border">
              {results.map((result) => {
                const key = resultKey(result);
                const pinned = pinnedSet.has(key);
                const checking = rechecking === key;
                return (
                  <li key={key} className="py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-lg font-semibold text-foreground">{result.username}</span>
                          {pinned ? <Pin className="size-4 shrink-0 fill-current text-accent" aria-label="Pinned" /> : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          <span className={`inline-flex items-center gap-1 font-medium ${STATUS_STYLES[result.status]}`}>
                            {result.status === "available" ? <Check className="size-3.5" aria-hidden="true" /> : <AlertCircle className="size-3.5" aria-hidden="true" />}
                            {result.message}
                          </span>
                          <span className="text-muted">{checkedTime(result.checkedAt)}</span>
                          <span className="text-muted">{result.length} characters</span>
                        </div>
                        {result.tags.length ? (
                          <div className="flex flex-wrap gap-2">
                            {result.tags.map((tag) => (
                              <span key={tag} className="rounded bg-surface-muted px-2 py-1 text-[11px] text-muted">{tag}</span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => togglePin(result.username)}>
                          <Pin aria-hidden="true" />
                          {pinned ? "Unpin" : "Pin"}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => void copyName(result.username)}>
                          <Copy aria-hidden="true" />
                          {copiedName === key ? "Copied" : "Copy"}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => void handleRecheck(result.username)} disabled={checking}>
                          <RefreshCw className={checking ? "animate-spin" : ""} aria-hidden="true" />
                          Recheck
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => void requestGeneration({ mode: "remix", sourceUsername: result.username })} disabled={loading}>
                          <Shuffle aria-hidden="true" />
                          Remix
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="space-y-5 py-8 md:py-12">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">Your checked shortlist will appear here</h3>
                <p className="max-w-xl text-sm leading-relaxed text-muted">
                  Start with no keyword for a broad mix, or add one word you want the names to remember. We only show green after Roblox accepts the username at check time.
                </p>
              </div>
              <ul className="grid gap-3 text-sm text-muted sm:grid-cols-2">
                <li className="border-l-2 border-border pl-3">3 to 20 characters</li>
                <li className="border-l-2 border-border pl-3">Letters, numbers, and one internal underscore</li>
                <li className="border-l-2 border-border pl-3">No password or Roblox login needed</li>
                <li className="border-l-2 border-border pl-3">Every green result checked live</li>
              </ul>
              <noscript>
                <p className="text-sm text-amber-700 dark:text-amber-300">JavaScript is required to generate and check usernames.</p>
              </noscript>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
