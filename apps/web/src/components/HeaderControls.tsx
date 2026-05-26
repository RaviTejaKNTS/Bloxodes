"use client";

import { type CSSProperties, type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  BarChart3,
  BookOpen,
  Calendar,
  FileText,
  Home,
  KeyRound,
  LayoutGrid,
  List,
  Menu,
  Search,
  SquareCheckBig,
  User,
  Wrench,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  useSidebar
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { formatUpdatedLabel } from "@/lib/updated-label";

const navLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/codes", label: "Codes", icon: KeyRound },
  { href: "/lists", label: "Lists", icon: List },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/wiki", label: "Wiki", icon: BookOpen },
  { href: "/tools", label: "Tools", icon: Wrench },
  { href: "/catalog", label: "Catalog", icon: LayoutGrid },
  { href: "/checklists", label: "Checklists", icon: SquareCheckBig },
  { href: "/events", label: "Events", icon: Calendar },
  { href: "/articles", label: "Articles", icon: FileText },
  { href: "/quizzes", label: "Quizzes", icon: Award }
];

type SearchItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  url: string;
  type: "codes" | "article" | "checklist" | "quiz" | "list" | "stats" | "tool" | "catalog" | "event" | "author" | "music" | "wiki";
  updatedAt?: string | null;
  badge?: string | null;
};

const MIN_QUERY_LENGTH = 2;
const SEARCH_LIMIT = 60;
const DEBOUNCE_MS = 250;

function resolveSearchScope(pathname: string | null): { scope: string; label: string } {
  const path = pathname ?? "/";
  if (
    path === "/" ||
    path.startsWith("/about") ||
    path.startsWith("/contact") ||
    path.startsWith("/privacy-policy") ||
    path.startsWith("/terms-of-service") ||
    path.startsWith("/disclaimer") ||
    path.startsWith("/editorial-guidelines") ||
    path.startsWith("/how-we-gather-and-verify-codes")
  ) {
    return { scope: "global", label: "Bloxodes" };
  }
  if (path.startsWith("/codes")) return { scope: "codes", label: "codes" };
  if (path.startsWith("/lists")) return { scope: "lists", label: "lists" };
  if (path.startsWith("/stats")) return { scope: "stats", label: "stats" };
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
        className={cn("hidden w-auto shrink-0 dark:block", className)}
      />
      <Image
        src="/Bloxodes-light.png"
        alt="Bloxodes"
        width={948}
        height={319}
        loading="lazy"
        fetchPriority="low"
        className={cn("block w-auto shrink-0 dark:hidden", className)}
      />
    </Link>
  );
}

function MobileMenuButton() {
  const { setOpenMobile } = useSidebar();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setOpenMobile(true)}
      aria-label="Open menu"
      className="h-10 w-10 rounded-md text-foreground hover:bg-transparent hover:text-accent"
    >
      <Menu aria-hidden className="h-5 w-5" />
    </Button>
  );
}

type SidebarBodyProps = {
  accountAvatar: string | null;
  accountHref: string;
  accountLabel: string;
  canSearch: boolean;
  clearSearch: () => void;
  error: string | null;
  isSignedIn: boolean;
  loading: boolean;
  pathname: string | null;
  query: string;
  results: SearchItem[];
  searchActive: boolean;
  searchScope: { scope: string; label: string };
  setQuery: Dispatch<SetStateAction<string>>;
  trimmedQuery: string;
};

