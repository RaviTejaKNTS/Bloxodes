import { gameMenuForPath, gameMenuLinks, type GameMenu } from "./game-site-navigation";
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
  Map,
  SquareCheckBig,
  Wrench
} from "lucide-react";

export type SiteNavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

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
  { href: "/articles", label: "Articles", icon: FileText },
  { href: "/wiki", label: "Wiki", icon: BookOpen },
  { href: "/catalog", label: "Catalog", icon: LayoutGrid },
  { href: "/tools", label: "Tools", icon: Wrench },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/checklists", label: "Checklists", icon: SquareCheckBig },
  { href: "/quizzes", label: "Quizzes", icon: Award },
  { href: "/codes", label: "Codes", icon: KeyRound },
  { href: "/events", label: "Events", icon: Calendar },
  { href: "/games", label: "Games", icon: Gamepad2 }
];

const gameIcons: Record<string, LucideIcon> = { home: Home, wiki: BookOpen, map: Map, checklist: SquareCheckBig, quiz: Award, tool: Wrench, code: KeyRound, catalog: LayoutGrid };
export function siteNavLinksForPath(pathname: string | null | undefined, _paths: Record<string, string> = {}, menus: GameMenu[] = []): SiteNavLink[] {
  const menu = gameMenuForPath(pathname ?? "/", menus);
  return menu ? gameMenuLinks(menu).map(page => ({ href: page.href, label: page.title, icon: gameIcons[page.kind] ?? BookOpen })) : siteNavLinks;
}
export type SiteNavGroup = { label: string; links: SiteNavLink[] };
export function siteNavGroupsForPath(pathname: string | null | undefined, paths: Record<string, string> = {}, menus: GameMenu[] = []): SiteNavGroup[] {
  const menu = gameMenuForPath(pathname ?? "/", menus);
  return menu ? [{ label: menu.title, links: siteNavLinksForPath(pathname, paths, menus) }, { label: "Browse", links: siteNavLinks }] : [{ label: "Browse", links: siteNavLinks }];
}

export const signedOutSidebarAccount: SidebarAccount = {
  avatarUrl: null,
  href: "/login?next=%2Faccount",
  label: "Sign in",
  signedIn: false
};

export function isNavLinkActive(pathname: string | null | undefined, href: string) {
  const path = pathname ?? "/";
  if (href === "/games" && (path === "/puzzles" || path.startsWith("/puzzles/"))) return true;
  return path === href || (href !== "/" && path.startsWith(`${href}/`));
}

export function resolveSearchScope(pathname: string | null | undefined, _paths: Record<string, string> = {}, menus: GameMenu[] = []): SearchScope {
  const path = pathname ?? "/";
  if (gameMenuForPath(path, menus)) return { scope: "games", label: "games" };
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
