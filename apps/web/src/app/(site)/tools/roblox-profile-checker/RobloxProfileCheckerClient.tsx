"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type ProfileCore = {
  userId: number;
  username: string;
  displayName: string;
  description: string | null;
  created: string | null;
  isBanned: boolean;
  hasVerifiedBadge: boolean;
  avatarUrl: string | null;
  headshotUrl: string | null;
};

type ProfileStats = {
  friends: number | null;
  followers: number | null;
  following: number | null;
  totalPlaceVisits: number | null;
};

type PresenceStatus = "offline" | "online" | "in-game" | "in-studio" | "invisible";

type PresenceInfo = {
  status: PresenceStatus;
  lastLocation: string | null;
};

type WornItem = {
  assetId: number;
  name: string;
  assetType: string;
  imageUrl: string | null;
};

type CollectibleItem = {
  assetId: number;
  name: string;
  recentAveragePrice: number | null;
  serialNumber: number | null;
  imageUrl: string | null;
};

type CollectiblesInfo = {
  canView: boolean;
  totalRap: number | null;
  rapIsPartial: boolean;
  itemCount: number;
  items: CollectibleItem[];
};

type GroupMembership = {
  groupId: number;
  name: string;
  memberCount: number | null;
  role: string | null;
  rank: number | null;
  hasVerifiedBadge: boolean;
  imageUrl: string | null;
};

type PlatformBadge = {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
};

type GameEntry = {
  universeId: number;
  rootPlaceId: number | null;
  name: string;
  placeVisits: number | null;
  imageUrl: string | null;
};

type ProfileResponseOk = {
  ok: true;
  profile: ProfileCore;
  stats: ProfileStats;
  presence: PresenceInfo | null;
  previousUsernames: string[];
  wearing: WornItem[];
  collectibles: CollectiblesInfo;
  groups: GroupMembership[];
  robloxBadges: PlatformBadge[];
  socialLinks: Record<string, string>;
  createdGames: GameEntry[];
  favoriteGames: GameEntry[];
  profileUrl: string;
  warnings: string[];
};

type ProfileSuggestion = {
  username: string;
  displayName: string;
  hasVerifiedBadge: boolean;
};

type ProfileResponseError = {
  ok: false;
  error: { code: string; message: string; hint?: string };
  suggestions?: ProfileSuggestion[];
};

type ProfileResponse = ProfileResponseOk | ProfileResponseError;

const PRESENCE_STYLES: Record<PresenceStatus, { label: string; dot: string }> = {
  offline: { label: "Offline", dot: "bg-slate-400" },
  online: { label: "Online", dot: "bg-sky-500" },
  "in-game": { label: "Playing now", dot: "bg-emerald-500" },
  "in-studio": { label: "In Roblox Studio", dot: "bg-amber-500" },
  invisible: { label: "Offline", dot: "bg-slate-400" }
};

const SOCIAL_LABELS: Record<string, string> = {
  facebook: "Facebook",
  twitter: "X (Twitter)",
  youtube: "YouTube",
  twitch: "Twitch",
  guilded: "Guilded"
};

const compactNumber = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const fullNumber = new Intl.NumberFormat("en-US");

function formatCompact(value: number | null): string {
  if (value === null) return "N/A";
  return compactNumber.format(value);
}

function formatFull(value: number | null): string {
  if (value === null) return "Not available";
  return fullNumber.format(value);
}

function formatJoinDate(iso: string | null): { date: string; age: string } | null {
  if (!iso) return null;
  const created = new Date(iso);
  if (Number.isNaN(created.getTime())) return null;
  const date = created.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const now = new Date();
  let months = (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth());
  if (now.getDate() < created.getDate()) months -= 1;
  months = Math.max(0, months);
  const years = Math.floor(months / 12);
  const restMonths = months % 12;

  let age: string;
  if (years <= 0 && restMonths <= 0) {
    age = "this month";
  } else if (years <= 0) {
    age = `${restMonths} ${restMonths === 1 ? "month" : "months"} ago`;
  } else if (restMonths === 0) {
    age = `${years} ${years === 1 ? "year" : "years"} ago`;
  } else {
    age = `${years} ${years === 1 ? "year" : "years"}, ${restMonths} ${restMonths === 1 ? "month" : "months"} ago`;
  }

  return { date, age };
}