function SidebarBody({
  accountAvatar,
  accountHref,
  accountLabel,
  canSearch,
  clearSearch,
  error,
  isSignedIn,
  loading,
  pathname,
  query,
  results,
  searchActive,
  searchScope,
  setQuery,
  trimmedQuery
}: SidebarBodyProps) {
  const { isMobile, setOpenMobile } = useSidebar();
  const closeIfMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname?.startsWith(`${href}/`));

  const accountContent = (
    <>
      {accountAvatar ? (
        <img
          src={accountAvatar}
          alt=""
          aria-hidden="true"
          className="h-[26px] w-[26px] rounded-full border border-sidebar-border object-cover"
          loading="lazy"
        />
      ) : (
        <span className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-foreground/70">
          <User aria-hidden className="h-4 w-4" />
        </span>
      )}
      <span className="min-w-0 truncate">{isSignedIn ? accountLabel : "Sign in"}</span>
    </>
  );

  return (
    <>
      <SidebarHeader className="gap-0 px-3 pb-2 pt-5">
        <div className="relative flex min-h-11 items-center justify-center">
          <LogoMark className="h-10" />
          {isMobile ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setOpenMobile(false)}
              aria-label="Close menu"
              className="absolute right-0 h-9 w-9 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <X aria-hidden className="h-4 w-4" />
            </Button>
          ) : null}
        </div>

        <div className="relative mt-4">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sidebar-foreground/45" />
          <SidebarInput
            type="text"
            inputMode="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${searchScope.label}`}
            aria-label={`Search ${searchScope.label}`}
            className="h-[34px] rounded-lg border-transparent bg-sidebar-accent/50 pl-8 pr-8 text-[13px] font-medium text-sidebar-foreground shadow-none placeholder:text-sidebar-foreground/45 hover:bg-sidebar-accent/70 focus-visible:bg-sidebar focus-visible:ring-1"
          />
          {query ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={clearSearch}
              aria-label="Clear search"
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <X aria-hidden className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 pb-3">
        {searchActive ? (
          <SidebarGroup className="min-h-0 flex-1 px-1">
            <div className="mb-2 px-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-sidebar-foreground/45">
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
            <SidebarGroupContent>
              {!canSearch ? (
                <Card className="rounded-lg border-0 bg-sidebar-accent/50 px-3 py-2 text-[13px] leading-5 text-muted-foreground shadow-none">
                  Type at least 2 characters to search.
                </Card>
              ) : error ? (
                <Card className="rounded-lg border-0 bg-sidebar-accent/50 px-3 py-2 text-[13px] leading-5 text-muted-foreground shadow-none">
                  {error}
                </Card>
              ) : loading && results.length === 0 ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="h-10 animate-pulse rounded-lg bg-sidebar-accent/70" />
                  ))}
                </div>
              ) : results.length ? (
                <SidebarMenu className="gap-1">
                  {results.map((item, index) => {
                    const updatedLabel = item.updatedAt ? formatUpdatedLabel(item.updatedAt) : null;
                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          asChild
                          size="lg"
                          className="h-auto items-start rounded-lg px-2.5 py-2.5 hover:bg-sidebar-accent"
                        >
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
                              closeIfMobile();
                            }}
                          >
                            <span className="block min-w-0">
                              <span className="block truncate text-[13px] font-medium leading-5 text-sidebar-foreground">{item.title}</span>
                              <span className="block truncate text-[11px] font-normal leading-4 text-sidebar-foreground/50">
                                {item.subtitle ?? item.type}
                                {item.badge ? ` • ${item.badge}` : ""}
                                {updatedLabel ? ` • ${updatedLabel}` : ""}
                              </span>
                            </span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              ) : (
                <Card className="rounded-lg border-0 bg-sidebar-accent/50 px-3 py-2 text-[13px] leading-5 text-muted-foreground shadow-none">
                  Try another keyword.
                </Card>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <SidebarGroup className="px-1">
            <SidebarGroupLabel className="h-6 px-2 text-[11px] font-medium uppercase tracking-[0.12em] text-sidebar-foreground/40">
              Browse
            </SidebarGroupLabel>
            <SidebarMenu className="gap-1">
              {navLinks.map((link) => {
                const active = isActive(link.href);
                return (
                  <SidebarMenuItem key={link.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      size="lg"
                      className={cn(
                        "h-9 gap-2.5 rounded-lg px-2.5 text-[13px] font-semibold text-sidebar-foreground/68 [&>svg]:h-[18px] [&>svg]:w-[18px]",
                        active
                          ? "bg-sidebar-accent/85 text-sidebar-foreground"
                          : "hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                      )}
                    >
                      <Link
                        href={link.href}
                        onClick={closeIfMobile}
                        aria-current={active ? "page" : undefined}
                      >
                        <link.icon aria-hidden className="h-3.5 w-3.5" />
                        <span>{link.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            <SidebarSeparator className="mx-2 my-2" />
            <Button
              asChild
              variant="ghost"
              className="h-9 w-full justify-start gap-2.5 rounded-lg px-2.5 text-[13px] font-semibold text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <Link href={accountHref} aria-label={accountLabel} title={accountLabel} onClick={closeIfMobile}>
                {accountContent}
              </Link>
            </Button>
            <div className="flex h-9 items-center justify-between gap-2 rounded-lg px-2.5 hover:bg-sidebar-accent">
              <span className="text-[13px] font-semibold text-sidebar-foreground/70">Theme</span>
              <ThemeToggle className="h-[26px] w-[26px] border-sidebar-border bg-transparent shadow-none hover:translate-y-0 hover:bg-sidebar-accent [&_svg]:h-3.5 [&_svg]:w-3.5" />
            </div>
          </SidebarGroup>
        )}
      </SidebarContent>
    </>
  );
}

export function HeaderControls() {
  const pathname = usePathname();
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

  const clearSearch = () => setQuery("");

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
        // Ignore avatar fetch failures; the sign-in affordance still works.
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

  return (
    <SidebarProvider className="contents" style={{ "--sidebar-width": "15.5rem" } as CSSProperties}>
      <Sidebar className="z-40 border-r border-sidebar-border/80 bg-sidebar shadow-none">
        <SidebarBody
          accountAvatar={accountAvatar}
          accountHref={accountHref}
          accountLabel={accountLabel}
          canSearch={canSearch}
          clearSearch={clearSearch}
          error={error}
          isSignedIn={isSignedIn}
          loading={loading}
          pathname={pathname}
          query={query}
          results={results}
          searchActive={searchActive}
          searchScope={searchScope}
          setQuery={setQuery}
          trimmedQuery={trimmedQuery}
        />
      </Sidebar>

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur xl:hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <MobileMenuButton />
          <LogoMark className="h-8" />
        </div>
      </header>
    </SidebarProvider>
  );
}
