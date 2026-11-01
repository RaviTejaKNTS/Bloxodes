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

export const gtaNavLinks: SiteNavLink[] = [
  { href: "/gta", label: "GTA Home", icon: Home },
  { href: "/gta/wiki", label: "GTA Wiki", icon: BookOpen },
  { href: "/gta/maps", label: "Interactive Maps", icon: Map },
  { href: "/gta/checklists", label: "Checklists", icon: SquareCheckBig },
  { href: "/games", label: "All Games", icon: Gamepad2 }
];

export const redDeadNavLinks: SiteNavLink[] = [
  { href: "/red-dead", label: "Red Dead Home", icon: Home },
  { href: "/red-dead/wiki", label: "Red Dead Wiki", icon: BookOpen },
  { href: "/games", label: "All Games", icon: Gamepad2 }
];

export const minecraftNavLinks: SiteNavLink[] = [
  { href: "/minecraft", label: "Minecraft Home", icon: Home },
  { href: "/minecraft/wiki", label: "Minecraft Wiki", icon: BookOpen },
  { href: "/minecraft/tools", label: "Tools", icon: Wrench },
  { href: "/games", label: "All Games", icon: Gamepad2 }
];

function originalGamePath(path: string, paths: Record<string, string>): string {
  return Object.entries(paths)
    .filter(([old, live]) => /^\/(gta|red-dead|minecraft)(\/|$)/.test(old) && (path === live || path.startsWith(live + "/")))
    .sort((a, b) => b[1].length - a[1].length)[0]?.[0] ?? path;
}

export function siteNavLinksForPath(pathname: string | null | undefined, paths: Record<string, string> = {}): SiteNavLink[] {
  const path = pathname ?? "";
  const original = originalGamePath(path, paths);
  const links = /^\/minecraft(?:\/|$)/.test(original) ? minecraftNavLinks
    : original.startsWith("/gta") ? gtaNavLinks
    : original.startsWith("/red-dead") ? redDeadNavLinks : siteNavLinks;
  return Object.keys(paths).length ? links.map(link => ({ ...link, href: paths[link.href] ?? link.href })) : links;
}

export type SiteNavGroup = {
  label: string;
  links: SiteNavLink[];
};

/**
 * Link groups for the More drawer. Franchise sections list their own pages first, then every
 * site section, so each primary link is in the page HTML on every route.
 */
export function siteNavGroupsForPath(pathname: string | null | undefined, paths: Record<string, string> = {}): SiteNavGroup[] {
  const links = siteNavLinksForPath(pathname, paths);
  if (links[0]?.label === "Home") return [{ label: "Browse", links: siteNavLinks }];
  const label = links[0]?.label === "GTA Home" ? "GTA" : links[0]?.label === "Red Dead Home" ? "Red Dead" : "Minecraft";
  const shown = new Set(links.map((link) => link.href));
  return [
    { label, links },
    { label: "Browse", links: siteNavLinks.filter((link) => !shown.has(link.href)) }
  ];
}

export const signedOutSidebarAccount: SidebarAccount = {
  avatarUrl: null,
  href: "/login?next=%2Faccount",
  label: "Sign in",
  signedIn: false
};

export function isNavLinkActive(pathname: string | null | undefined, href: string) {
  const path = pathname ?? "/";
  if (href === "/minecraft/wiki" && /^\/minecraft\/(java|bedrock)\/wiki(?:\/|$)/.test(path)) return true;
  if (href === "/games" && (path === "/puzzles" || path.startsWith("/puzzles/"))) return true;
  if (href === "/gta" || href === "/red-dead" || href === "/minecraft") return path === href;
  return path === href || (href !== "/" && path.startsWith(`${href}/`));
}

export function resolveSearchScope(pathname: string | null | undefined, paths: Record<string, string> = {}): SearchScope {
  const path = originalGamePath(pathname ?? "/", paths);
  if (path === "/minecraft" || path.startsWith("/minecraft/")) return { scope: "minecraft", label: "Minecraft" };
  if (path.startsWith("/gta/checklists")) return { scope: "gta-checklists", label: "checklists" };
  if (path.startsWith("/gta")) return { scope: "gta", label: "GTA" };
  if (path.startsWith("/red-dead")) return { scope: "red-dead", label: "Red Dead" };
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