function VerifiedBadge() {
  return (
    <svg
      aria-label="Verified"
      role="img"
      className="h-5 w-5 shrink-0 text-sky-500"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 2 9.1 4.6l-3.9.4-.4 3.9L2 12l2.8 3.1.4 3.9 3.9.4L12 22l3.1-2.6 3.9-.4.4-3.9L22 12l-2.6-3.1-.4-3.9-3.9-.4L12 2Zm-1.2 13.6-3.2-3.2 1.4-1.4 1.8 1.8 4.2-4.2 1.4 1.4-5.6 5.6Z" />
    </svg>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-2xl font-semibold text-foreground">{children}</h2>;
}

function StatBlock({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-3 text-center" title={title}>
      <span className="text-2xl font-semibold text-foreground">{value}</span>
      <span className="text-sm text-muted">{label}</span>
    </div>
  );
}

export function RobloxProfileCheckerClient() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ProfileSuggestion[]>([]);
  const [result, setResult] = useState<ProfileResponseOk | null>(null);
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");
  const resultRef = useRef<HTMLDivElement | null>(null);
  const requestSeq = useRef(0);

  async function lookup(username: string, { scroll = false }: { scroll?: boolean } = {}) {
    const trimmed = username.trim().replace(/^@+/, "");
    if (!trimmed) {
      setError("Enter a Roblox username to check.");
      setSuggestions([]);
      setResult(null);
      return;
    }

    const seq = requestSeq.current + 1;
    requestSeq.current = seq;
    setLoading(true);
    setError(null);
    setSuggestions([]);
    setShareState("idle");

    try {
      const params = new URLSearchParams({ username: trimmed });
      const response = await fetch(`/api/roblox-profile-checker?${params}`);
      const payload = (await response.json()) as ProfileResponse;
      if (requestSeq.current !== seq) return;

      if (!payload.ok) {
        const hint = payload.error.hint ? ` ${payload.error.hint}` : "";
        setError(`${payload.error.message}${hint}`);
        setSuggestions(payload.suggestions ?? []);
        setResult(null);
        return;
      }

      setResult(payload);
      const url = new URL(window.location.href);
      url.searchParams.set("username", payload.profile.username);
      window.history.replaceState(null, "", url.toString());
      if (scroll) {
        requestAnimationFrame(() => {
          resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    } catch (err) {
      if (requestSeq.current !== seq) return;
      console.error("Profile lookup failed", err);
      setError("Could not reach the profile checker. Try again.");
      setResult(null);
    } finally {
      if (requestSeq.current === seq) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("username");
    if (fromUrl?.trim()) {
      setInput(fromUrl.trim());
      void lookup(fromUrl.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void lookup(input, { scroll: true });
  }

  function handleSuggestion(username: string) {
    setInput(username);
    void lookup(username, { scroll: true });
  }

  async function handleShare() {
    if (!result) return;
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set("username", result.profile.username);
    const shareUrl = url.toString();
    const shareData = {
      title: `${result.profile.displayName} on Roblox`,
      text: `Check out ${result.profile.displayName} (@${result.profile.username}) on Roblox`,
      url: shareUrl
    };
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // fall through to clipboard copy
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareState("copied");
      setTimeout(() => setShareState("idle"), 2000);
    } catch (err) {
      console.error("Share failed", err);
    }
  }

  const joined = useMemo(() => formatJoinDate(result?.profile.created ?? null), [result]);
  const presence = result?.presence ? PRESENCE_STYLES[result.presence.status] : null;
  const socialEntries = result
    ? Object.entries(result.socialLinks).filter(([, value]) => /^https?:\/\//i.test(value))
    : [];

  return (
    <div className="tool-surface space-y-8">
      <form onSubmit={handleSubmit} className="panel space-y-4 p-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">Look up any Roblox profile</h2>
          <p className="text-sm text-muted">
            Enter a username to see the account&apos;s avatar, join date, social stats, groups, limiteds, and more in one
            card.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="w-full rounded-full border border-border/60 bg-white/5 px-5 py-3 text-base text-foreground outline-none ring-2 ring-transparent transition focus:ring-accent/50 dark:bg-white/10"
            placeholder="Roblox username, for example builderman"
            autoComplete="off"
            spellCheck={false}
            maxLength={20}
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-70 dark:bg-accent-dark dark:hover:bg-accent"
          >
            {loading ? "Checking..." : "Check profile"}
          </button>
        </div>
      </form>

      {error ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          <p>{error}</p>
          {suggestions.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.username}
                  type="button"
                  onClick={() => handleSuggestion(suggestion.username)}
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-accent"
                >
                  @{suggestion.username}
                  {suggestion.hasVerifiedBadge ? <VerifiedBadge /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {result ? (
        <div ref={resultRef} className="space-y-8">
          <section className="panel overflow-hidden">
            <div className="bg-gradient-to-br from-accent/15 via-accent/5 to-transparent px-6 pt-8 sm:px-8">
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-end">
                {result.profile.avatarUrl ? (
                  <img
                    src={result.profile.avatarUrl}
                    alt={`${result.profile.displayName}'s Roblox avatar`}
                    className="h-44 w-44 shrink-0 drop-shadow-lg sm:h-52 sm:w-52"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-44 w-44 shrink-0 items-center justify-center rounded-2xl bg-surface-muted text-sm text-muted">
                    No avatar
                  </div>
                )}
                <div className="w-full space-y-2 pb-6 text-center sm:text-left">
                  <div className="flex items-center justify-center gap-2 sm:justify-start">
                    <h2 className="text-3xl font-semibold text-foreground">{result.profile.displayName}</h2>
                    {result.profile.hasVerifiedBadge ? <VerifiedBadge /> : null}
                  </div>
                  <p className="text-base text-muted">@{result.profile.username}</p>
                  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted sm:justify-start">
                    {presence ? (
                      <span className="inline-flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${presence.dot}`} aria-hidden />
                        {presence.label}
                      </span>
                    ) : null}
                    {joined ? (
                      <span>
                        Joined {joined.date} ({joined.age})
                      </span>
                    ) : null}
                    {result.profile.isBanned ? (
                      <span className="font-semibold text-red-500">Account terminated</span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-border/40 border-t border-border/40 sm:grid-cols-4">
              <StatBlock label="Friends" value={formatCompact(result.stats.friends)} title={formatFull(result.stats.friends)} />
              <StatBlock
                label="Followers"
                value={formatCompact(result.stats.followers)}
                title={formatFull(result.stats.followers)}
              />
              <StatBlock
                label="Following"
                value={formatCompact(result.stats.following)}
                title={formatFull(result.stats.following)}
              />
              <StatBlock
                label="Place visits"
                value={formatCompact(result.stats.totalPlaceVisits)}
                title={formatFull(result.stats.totalPlaceVisits)}
              />
            </div>

            {result.profile.description ? (
              <p className="whitespace-pre-line border-t border-border/40 px-6 py-4 text-sm leading-relaxed text-muted sm:px-8">
                {result.profile.description}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 px-6 py-4 sm:px-8">
              <div className="flex flex-wrap gap-2">
                {socialEntries.map(([key, url]) => (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noreferrer nofollow"
                    className="inline-flex items-center rounded-full border border-border/60 bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-accent"
                  >
                    {SOCIAL_LABELS[key] ?? key}
                  </a>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-accent-dark dark:bg-accent-dark dark:hover:bg-accent"
                >
                  <svg aria-hidden className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
                  </svg>
                  {shareState === "copied" ? "Link copied" : "Share this card"}
                </button>
                <a
                  href={result.profileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-full border border-border/60 bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:border-accent"
                >
                  Open on Roblox
                </a>
              </div>
            </div>
          </section>

          {result.warnings.length ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
              <ul className="space-y-1">
                {result.warnings.map((warning, idx) => (
                  <li key={`${warning}-${idx}`}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.previousUsernames.length ? (
            <section className="space-y-4">
              <SectionHeading>Past usernames</SectionHeading>
              <div className="flex flex-wrap gap-2">
                {result.previousUsernames.map((name) => (
                  <span key={name} className="chip">
                    {name}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {result.wearing.length ? (
            <section className="space-y-4">
              <SectionHeading>Currently wearing</SectionHeading>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {result.wearing.map((item) => (
                  <a
                    key={item.assetId}
                    href={`https://www.roblox.com/catalog/${item.assetId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="group rounded-2xl border border-border/60 bg-surface p-3 transition hover:border-accent"
                  >
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="mx-auto h-24 w-24 rounded-xl bg-surface-muted object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <div className="mx-auto h-24 w-24 rounded-xl bg-surface-muted" aria-hidden />
                    )}
                    <p className="mt-2 line-clamp-2 text-sm font-semibold text-foreground group-hover:text-accent">
                      {item.name}
                    </p>
                    <p className="text-xs text-muted">{item.assetType}</p>
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-4">
            <SectionHeading>Limiteds and RAP</SectionHeading>
            {result.collectibles.canView ? (
              result.collectibles.itemCount > 0 ? (
                <>
                  <p className="text-sm text-muted">
                    {formatFull(result.collectibles.itemCount)} limited {result.collectibles.itemCount === 1 ? "item" : "items"}{" "}
                    worth a combined recent average price of{" "}
                    <span className="font-semibold text-foreground">
                      {formatFull(result.collectibles.totalRap)} Robux
                    </span>
                    {result.collectibles.rapIsPartial ? " (large inventory, totals cover the first 300 items)" : ""}.
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {result.collectibles.items.map((item) => (
                      <a
                        key={item.assetId}
                        href={`https://www.roblox.com/catalog/${item.assetId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="group rounded-2xl border border-border/60 bg-surface p-3 transition hover:border-accent"
                      >
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="mx-auto h-24 w-24 rounded-xl bg-surface-muted object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <div className="mx-auto h-24 w-24 rounded-xl bg-surface-muted" aria-hidden />
                        )}
                        <p className="mt-2 line-clamp-2 text-sm font-semibold text-foreground group-hover:text-accent">
                          {item.name}
                        </p>
                        <p className="text-xs text-muted">
                          {item.recentAveragePrice !== null ? `${formatFull(item.recentAveragePrice)} Robux` : "No RAP"}
                          {item.serialNumber !== null ? ` · #${item.serialNumber}` : ""}
                        </p>
                      </a>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted">This account does not own any limited items yet.</p>
              )
            ) : (
              <p className="text-sm text-muted">
                This account keeps its inventory private, so limited items and RAP are hidden.
              </p>
            )}
          </section>

          {result.groups.length ? (
            <section className="space-y-4">
              <SectionHeading>Groups</SectionHeading>
              <div className="grid gap-3 md:grid-cols-2">
                {result.groups.map((group) => (
                  <a
                    key={group.groupId}
                    href={`https://www.roblox.com/communities/${group.groupId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-surface p-3 transition hover:border-accent"
                  >
                    {group.imageUrl ? (
                      <img
                        src={group.imageUrl}
                        alt={`${group.name} group icon`}
                        className="h-12 w-12 shrink-0 rounded-xl bg-surface-muted object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-12 w-12 shrink-0 rounded-xl bg-surface-muted" aria-hidden />
                    )}
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground group-hover:text-accent">
                        {group.name}
                        {group.hasVerifiedBadge ? <VerifiedBadge /> : null}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {group.role ? `${group.role} · ` : ""}
                        {group.memberCount !== null ? `${formatCompact(group.memberCount)} members` : "Member"}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          {result.robloxBadges.length ? (
            <section className="space-y-4">
              <SectionHeading>Roblox badges</SectionHeading>
              <div className="flex flex-wrap gap-3">
                {result.robloxBadges.map((badge) => (
                  <div
                    key={badge.id}
                    title={badge.description ?? badge.name}
                    className="flex items-center gap-2 rounded-full border border-border/60 bg-surface py-1.5 pl-1.5 pr-4"
                  >
                    {badge.imageUrl ? (
                      <img src={badge.imageUrl} alt="" aria-hidden className="h-8 w-8 rounded-full" loading="lazy" />
                    ) : null}
                    <span className="text-sm font-semibold text-foreground">{badge.name}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {result.createdGames.length ? (
            <section className="space-y-4">
              <SectionHeading>Created experiences</SectionHeading>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {result.createdGames.map((game) => (
                  <a
                    key={game.universeId}
                    href={
                      game.rootPlaceId
                        ? `https://www.roblox.com/games/${game.rootPlaceId}`
                        : `https://www.roblox.com/games?universeId=${game.universeId}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="group rounded-2xl border border-border/60 bg-surface p-3 transition hover:border-accent"
                  >
                    {game.imageUrl ? (
                      <img
                        src={game.imageUrl}
                        alt={`${game.name} icon`}
                        className="aspect-square w-full rounded-xl bg-surface-muted object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="aspect-square w-full rounded-xl bg-surface-muted" aria-hidden />
                    )}
                    <p className="mt-2 line-clamp-2 text-sm font-semibold text-foreground group-hover:text-accent">
                      {game.name}
                    </p>
                    {game.placeVisits !== null ? (
                      <p className="text-xs text-muted">{formatCompact(game.placeVisits)} visits</p>
                    ) : null}
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          {result.favoriteGames.length ? (
            <section className="space-y-4">
              <SectionHeading>Favorite experiences</SectionHeading>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {result.favoriteGames.map((game) => (
                  <a
                    key={game.universeId}
                    href={
                      game.rootPlaceId
                        ? `https://www.roblox.com/games/${game.rootPlaceId}`
                        : `https://www.roblox.com/games?universeId=${game.universeId}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="group rounded-2xl border border-border/60 bg-surface p-3 transition hover:border-accent"
                  >
                    {game.imageUrl ? (
                      <img
                        src={game.imageUrl}
                        alt={`${game.name} icon`}
                        className="aspect-square w-full rounded-xl bg-surface-muted object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="aspect-square w-full rounded-xl bg-surface-muted" aria-hidden />
                    )}
                    <p className="mt-2 line-clamp-2 text-sm font-semibold text-foreground group-hover:text-accent">
                      {game.name}
                    </p>
                  </a>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
