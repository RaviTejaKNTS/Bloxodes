"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FiBookOpen,
  FiCalendar,
  FiCheckSquare,
  FiAward,
  FiFileText,
  FiGrid,
  FiHome,
  FiKey,
  FiList,
  FiMenu,
  FiSearch,
  FiTool,
  FiUser,
  FiX
} from "react-icons/fi";
import { ThemeToggle } from "@/components/ThemeToggle";
import { trackEvent } from "@/lib/analytics";
import { formatUpdatedLabel } from "@/lib/updated-label";

const navLinks = [
  { href: "/", label: "Home", icon: FiHome },
  { href: "/codes", label: "Codes", icon: FiKey },
  { href: "/lists", label: "Lists", icon: FiList },
  { href: "/wiki", label: "Wiki", icon: FiBookOpen },
  { href: "/tools", label: "Tools", icon: FiTool },
  { href: "/catalog", label: "Catalog", icon: FiGrid },
  { href: "/checklists", label: "Checklists", icon: FiCheckSquare },
  { href: "/events", label: "Events", icon: FiCalendar },
  { href: "/articles", label: "Articles", icon: FiFileText },
  { href: "/quizzes", label: "Quizzes", icon: FiAward }
];

type SearchItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  url: string;
  type: "codes" | "article" | "checklist" | "quiz" | "list" | "tool" | "catalog" | "event" | "author" | "music" | "wiki";
  updatedAt?: string | null;
  badge?: string | null;
};

const MIN_QUERY_LENGTH = 2;
const SEARCH_LIMIT = 60;
const DEBOUNCE_MS = 250;

function resolveSearchScope(pathname: string | null): { scope: string; label: string } {
  const path = pathname ?? "/";
  if (path === "/" || path.startsWith("/about") || path.startsWith("/contact") || path.startsWith("/privacy-policy") || path.startsWith("/terms-of-service") || path.startsWith("/disclaimer") || path.startsWith("/editorial-guidelines") || path.startsWith("/how-we-gather-and-verify-codes")) {
    return { scope: "global", label: "Bloxodes" };
  }
  if (path.startsWith("/codes")) return { scope: "codes", label: "codes" };
  if (path.startsWith("/lists")) return { scope: "lists", label: "lists" };
  if (path.startsWith("/wiki")) return { scope: "wiki", label: "wiki" };
  if (path.startsWith("/tools")) return { scope: "tools", label: "tools" };
  if (path.startsWith("/catalog")) return { scope: "catalog", label: "catalog" };
  if (path.startsWith("/checklists")) return { scope: "checklists", label: "checklists" };
  if (path.startsWith("/events")) return { scope: "events", label: "events" };
  if (path.startsWith("/articles")) return { scope: "articles", label: "articles" };
  if (path.startsWith("/quizzes")) return { scope: "quizzes", label: "quizzes" };
  if (path.startsWith("/authors")) return { scope: "authors", label: "authors" };
  return { scope: "global", label: "Bloxodes" };
}

function LogoMark({ className = "h-9" }: { className?: string }) {
  return (
    <Link href="/" className="inline-flex items-center" aria-label="Bloxodes home">
      <Image
        src="/Bloxodes-dark.png"
        alt="Bloxodes"
        width={948}
        height={319}
        priority
        className={`hidden w-auto shrink-0 dark:block ${className}`}
      />
      <Image
        src="/Bloxodes-light.png"
        alt="Bloxodes"
        width={948}
        height={319}
        loading="lazy"
        fetchPriority="low"
        className={`block w-auto shrink-0 dark:hidden ${className}`}
      />
    </Link>
  );
}

