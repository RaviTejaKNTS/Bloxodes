import "server-only";
import { getFreeItemCategories } from "@/lib/db";
import {
  AVATAR_CATALOG_MASTER_CODE,
  AVATAR_CATALOG_MASTER_TITLE,
  buildAvatarCatalogPath,
  resolveAvatarCatalogTopLevelConfig
} from "@/lib/roblox-avatar-catalog";
import type { CatalogTopNavContext, CatalogTopNavLink } from "@/lib/game-top-nav-types";

const MUSIC_BASE_PATH = "/catalog/roblox-music-ids";
const FREE_ITEMS_BASE_PATH = "/catalog/free-roblox-items";
const LEGACY_FREE_ITEMS_BASE_PATH = "/catalog/roblox-free-items";

const MUSIC_LINKS = [
  { key: "all", label: "All", href: MUSIC_BASE_PATH },
  { key: "trending", label: "Trending", href: `${MUSIC_BASE_PATH}/trending` },
  { key: "genres", label: "Genres", href: `${MUSIC_BASE_PATH}/genres` },
  { key: "artists", label: "Artists", href: `${MUSIC_BASE_PATH}/artists` }
] as const;

const AVATAR_TOP_LEVEL_CODES = [
  AVATAR_CATALOG_MASTER_CODE,
  "roblox-accessories",
  "roblox-clothing",
  "roblox-body-parts",
  "roblox-emotes",
  "roblox-animations",
  "roblox-makeup"
] as const;

function normalizePath(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/^https?:\/\/[^/]+/i, "").replace(/[?#].*$/, "").replace(/\/+$/, "") || "/";
}

function splitPath(path: string): string[] {
  return normalizePath(path)
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment).trim().toLowerCase());
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

function musicCatalogNav(path: string, segments: string[]): CatalogTopNavContext | null {
  if (segments[0] !== "catalog" || segments[1] !== "roblox-music-ids") return null;
  const section = MUSIC_LINKS.some((link) => link.key === segments[2]) ? segments[2] : "all";
  return {
    title: "Roblox Music IDs",
    links: MUSIC_LINKS.map((link) => ({
      label: link.label,
      href: link.href,
      active: link.key === section
    }))
  };
}

async function freeItemsCatalogNav(segments: string[]): Promise<CatalogTopNavContext | null> {
  const basePath = segments[1] === "roblox-free-items" ? LEGACY_FREE_ITEMS_BASE_PATH : FREE_ITEMS_BASE_PATH;
  if (segments[0] !== "catalog" || (segments[1] !== "free-roblox-items" && segments[1] !== "roblox-free-items")) {
    return null;
  }

  const activeCategory = segments[2] ?? "all";
  let categories: Array<{ slug: string; label: string }> = [];
  try {
    categories = (await getFreeItemCategories()).map((category) => ({
      slug: slugify(category.category),
      label: category.category
    }));
  } catch {
    categories = [];
  }

  return {
    title: "Free Roblox Items",
    links: [
      { label: "All", href: basePath, active: activeCategory === "all" },
      ...categories.map((category) => ({
        label: category.label,
        href: `${FREE_ITEMS_BASE_PATH}/${category.slug}`,
        active: category.slug === activeCategory
      }))
    ]
  };
}

function avatarCatalogNav(path: string, segments: string[]): CatalogTopNavContext | null {
  if (segments[0] !== "catalog") return null;

  const prefix = segments[1];
  if (!prefix) return null;

  const activeCode = prefix === AVATAR_CATALOG_MASTER_CODE && segments[2] ? segments[2] : prefix;
  const activeConfig = resolveAvatarCatalogTopLevelConfig(activeCode);
  const rootConfig = resolveAvatarCatalogTopLevelConfig(prefix);
  if (!activeConfig && !rootConfig) return null;
  const activeTopLevelCode = activeConfig?.code ?? rootConfig?.code;

  const links: CatalogTopNavLink[] = AVATAR_TOP_LEVEL_CODES.flatMap((code) => {
    const config = resolveAvatarCatalogTopLevelConfig(code);
    if (!config) return [];
    const href = buildAvatarCatalogPath(code);
    return [
      {
        label: code === AVATAR_CATALOG_MASTER_CODE ? "All" : config.title.replace(/^Roblox\s+/i, ""),
        href,
        active: config.code === activeTopLevelCode
      }
    ];
  });

  return {
    title: AVATAR_CATALOG_MASTER_TITLE,
    links
  };
}

export async function getCatalogTopNavContext(path: string | null | undefined): Promise<CatalogTopNavContext | null> {
  const normalizedPath = normalizePath(path);
  const segments = splitPath(normalizedPath);
  return (
    musicCatalogNav(normalizedPath, segments) ??
    (await freeItemsCatalogNav(segments)) ??
    avatarCatalogNav(normalizedPath, segments)
  );
}
