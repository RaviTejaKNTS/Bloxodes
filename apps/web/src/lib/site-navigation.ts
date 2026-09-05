import type { LucideIcon } from "lucide-react";
import {
  Award,
  BarChart3,
  BookOpen,
  Calendar,
  FileText,
  Gamepad2,
  Home,
  KeyRound,
  LayoutGrid,
  Puzzle,
  SquareCheckBig,
  Wrench
} from "lucide-react";

export type SiteNavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type GtaWikiNavLink = Pick<SiteNavLink, "href" | "label">;

export type SearchItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  url: string;
  type: "codes" | "article" | "checklist" | "quiz" | "puzzle" | "stats" | "tool" | "catalog" | "event" | "author" | "music" | "wiki";
  updatedAt?: string | null;
  badge?: string | null;
};

export type SearchScope = {
  scope: string;
  label: string;
};

export type SidebarAccount = {
  avatarUrl: string | null;
  href: string;
  label: string;
  signedIn: boolean;
};

export const siteNavLinks: SiteNavLink[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/codes", label: "Codes", icon: KeyRound },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/wiki", label: "Wiki", icon: BookOpen },
  { href: "/tools", label: "Tools", icon: Wrench },
  { href: "/catalog", label: "Catalog", icon: LayoutGrid },
  { href: "/checklists", label: "Checklists", icon: SquareCheckBig },
  { href: "/events", label: "Events", icon: Calendar },
  { href: "/articles", label: "Articles", icon: FileText },
  { href: "/puzzles", label: "Puzzles", icon: Puzzle },
  { href: "/quizzes", label: "Quizzes", icon: Award }
];

export const gtaNavLinks: SiteNavLink[] = [
  { href: "/gta", label: "GTA Home", icon: Home },
  { href: "/gta/wiki", label: "GTA Wiki", icon: BookOpen },
  { href: "/games", label: "All Games", icon: Gamepad2 }
];

// Keep released GTA hubs in a stable, newest-first order for fast sidebar access.
// GTA VI stays out of navigation until its wiki is approved for publication.
export const gtaWikiNavLinks: GtaWikiNavLink[] = [
  { href: "/gta/wiki/gta-online", label: "GTA Online" },
  { href: "/gta/wiki/gta-5", label: "GTA V" },
  { href: "/gta/wiki/gta-4-tbogt", label: "The Ballad of Gay Tony" },
  { href: "/gta/wiki/gta-chinatown-wars", label: "Chinatown Wars" },
  { href: "/gta/wiki/gta-4-tlad", label: "The Lost and Damned" },
  { href: "/gta/wiki/gta-4", label: "GTA IV" },
  { href: "/gta/wiki/gta-vice-city-stories", label: "Vice City Stories" },
  { href: "/gta/wiki/gta-liberty-city-stories", label: "Liberty City Stories" },
  { href: "/gta/wiki/gta-san-andreas", label: "San Andreas" },
  { href: "/gta/wiki/gta-advance", label: "GTA Advance" },
  { href: "/gta/wiki/gta-vice-city", label: "Vice City" },
  { href: "/gta/wiki/gta-iii", label: "GTA III" },
  { href: "/gta/wiki/gta-2", label: "GTA 2" },
  { href: "/gta/wiki/gta-london-1961", label: "London 1961" },
  { href: "/gta/wiki/gta-london-1969", label: "London 1969" },
  { href: "/gta/wiki/gta", label: "Grand Theft Auto" }
];

export function isGtaWikiNavLinkActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function siteNavLinksForPath(pathname: string | null | undefined): SiteNavLink[] {
  return (pathname ?? "").startsWith("/gta") ? gtaNavLinks : siteNavLinks;
}

export const topNavLinks: SiteNavLink[] = [
  { href: "/wiki", label: "Wiki", icon: BookOpen },
  { href: "/codes", label: "Codes", icon: KeyRound },
  { href: "/catalog", label: "Catalogs", icon: LayoutGrid },
  { href: "/tools", label: "Tools", icon: Wrench },
  { href: "/stats", label: "Stats", icon: BarChart3 }
];

export const signedOutSidebarAccount: SidebarAccount = {
  avatarUrl: null,
  href: "/login?next=%2Faccount",
  label: "Sign in",
  signedIn: false
};

export function isNavLinkActive(pathname: string | null | undefined, href: string) {
  const path = pathname ?? "/";
  if (href === "/gta") return path === href;
  return path === href || (href !== "/" && path.startsWith(`${href}/`));
}

export function resolveSearchScope(pathname: string | null | undefined): SearchScope {
  const path = pathname ?? "/";
  if (path.startsWith("/gta")) return { scope: "gta", label: "GTA" };
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
  if (path.startsWith("/stats")) return { scope: "stats", label: "stats" };
  if (path.startsWith("/wiki")) return { scope: "wiki", label: "wiki" };
  if (path.startsWith("/tools")) return { scope: "tools", label: "tools" };
  if (path.startsWith("/catalog")) return { scope: "catalog", label: "catalog" };
  if (path.startsWith("/checklists")) return { scope: "checklists", label: "checklists" };
  if (path.startsWith("/events")) return { scope: "events", label: "events" };
  if (path.startsWith("/articles")) return { scope: "articles", label: "articles" };
  if (path.startsWith("/puzzles")) return { scope: "puzzles", label: "puzzles" };
  if (path.startsWith("/quizzes")) return { scope: "quizzes", label: "quizzes" };
  if (path.startsWith("/authors")) return { scope: "authors", label: "authors" };
  return { scope: "global", label: "Bloxodes" };
}