export function HeaderControls() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [accountAvatar, setAccountAvatar] = useState<string | null>(null);
  const [accountLabel, setAccountLabel] = useState("Sign in");
  const [accountHref, setAccountHref] = useState("/login?next=%2Faccount");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastTrackedQuery = useRef<string | null>(null);

  const searchScope = resolveSearchScope(pathname);
  const trimmedQuery = query.trim();
  const searchActive = trimmedQuery.length > 0;
  const canSearch = trimmedQuery.length >= MIN_QUERY_LENGTH;

  const close = () => setOpen(false);
  const clearSearch = () => setQuery("");

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadAccountAvatar() {
      try {
        const res = await fetch("/api/account/avatar", { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          avatarUrl?: string | null;
          displayName?: string | null;
          signedIn?: boolean;
        };
        if (!active) return;
        const signedIn = data.signedIn === true;
        setIsSignedIn(signedIn);
        setAccountHref(signedIn ? "/account" : "/login?next=%2Faccount");
        if (signedIn) {
          setAccountAvatar(typeof data.avatarUrl === "string" ? data.avatarUrl : null);
          const label =
            typeof data.displayName === "string" && data.displayName.trim()
              ? data.displayName.trim()
              : "Account";
          setAccountLabel(label);
        } else {
          setAccountAvatar(null);
          setAccountLabel("Sign in");
        }
      } catch {
        // ignore avatar fetch failures
      }
    }

    loadAccountAvatar();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setQuery("");
    setResults([]);
    setError(null);
    setLoading(false);
    lastTrackedQuery.current = null;
  }, [pathname]);

  useEffect(() => {
    if (!canSearch) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    setResults([]);
    setError(null);

    let cancelled = false;
    let controller: AbortController | null = null;
    const timeout = setTimeout(async () => {
      try {
        setLoading(true);
        controller = new AbortController();
        const params = new URLSearchParams({
          q: trimmedQuery,
          limit: String(SEARCH_LIMIT),
          scope: searchScope.scope
        });
        const response = await fetch(`/api/search/all?${params.toString()}`, {
          signal: controller.signal
        });
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        const payload = (await response.json()) as { items?: SearchItem[] };
        if (!cancelled) {
          setResults(payload.items ?? []);
        }
      } catch (searchError) {
        if ((searchError as { name?: string }).name === "AbortError") return;
        if (!cancelled) {
          console.error("Failed to load sidebar search results", searchError);
          setResults([]);
          setError("Search is unavailable right now.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      if (controller && !controller.signal.aborted) {
        controller.abort("Sidebar search request was replaced");
      }
    };
  }, [canSearch, searchScope.scope, trimmedQuery]);

  useEffect(() => {
    if (!canSearch || loading) return;
    const key = `${searchScope.scope}:${trimmedQuery}`;
    if (lastTrackedQuery.current === key) return;
    lastTrackedQuery.current = key;
    trackEvent("search", {
      search_term: trimmedQuery,
      results_count: results.length,
      content_type: searchScope.scope
    });
  }, [canSearch, loading, results.length, searchScope.scope, trimmedQuery]);

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname?.startsWith(`${href}/`));

  const accountContent = (
    <>
      {accountAvatar ? (
        <img
          src={accountAvatar}
          alt=""
          aria-hidden="true"
          className="h-8 w-8 rounded-full border border-border/50 object-cover"
          loading="lazy"
        />
      ) : (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-surface-muted text-foreground">
          <FiUser aria-hidden className="h-4 w-4" />
        </span>
      )}
      <span className="min-w-0 truncate">{isSignedIn ? accountLabel : "Sign in"}</span>
    </>
  );

  const sidebarContent = (mobile = false) => (
    <>
      <div className="flex items-center justify-between gap-3">
        <LogoMark className="h-9" />
        {mobile ? (
          <button
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border/60 bg-surface-muted text-foreground transition hover:border-accent hover:text-accent"
          >
            <FiX aria-hidden className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <div className="relative mt-8">
        <FiSearch aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="text"
          inputMode="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${searchScope.label}`}
          aria-label={`Search ${searchScope.label}`}
          className="h-12 w-full rounded-lg border border-border/60 bg-background/70 px-10 text-sm font-semibold text-foreground outline-none transition placeholder:text-muted/75 focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        {query ? (
          <button
            type="button"
            onClick={clearSearch}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted transition hover:bg-surface-muted hover:text-foreground"
          >
            <FiX aria-hidden className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {searchActive ? (
        <div className="mt-5 flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            {!canSearch
              ? "Keep typing"
              : loading && results.length === 0
              ? "Searching"
              : error
                ? "Search unavailable"
                : results.length
                  ? `${results.length} result${results.length === 1 ? "" : "s"}`
                  : "No results"}
          </div>
          {!canSearch ? (
            <p className="rounded-lg border border-border/60 bg-background/50 px-3 py-3 text-sm text-muted">
              Type at least 2 characters to search.
            </p>
          ) : error ? (
            <p className="rounded-lg border border-border/60 bg-background/50 px-3 py-3 text-sm text-muted">{error}</p>
          ) : loading && results.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-14 animate-pulse rounded-lg border border-border/50 bg-surface-muted/70" />
              ))}
            </div>
          ) : results.length ? (
            <ul className="space-y-2">
              {results.map((item, index) => {
                const updatedLabel = item.updatedAt ? formatUpdatedLabel(item.updatedAt) : null;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.url}
                      onClick={() => {
                        trackEvent("search_result_click", {
                          search_term: trimmedQuery,
                          results_count: results.length,
                          content_type: item.type,
                          position: index + 1,
                          scope: searchScope.scope
                        });
                        if (mobile) close();
                      }}
                      className="block rounded-lg border border-border/60 bg-background/50 px-3 py-3 text-sm text-foreground transition hover:border-accent hover:text-accent"
                    >
                      <span className="block truncate font-semibold">{item.title}</span>
                      <span className="mt-1 block truncate text-xs text-muted">
                        {item.subtitle ?? item.type}
                        {item.badge ? ` • ${item.badge}` : ""}
                        {updatedLabel ? ` • ${updatedLabel}` : ""}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-lg border border-border/60 bg-background/50 px-3 py-3 text-sm text-muted">
              Try another keyword.
            </p>
          )}
        </div>
      ) : (
        <nav className="mt-6 flex flex-1 flex-col gap-1.5" aria-label="Primary">
          {navLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={mobile ? close : undefined}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "border border-accent/40 bg-accent/15 text-foreground"
                    : "border border-transparent text-muted hover:border-border/60 hover:bg-surface-muted/70 hover:text-foreground"
                }`}
              >
                <link.icon aria-hidden className="h-4 w-4 shrink-0" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      )}

      {!searchActive ? (
        <div className="mt-6 space-y-3 border-t border-border/60 pt-5">
          <Link
            href={accountHref}
            aria-label={accountLabel}
            title={accountLabel}
            onClick={mobile ? close : undefined}
            className="flex w-full items-center gap-3 rounded-lg border border-border/60 bg-background/55 px-3 py-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
          >
            {accountContent}
          </Link>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/35 px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      ) : null}
    </>
  );

  const mobileMenu = (
    <div
      className="fixed inset-0 z-[100000] bg-black/60 backdrop-blur-sm xl:hidden"
      role="dialog"
      aria-modal="true"
      onClick={close}
    >
      <aside
        id="site-menu-panel"
        className="flex h-full w-[86vw] max-w-[320px] flex-col overflow-y-auto border-r border-border/70 bg-surface/95 px-4 pb-32 pt-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {sidebarContent(true)}
      </aside>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col overflow-y-auto border-r border-border/60 bg-surface/95 px-5 pb-10 pt-6 shadow-soft xl:flex">
        {sidebarContent(false)}
      </aside>

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur xl:hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center text-foreground transition hover:text-accent"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-controls="site-menu-panel"
            aria-label="Open menu"
          >
            <FiMenu aria-hidden className="h-5 w-5" />
          </button>
          <LogoMark className="h-8" />
        </div>
      </header>

      {open && mounted ? createPortal(mobileMenu, document.body) : null}
    </>
  );
}
