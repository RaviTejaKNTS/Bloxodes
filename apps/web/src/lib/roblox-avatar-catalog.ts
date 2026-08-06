import { publicContentCache } from "@/lib/public-content-cache";
import { supabaseAdmin } from "@/lib/supabase";

export const AVATAR_CATALOG_PAGE_SIZE = 24;

export type AvatarCatalogSortKey = "featured" | "popular" | "newest" | "updated" | "price-low" | "price-high";
export type AvatarCatalogSaleFilter = "all" | "free" | "paid" | "on-sale" | "off-sale" | "limited" | "resale";
export type AvatarCatalogCreatorFilter = "all" | "roblox" | "creators" | "verified";

export type AvatarCatalogResolvedSearch = {
  search: string;
  sort: AvatarCatalogSortKey;
  sale: AvatarCatalogSaleFilter;
  creator: AvatarCatalogCreatorFilter;
};

export type AvatarCatalogConfig = {
  code: string;
  title: string;
  description: string;
  basePath: string;
  parentCode?: string;
  parentTitle?: string;
  children?: AvatarCatalogChild[];
  scope: AvatarCatalogScope;
};

export type AvatarCatalogChild = {
  slug: string;
  code: string;
  title: string;
  description: string;
  scope: AvatarCatalogScope;
};

type AvatarCatalogScope =
  | { kind: "avatar" }
  | { kind: "category"; category: string; excludeSubcategories?: string[] }
  | { kind: "subcategory"; category: string; subcategory: string }
  | { kind: "accessories" }
  | { kind: "makeup" };

export type AvatarCatalogItem = {
  asset_id: number;
  item_type: string;
  asset_type_id: number | null;
  name: string;
  description: string | null;
  category: string;
  subcategory: string;
  creator_name: string;
  creator_id: number | null;
  creator_target_id: number | null;
  creator_type: string | null;
  creator_has_verified_badge: boolean | null;
  favorite_count: number;
  price_robux: number | null;
  price_status: string | null;
  lowest_price_robux: number | null;
  lowest_resale_price_robux: number | null;
  is_for_sale: boolean | null;
  is_limited: boolean | null;
  is_limited_unique: boolean | null;
  has_resellers: boolean | null;
  total_quantity: number | null;
  remaining: number | null;
  last_seen_at: string;
  created_at: string;
  roblox_url: string;
  thumbnail_url: string | null;
};

type AvatarCatalogFeaturedBucket = {
  id: string;
  scope?: AvatarCatalogScope;
  price?: "paid" | "free";
  sale?: "limited" | "resale";
};

type AvatarCatalogRow = Omit<AvatarCatalogItem, "roblox_url" | "thumbnail_url"> & {
  raw_catalog_json: Record<string, unknown> | null;
};

type AvatarCatalogThumbnailRow = {
  asset_id: number;
  size: string | null;
  format: string | null;
  state: string | null;
  image_url: string | null;
};

export const AVATAR_CATALOG_SORT_OPTIONS: Array<{ value: AvatarCatalogSortKey; label: string }> = [
  { value: "featured", label: "Featured mix" },
  { value: "popular", label: "Most favorited" },
  { value: "newest", label: "Recently created" },
  { value: "updated", label: "Recently seen" },
  { value: "price-low", label: "Price: low to high" },
  { value: "price-high", label: "Price: high to low" }
];

export const AVATAR_CATALOG_SALE_OPTIONS: Array<{ value: AvatarCatalogSaleFilter; label: string }> = [
  { value: "all", label: "All sale states" },
  { value: "on-sale", label: "On sale" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
  { value: "limited", label: "Limited" },
  { value: "resale", label: "Has resale" },
  { value: "off-sale", label: "Off sale" }
];

export const AVATAR_CATALOG_CREATOR_OPTIONS: Array<{ value: AvatarCatalogCreatorFilter; label: string }> = [
  { value: "all", label: "All creators" },
  { value: "roblox", label: "Roblox-made" },
  { value: "creators", label: "Creator-made" },
  { value: "verified", label: "Verified creators" }
];

const THUMBNAIL_SIZE = "420x420";
const THUMBNAIL_FORMAT = "Png";
const AVATAR_CATALOG_SELECT_FIELDS =
  "asset_id, item_type, asset_type_id, name, description, category, subcategory, creator_name, creator_id, creator_target_id, creator_type, creator_has_verified_badge, favorite_count, price_robux, price_status, lowest_price_robux, lowest_resale_price_robux, is_for_sale, is_limited, is_limited_unique, has_resellers, total_quantity, remaining, last_seen_at, created_at, raw_catalog_json";
const AVATAR_CATALOG_CATEGORIES = ["Accessories", "Body", "Clothing", "AvatarAnimations", "Makeup"];
const MAKEUP_ASSET_TYPES = [76, 77, 88, 89, 90];
export const AVATAR_CATALOG_MASTER_CODE = "roblox-items-and-bundles";
export const AVATAR_CATALOG_LEGACY_MASTER_CODE = "roblox-avatar-items";
export const AVATAR_CATALOG_MASTER_TITLE = "Roblox Items and Bundles";
const AVATAR_ACCESSORIES_SLUG = "roblox-accessories";
const AVATAR_CLOTHING_SLUG = "roblox-clothing";
const AVATAR_BODY_PARTS_SLUG = "roblox-body-parts";
const AVATAR_EMOTES_SLUG = "roblox-emotes";
const AVATAR_ANIMATIONS_SLUG = "roblox-animations";
const AVATAR_MAKEUP_SLUG = "roblox-makeup";
export const AVATAR_ACCESSORIES_CODE = `${AVATAR_CATALOG_MASTER_CODE}/${AVATAR_ACCESSORIES_SLUG}`;
export const AVATAR_CLOTHING_CODE = `${AVATAR_CATALOG_MASTER_CODE}/${AVATAR_CLOTHING_SLUG}`;
export const AVATAR_BODY_PARTS_CODE = `${AVATAR_CATALOG_MASTER_CODE}/${AVATAR_BODY_PARTS_SLUG}`;
export const AVATAR_EMOTES_CODE = `${AVATAR_CATALOG_MASTER_CODE}/${AVATAR_EMOTES_SLUG}`;
export const AVATAR_ANIMATIONS_CODE = `${AVATAR_CATALOG_MASTER_CODE}/${AVATAR_ANIMATIONS_SLUG}`;
export const AVATAR_MAKEUP_CODE = `${AVATAR_CATALOG_MASTER_CODE}/${AVATAR_MAKEUP_SLUG}`;
export const AVATAR_CATALOG_LEGACY_FAMILY_CODES = [
  AVATAR_ACCESSORIES_SLUG,
  AVATAR_CLOTHING_SLUG,
  AVATAR_BODY_PARTS_SLUG,
  AVATAR_EMOTES_SLUG,
  AVATAR_ANIMATIONS_SLUG,
  AVATAR_MAKEUP_SLUG
] as const;
export const AVATAR_CATALOG_FAMILY_CODES = [
  AVATAR_CATALOG_MASTER_CODE,
  AVATAR_ACCESSORIES_CODE,
  AVATAR_CLOTHING_CODE,
  AVATAR_BODY_PARTS_CODE,
  AVATAR_EMOTES_CODE,
  AVATAR_ANIMATIONS_CODE,
  AVATAR_MAKEUP_CODE
] as const;

const AVATAR_CATALOG_PAGE_HEADINGS: Record<string, string> = {
  [AVATAR_CATALOG_MASTER_CODE]: "Roblox Item IDs and Bundle Codes",
  [AVATAR_ACCESSORIES_CODE]: "Roblox Accessory Codes and Item IDs",
  [`${AVATAR_ACCESSORIES_CODE}/hair-accessories`]: "Roblox Hair Codes and IDs",
  [`${AVATAR_ACCESSORIES_CODE}/head-accessories`]: "Roblox Hat and Head Accessory Codes",
  [`${AVATAR_ACCESSORIES_CODE}/face-accessories`]: "Roblox Face Accessory Codes and IDs",
  [`${AVATAR_ACCESSORIES_CODE}/neck-accessories`]: "Roblox Neck Accessory Codes and IDs",
  [`${AVATAR_ACCESSORIES_CODE}/shoulder-accessories`]: "Roblox Shoulder Accessory Codes and IDs",
  [`${AVATAR_ACCESSORIES_CODE}/front-accessories`]: "Roblox Front Accessory Codes and IDs",
  [`${AVATAR_ACCESSORIES_CODE}/back-accessories`]: "Roblox Back Accessory Codes and IDs",
  [`${AVATAR_ACCESSORIES_CODE}/waist-accessories`]: "Roblox Waist Accessory Codes and IDs",
  [`${AVATAR_ACCESSORIES_CODE}/gear`]: "Roblox Gear IDs and Codes",
  [AVATAR_CLOTHING_CODE]: "Roblox Clothing Codes and Item IDs",
  [`${AVATAR_CLOTHING_CODE}/layered-t-shirts`]: "Roblox Layered T-Shirt Codes and IDs",
  [`${AVATAR_CLOTHING_CODE}/shirts`]: "Roblox Layered Shirt Codes and IDs",
  [`${AVATAR_CLOTHING_CODE}/sweaters`]: "Roblox Sweater Codes and IDs",
  [`${AVATAR_CLOTHING_CODE}/jackets`]: "Roblox Jacket Codes and IDs",
  [`${AVATAR_CLOTHING_CODE}/pants`]: "Roblox Layered Pants Codes and IDs",
  [`${AVATAR_CLOTHING_CODE}/shorts`]: "Roblox Shorts Codes and IDs",
  [`${AVATAR_CLOTHING_CODE}/dresses-skirts`]: "Roblox Dress and Skirt Codes and IDs",
  [`${AVATAR_CLOTHING_CODE}/shoes`]: "Roblox Shoe Codes and IDs",
  [`${AVATAR_CLOTHING_CODE}/classic-shirts`]: "Roblox Classic Shirt IDs and Codes",
  [`${AVATAR_CLOTHING_CODE}/classic-t-shirts`]: "Roblox Classic T-Shirt IDs and Codes",
  [`${AVATAR_CLOTHING_CODE}/classic-pants`]: "Roblox Classic Pants IDs and Codes",
  [AVATAR_BODY_PARTS_CODE]: "Roblox Body Codes and Item IDs",
  [`${AVATAR_BODY_PARTS_CODE}/full-bodies`]: "Roblox Avatar Bundle Codes and IDs",
  [`${AVATAR_BODY_PARTS_CODE}/dynamic-heads`]: "Roblox Dynamic Head Codes and IDs",
  [`${AVATAR_BODY_PARTS_CODE}/classic-heads`]: "Roblox Classic Head IDs and Codes",
  [`${AVATAR_BODY_PARTS_CODE}/classic-faces`]: "Roblox Classic Face IDs and Codes",
  [AVATAR_EMOTES_CODE]: "Roblox Emote IDs and Codes",
  [AVATAR_ANIMATIONS_CODE]: "Roblox Animation Pack and Bundle IDs",
  [AVATAR_MAKEUP_CODE]: "Roblox Makeup Codes and Item IDs"
};

const AVATAR_CATALOG_SEO_TITLE_PREFIXES: Record<string, string> = {
  [AVATAR_CATALOG_MASTER_CODE]: "Roblox Item & Bundle Codes",
  [AVATAR_ACCESSORIES_CODE]: "Roblox Accessory Codes",
  [`${AVATAR_ACCESSORIES_CODE}/hair-accessories`]: "Roblox Hair Codes",
  [`${AVATAR_ACCESSORIES_CODE}/head-accessories`]: "Roblox Hat & Head Accessory Codes",
  [`${AVATAR_ACCESSORIES_CODE}/face-accessories`]: "Roblox Face Accessory Codes",
  [`${AVATAR_ACCESSORIES_CODE}/neck-accessories`]: "Roblox Neck Accessory Codes",
  [`${AVATAR_ACCESSORIES_CODE}/shoulder-accessories`]: "Roblox Shoulder Accessory Codes",
  [`${AVATAR_ACCESSORIES_CODE}/front-accessories`]: "Roblox Front Accessory Codes",
  [`${AVATAR_ACCESSORIES_CODE}/back-accessories`]: "Roblox Back Accessory Codes",
  [`${AVATAR_ACCESSORIES_CODE}/waist-accessories`]: "Roblox Waist Accessory Codes",
  [`${AVATAR_ACCESSORIES_CODE}/gear`]: "Roblox Gear Codes",
  [AVATAR_CLOTHING_CODE]: "Roblox Clothing Codes",
  [`${AVATAR_CLOTHING_CODE}/layered-t-shirts`]: "Roblox Layered T-Shirt Codes",
  [`${AVATAR_CLOTHING_CODE}/shirts`]: "Roblox Layered Shirt Codes",
  [`${AVATAR_CLOTHING_CODE}/sweaters`]: "Roblox Sweater Codes",
  [`${AVATAR_CLOTHING_CODE}/jackets`]: "Roblox Jacket Codes",
  [`${AVATAR_CLOTHING_CODE}/pants`]: "Roblox Layered Pants Codes",
  [`${AVATAR_CLOTHING_CODE}/shorts`]: "Roblox Shorts Codes",
  [`${AVATAR_CLOTHING_CODE}/dresses-skirts`]: "Roblox Dress & Skirt Codes",
  [`${AVATAR_CLOTHING_CODE}/shoes`]: "Roblox Shoe Codes",
  [`${AVATAR_CLOTHING_CODE}/classic-shirts`]: "Roblox Classic Shirt Codes",
  [`${AVATAR_CLOTHING_CODE}/classic-t-shirts`]: "Roblox Classic T-Shirt Codes",
  [`${AVATAR_CLOTHING_CODE}/classic-pants`]: "Roblox Classic Pants Codes",
  [AVATAR_BODY_PARTS_CODE]: "Roblox Body Codes",
  [`${AVATAR_BODY_PARTS_CODE}/full-bodies`]: "Roblox Avatar Bundle Codes",
  [`${AVATAR_BODY_PARTS_CODE}/dynamic-heads`]: "Roblox Dynamic Head Codes",
  [`${AVATAR_BODY_PARTS_CODE}/classic-heads`]: "Roblox Classic Head Codes",
  [`${AVATAR_BODY_PARTS_CODE}/classic-faces`]: "Roblox Classic Face Codes",
  [AVATAR_EMOTES_CODE]: "Roblox Emote Codes",
  [AVATAR_ANIMATIONS_CODE]: "Roblox Animation Codes",
  [AVATAR_MAKEUP_CODE]: "Roblox Makeup Codes"
};

function formatAvatarCatalogSeoCount(count: number): string {
  if (count >= 1_000) return `${Math.floor(count / 1_000)}K+`;
  return count.toLocaleString("en-US");
}

function getAvatarCatalogSeoCountType(code: string): string {
  if (code === AVATAR_CATALOG_MASTER_CODE) return "Marketplace IDs";
  if (code === AVATAR_BODY_PARTS_CODE) return "Item & Bundle IDs";
  if (code.endsWith("/full-bodies") || code === AVATAR_ANIMATIONS_CODE) return "Bundle IDs";
  return "Item IDs";
}

export function getAvatarCatalogPageHeading(config: Pick<AvatarCatalogConfig, "code" | "title">): string {
  return AVATAR_CATALOG_PAGE_HEADINGS[config.code] ?? `${config.title} Item IDs and Codes`;
}

export function getAvatarCatalogSeoTitle(
  config: Pick<AvatarCatalogConfig, "code" | "title">,
  count: number
): string {
  const prefix = AVATAR_CATALOG_SEO_TITLE_PREFIXES[config.code] ?? getAvatarCatalogPageHeading(config);
  if (count <= 0) return prefix;
  return `${prefix} [${formatAvatarCatalogSeoCount(count)} ${getAvatarCatalogSeoCountType(config.code)}]`;
}

export function getAvatarCatalogSeoDescription(config: Pick<AvatarCatalogConfig, "code" | "title">): string {
  const catalogName = config.title.replace(/\s+on Roblox$/i, "");
  const idTypes = config.code === AVATAR_CATALOG_MASTER_CODE || config.code.endsWith("/full-bodies") || config.code === AVATAR_ANIMATIONS_CODE
    ? "item and bundle IDs"
    : "item IDs and codes";

  return `Find ${catalogName} and copy Roblox ${idTypes}. Search by name, creator, or ID; compare prices and popularity; open official Marketplace listings.`;
}

function normalizeAvatarCatalogPathParts(value: string): string[] {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean);
}

function joinCatalogPath(parts: string[]): string {
  return `/${parts.map(encodeURIComponent).join("/")}`;
}

export function isAvatarCatalogCode(value: string): boolean {
  const [prefix] = normalizeAvatarCatalogPathParts(value);
  return (
    prefix === AVATAR_CATALOG_LEGACY_MASTER_CODE ||
    prefix === AVATAR_CATALOG_MASTER_CODE ||
    AVATAR_CATALOG_LEGACY_FAMILY_CODES.some((code) => code === prefix)
  );
}

export function buildAvatarCatalogPath(code: string, trailingSegments: string[] = []): string {
  const parts = normalizeAvatarCatalogPathParts(code);
  const normalizedTrailing = trailingSegments.flatMap(normalizeAvatarCatalogPathParts);
  const [prefix, ...rest] = parts;

  if (!prefix || prefix === AVATAR_CATALOG_MASTER_CODE || prefix === AVATAR_CATALOG_LEGACY_MASTER_CODE) {
    return joinCatalogPath(["catalog", AVATAR_CATALOG_MASTER_CODE, ...rest, ...normalizedTrailing]);
  }

  if (AVATAR_CATALOG_LEGACY_FAMILY_CODES.some((familyCode) => familyCode === prefix)) {
    return joinCatalogPath(["catalog", AVATAR_CATALOG_MASTER_CODE, ...parts, ...normalizedTrailing]);
  }

  return joinCatalogPath(["catalog", ...parts, ...normalizedTrailing]);
}

export function buildAvatarCatalogRedirectHref(
  code: string,
  segments: string[] = [],
  searchParams: Record<string, string | string[] | undefined> = {}
): string {
  const path = buildAvatarCatalogPath(code, segments);
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry) params.append(key, entry);
      }
    } else if (value) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export const ACCESSORY_CHILDREN: AvatarCatalogChild[] = [
  {
    slug: "hair-accessories",
    code: `${AVATAR_ACCESSORIES_CODE}/hair-accessories`,
    title: "Roblox Hair Accessories",
    description: "Hair items for layered and classic Roblox avatars.",
    scope: { kind: "subcategory", category: "Body", subcategory: "HairAccessories" }
  },
  {
    slug: "head-accessories",
    code: `${AVATAR_ACCESSORIES_CODE}/head-accessories`,
    title: "Roblox Head Accessories",
    description: "Hats, helmets, crowns, and other head-slot accessories.",
    scope: { kind: "subcategory", category: "Accessories", subcategory: "HeadAccessories" }
  },
  {
    slug: "face-accessories",
    code: `${AVATAR_ACCESSORIES_CODE}/face-accessories`,
    title: "Roblox Face Accessories",
    description: "Masks, glasses, facial add-ons, and face-slot avatar items.",
    scope: { kind: "subcategory", category: "Accessories", subcategory: "FaceAccessories" }
  },
  {
    slug: "neck-accessories",
    code: `${AVATAR_ACCESSORIES_CODE}/neck-accessories`,
    title: "Roblox Neck Accessories",
    description: "Neck-slot accessories such as chains, scarves, collars, and ties.",
    scope: { kind: "subcategory", category: "Accessories", subcategory: "NeckAccessories" }
  },
  {
    slug: "shoulder-accessories",
    code: `${AVATAR_ACCESSORIES_CODE}/shoulder-accessories`,
    title: "Roblox Shoulder Accessories",
    description: "Shoulder pets, shoulder props, and avatar shoulder-slot items.",
    scope: { kind: "subcategory", category: "Accessories", subcategory: "ShoulderAccessories" }
  },
  {
    slug: "front-accessories",
    code: `${AVATAR_ACCESSORIES_CODE}/front-accessories`,
    title: "Roblox Front Accessories",
    description: "Front-slot accessories that sit on the chest or front of an avatar.",
    scope: { kind: "subcategory", category: "Accessories", subcategory: "FrontAccessories" }
  },
  {
    slug: "back-accessories",
    code: `${AVATAR_ACCESSORIES_CODE}/back-accessories`,
    title: "Roblox Back Accessories",
    description: "Wings, backpacks, tails, capes, and other back-slot accessories.",
    scope: { kind: "subcategory", category: "Accessories", subcategory: "BackAccessories" }
  },
  {
    slug: "waist-accessories",
    code: `${AVATAR_ACCESSORIES_CODE}/waist-accessories`,
    title: "Roblox Waist Accessories",
    description: "Belts, side props, tails, and other waist-slot accessories.",
    scope: { kind: "subcategory", category: "Accessories", subcategory: "WaistAccessories" }
  },
  {
    slug: "gear",
    code: `${AVATAR_ACCESSORIES_CODE}/gear`,
    title: "Roblox Gear",
    description: "Roblox gear items from the Marketplace.",
    scope: { kind: "subcategory", category: "Accessories", subcategory: "Gear" }
  }
];

export const CLOTHING_CHILDREN: AvatarCatalogChild[] = [
  {
    slug: "layered-t-shirts",
    code: `${AVATAR_CLOTHING_CODE}/layered-t-shirts`,
    title: "Roblox Layered T-Shirts",
    description: "Layered t-shirt accessories for 3D avatar clothing.",
    scope: { kind: "subcategory", category: "Clothing", subcategory: "TShirtAccessories" }
  },
  {
    slug: "shirts",
    code: `${AVATAR_CLOTHING_CODE}/shirts`,
    title: "Roblox Layered Shirts",
    description: "Layered shirt accessories that fit over Roblox avatar bodies.",
    scope: { kind: "subcategory", category: "Clothing", subcategory: "ShirtAccessories" }
  },
  {
    slug: "sweaters",
    code: `${AVATAR_CLOTHING_CODE}/sweaters`,
    title: "Roblox Sweaters",
    description: "Layered sweaters and knitwear for Roblox avatars.",
    scope: { kind: "subcategory", category: "Clothing", subcategory: "SweaterAccessories" }
  },
  {
    slug: "jackets",
    code: `${AVATAR_CLOTHING_CODE}/jackets`,
    title: "Roblox Jackets",
    description: "Layered jackets, coats, hoodies, and outerwear.",
    scope: { kind: "subcategory", category: "Clothing", subcategory: "JacketAccessories" }
  },
  {
    slug: "pants",
    code: `${AVATAR_CLOTHING_CODE}/pants`,
    title: "Roblox Layered Pants",
    description: "Layered pants for modern Roblox avatar outfits.",
    scope: { kind: "subcategory", category: "Clothing", subcategory: "PantsAccessories" }
  },
  {
    slug: "shorts",
    code: `${AVATAR_CLOTHING_CODE}/shorts`,
    title: "Roblox Shorts",
    description: "Layered shorts for Roblox avatar outfits.",
    scope: { kind: "subcategory", category: "Clothing", subcategory: "ShortsAccessories" }
  },
  {
    slug: "dresses-skirts",
    code: `${AVATAR_CLOTHING_CODE}/dresses-skirts`,
    title: "Roblox Dresses and Skirts",
    description: "Layered dresses and skirt accessories for Roblox avatars.",
    scope: { kind: "subcategory", category: "Clothing", subcategory: "DressSkirtAccessories" }
  },
  {
    slug: "shoes",
    code: `${AVATAR_CLOTHING_CODE}/shoes`,
    title: "Roblox Shoes",
    description: "Shoe bundles for Roblox avatar outfits.",
    scope: { kind: "subcategory", category: "Clothing", subcategory: "ShoesBundles" }
  },
  {
    slug: "classic-shirts",
    code: `${AVATAR_CLOTHING_CODE}/classic-shirts`,
    title: "Roblox Classic Shirts",
    description: "Classic 2D shirt assets for Roblox avatars.",
    scope: { kind: "subcategory", category: "Clothing", subcategory: "ClassicShirts" }
  },
  {
    slug: "classic-t-shirts",
    code: `${AVATAR_CLOTHING_CODE}/classic-t-shirts`,
    title: "Roblox Classic T-Shirts",
    description: "Classic t-shirt image assets for Roblox avatars.",
    scope: { kind: "subcategory", category: "Clothing", subcategory: "ClassicTShirts" }
  },
  {
    slug: "classic-pants",
    code: `${AVATAR_CLOTHING_CODE}/classic-pants`,
    title: "Roblox Classic Pants",
    description: "Classic 2D pants assets for Roblox avatars.",
    scope: { kind: "subcategory", category: "Clothing", subcategory: "ClassicPants" }
  }
];

export const BODY_CHILDREN: AvatarCatalogChild[] = [
  {
    slug: "full-bodies",
    code: `${AVATAR_BODY_PARTS_CODE}/full-bodies`,
    title: "Roblox Full Bodies",
    description: "Full avatar body bundles from the Roblox marketplace.",
    scope: { kind: "subcategory", category: "Body", subcategory: "BodyPartsBundles" }
  },
  {
    slug: "dynamic-heads",
    code: `${AVATAR_BODY_PARTS_CODE}/dynamic-heads`,
    title: "Roblox Dynamic Heads",
    description: "Dynamic heads with modern facial animation support.",
    scope: { kind: "subcategory", category: "Body", subcategory: "DynamicHeads" }
  },
  {
    slug: "classic-heads",
    code: `${AVATAR_BODY_PARTS_CODE}/classic-heads`,
    title: "Roblox Classic Heads",
    description: "Classic head shapes for Roblox avatars.",
    scope: { kind: "subcategory", category: "Body", subcategory: "Heads" }
  },
  {
    slug: "classic-faces",
    code: `${AVATAR_BODY_PARTS_CODE}/classic-faces`,
    title: "Roblox Classic Faces",
    description: "Classic face assets for Roblox avatars.",
    scope: { kind: "subcategory", category: "Body", subcategory: "Faces" }
  }
];

export const TOP_LEVEL_AVATAR_CATALOGS: AvatarCatalogConfig[] = [
  {
    code: AVATAR_CATALOG_MASTER_CODE,
    title: AVATAR_CATALOG_MASTER_TITLE,
    description: "A broad Roblox Marketplace index across accessories, clothing, bodies, animations, emotes, bundles, free items, paid items, and limiteds.",
    basePath: buildAvatarCatalogPath(AVATAR_CATALOG_MASTER_CODE),
    scope: { kind: "avatar" },
    children: [
      {
        slug: AVATAR_ACCESSORIES_SLUG,
        code: AVATAR_ACCESSORIES_CODE,
        title: "Roblox Accessories",
        description: "Hair, head, face, neck, shoulder, front, back, waist, and gear items.",
        scope: { kind: "accessories" }
      },
      {
        slug: AVATAR_CLOTHING_SLUG,
        code: AVATAR_CLOTHING_CODE,
        title: "Roblox Clothing",
        description: "Layered clothing, shoes, and classic shirt, t-shirt, and pants assets.",
        scope: { kind: "category", category: "Clothing" }
      },
      {
        slug: AVATAR_BODY_PARTS_SLUG,
        code: AVATAR_BODY_PARTS_CODE,
        title: "Roblox Body Parts",
        description: "Full bodies, dynamic heads, classic heads, and classic faces.",
        scope: { kind: "category", category: "Body", excludeSubcategories: ["HairAccessories"] }
      },
      {
        slug: AVATAR_EMOTES_SLUG,
        code: AVATAR_EMOTES_CODE,
        title: "Roblox Emotes",
        description: "Emote animation assets players can equip on Roblox avatars.",
        scope: { kind: "subcategory", category: "AvatarAnimations", subcategory: "EmoteAnimations" }
      },
      {
        slug: AVATAR_ANIMATIONS_SLUG,
        code: AVATAR_ANIMATIONS_CODE,
        title: "Roblox Animations",
        description: "Animation bundles that change how Roblox avatars idle, walk, run, jump, fall, swim, and climb.",
        scope: { kind: "subcategory", category: "AvatarAnimations", subcategory: "AnimationBundles" }
      },
      {
        slug: AVATAR_MAKEUP_SLUG,
        code: AVATAR_MAKEUP_CODE,
        title: "Roblox Makeup",
        description: "Eyes, face, lips, eyelashes, eyebrows, and full-face makeup looks.",
        scope: { kind: "makeup" }
      }
    ]
  },
  {
    code: AVATAR_ACCESSORIES_CODE,
    title: "Roblox Accessories",
    description: "Browse Roblox avatar accessories by slot, including hair, head, face, neck, shoulder, front, back, waist, and gear.",
    basePath: buildAvatarCatalogPath(AVATAR_ACCESSORIES_CODE),
    parentCode: AVATAR_CATALOG_MASTER_CODE,
    parentTitle: AVATAR_CATALOG_MASTER_TITLE,
    scope: { kind: "accessories" },
    children: ACCESSORY_CHILDREN
  },
  {
    code: AVATAR_CLOTHING_CODE,
    title: "Roblox Clothing",
    description: "Browse layered clothing, shoes, and classic clothing assets for Roblox avatars.",
    basePath: buildAvatarCatalogPath(AVATAR_CLOTHING_CODE),
    parentCode: AVATAR_CATALOG_MASTER_CODE,
    parentTitle: AVATAR_CATALOG_MASTER_TITLE,
    scope: { kind: "category", category: "Clothing" },
    children: CLOTHING_CHILDREN
  },
  {
    code: AVATAR_BODY_PARTS_CODE,
    title: "Roblox Body Parts",
    description: "Browse Roblox full bodies, dynamic heads, classic heads, and classic faces.",
    basePath: buildAvatarCatalogPath(AVATAR_BODY_PARTS_CODE),
    parentCode: AVATAR_CATALOG_MASTER_CODE,
    parentTitle: AVATAR_CATALOG_MASTER_TITLE,
    scope: { kind: "category", category: "Body", excludeSubcategories: ["HairAccessories"] },
    children: BODY_CHILDREN
  },
  {
    code: AVATAR_EMOTES_CODE,
    title: "Roblox Emotes",
    description: "Browse Roblox emote animations players can equip and trigger from the avatar emote wheel.",
    basePath: buildAvatarCatalogPath(AVATAR_EMOTES_CODE),
    parentCode: AVATAR_CATALOG_MASTER_CODE,
    parentTitle: AVATAR_CATALOG_MASTER_TITLE,
    scope: { kind: "subcategory", category: "AvatarAnimations", subcategory: "EmoteAnimations" }
  },
  {
    code: AVATAR_ANIMATIONS_CODE,
    title: "Roblox Animations",
    description: "Browse Roblox animation bundles for avatar movement styles.",
    basePath: buildAvatarCatalogPath(AVATAR_ANIMATIONS_CODE),
    parentCode: AVATAR_CATALOG_MASTER_CODE,
    parentTitle: AVATAR_CATALOG_MASTER_TITLE,
    scope: { kind: "subcategory", category: "AvatarAnimations", subcategory: "AnimationBundles" }
  },
  {
    code: AVATAR_MAKEUP_CODE,
    title: "Roblox Makeup",
    description: "Browse Roblox makeup items for eyes, face, lips, eyelashes, eyebrows, and full-face looks.",
    basePath: buildAvatarCatalogPath(AVATAR_MAKEUP_CODE),
    parentCode: AVATAR_CATALOG_MASTER_CODE,
    parentTitle: AVATAR_CATALOG_MASTER_TITLE,
    scope: { kind: "makeup" }
  }
];

const TOP_LEVEL_BY_CODE = new Map(TOP_LEVEL_AVATAR_CATALOGS.map((config) => [config.code, config]));
TOP_LEVEL_BY_CODE.set(AVATAR_CATALOG_LEGACY_MASTER_CODE, TOP_LEVEL_BY_CODE.get(AVATAR_CATALOG_MASTER_CODE)!);
for (const config of TOP_LEVEL_AVATAR_CATALOGS) {
  if (config.parentCode !== AVATAR_CATALOG_MASTER_CODE) continue;
  const legacyPrefix = config.code.replace(`${AVATAR_CATALOG_MASTER_CODE}/`, "");
  TOP_LEVEL_BY_CODE.set(legacyPrefix, config);
}

export function resolveAvatarCatalogConfig(prefix: string, childSlug?: string): AvatarCatalogConfig | null {
  const parent = TOP_LEVEL_BY_CODE.get(prefix);
  if (!parent) return null;
  if (!childSlug) return parent;

  const child = parent.children?.find((entry) => entry.slug === childSlug) ?? null;
  if (!child) return null;
  return {
    code: child.code,
    title: child.title,
    description: child.description,
    basePath: `${parent.basePath}/${child.slug}`,
    parentCode: parent.code,
    parentTitle: parent.title,
    scope: child.scope
  };
}

export function resolveAvatarCatalogTopLevelConfig(prefix: string): AvatarCatalogConfig | null {
  return TOP_LEVEL_BY_CODE.get(prefix) ?? null;
}

export function normalizeAvatarCatalogSort(value: string | null | undefined): AvatarCatalogSortKey {
  return AVATAR_CATALOG_SORT_OPTIONS.some((option) => option.value === value) ? (value as AvatarCatalogSortKey) : "featured";
}

export function normalizeAvatarCatalogSale(value: string | null | undefined): AvatarCatalogSaleFilter {
  return AVATAR_CATALOG_SALE_OPTIONS.some((option) => option.value === value) ? (value as AvatarCatalogSaleFilter) : "all";
}

export function normalizeAvatarCatalogCreator(value: string | null | undefined): AvatarCatalogCreatorFilter {
  return AVATAR_CATALOG_CREATOR_OPTIONS.some((option) => option.value === value) ? (value as AvatarCatalogCreatorFilter) : "all";
}

export function normalizeAvatarCatalogSearch(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
}

export function buildAvatarCatalogQueryString(filters: AvatarCatalogResolvedSearch): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("q", filters.search);
  if (filters.sort !== "featured") params.set("sort", filters.sort);
  if (filters.sale !== "all") params.set("sale", filters.sale);
  if (filters.creator !== "all") params.set("creator", filters.creator);
  return params.toString();
}

function buildSearchPattern(value: string): string {
  const cleaned = value.replace(/[%_]/g, " ").trim();
  const pattern = cleaned.replace(/[^a-z0-9]+/gi, "%").replace(/%{2,}/g, "%");
  return `%${pattern}%`;
}

function applyScope(query: any, scope: AvatarCatalogScope) {
  switch (scope.kind) {
    case "avatar":
      return query.in("category", AVATAR_CATALOG_CATEGORIES);
    case "accessories":
      return query.or("category.eq.Accessories,and(category.eq.Body,subcategory.eq.HairAccessories)");
    case "category": {
      let nextQuery = query.eq("category", scope.category);
      for (const excluded of scope.excludeSubcategories ?? []) {
        nextQuery = nextQuery.neq("subcategory", excluded);
      }
      return nextQuery;
    }
    case "subcategory":
      return query.eq("category", scope.category).eq("subcategory", scope.subcategory);
    case "makeup":
      return query.or(`category.eq.Makeup,asset_type_id.in.(${MAKEUP_ASSET_TYPES.join(",")})`);
  }
}

function applyAvatarCatalogFilters(query: any, filters: AvatarCatalogResolvedSearch) {
  let nextQuery = query;

  if (filters.search) {
    const pattern = buildSearchPattern(filters.search);
    const orParts = [
      `name.ilike.${pattern}`,
      `description.ilike.${pattern}`,
      `creator_name.ilike.${pattern}`
    ];
    if (/^\d+$/.test(filters.search)) {
      orParts.unshift(`asset_id.eq.${filters.search}`, `asset_id.eq.-${filters.search}`);
    }
    nextQuery = nextQuery.or(orParts.join(","));
  }

  switch (filters.sale) {
    case "free":
      nextQuery = nextQuery.eq("price_robux", 0);
      break;
    case "paid":
      nextQuery = nextQuery.gt("price_robux", 0);
      break;
    case "on-sale":
      nextQuery = nextQuery.eq("is_for_sale", true);
      break;
    case "off-sale":
      nextQuery = nextQuery.eq("is_for_sale", false);
      break;
    case "limited":
      nextQuery = nextQuery.or("is_limited.eq.true,is_limited_unique.eq.true");
      break;
    case "resale":
      nextQuery = nextQuery.or("has_resellers.eq.true,lowest_resale_price_robux.gt.0");
      break;
    case "all":
    default:
      break;
  }

  switch (filters.creator) {
    case "roblox":
      nextQuery = nextQuery.eq("creator_name", "Roblox");
      break;
    case "creators":
      nextQuery = nextQuery.neq("creator_name", "Roblox");
      break;
    case "verified":
      nextQuery = nextQuery.eq("creator_has_verified_badge", true);
      break;
    case "all":
    default:
      break;
  }

  return nextQuery;
}

function applyAvatarCatalogSort(query: any, sort: AvatarCatalogSortKey) {
  switch (sort) {
    case "newest":
      return query.order("created_at", { ascending: false }).order("asset_id", { ascending: true });
    case "updated":
      return query.order("last_seen_at", { ascending: false }).order("asset_id", { ascending: true });
    case "price-low":
      return query.order("price_robux", { ascending: true, nullsFirst: false }).order("favorite_count", { ascending: false, nullsFirst: false });
    case "price-high":
      return query.order("price_robux", { ascending: false, nullsFirst: false }).order("favorite_count", { ascending: false, nullsFirst: false });
    case "popular":
    case "featured":
    default:
      return query.order("favorite_count", { ascending: false, nullsFirst: false }).order("asset_id", { ascending: true });
  }
}

function applyFeaturedBucket(query: any, bucket: AvatarCatalogFeaturedBucket, filters: AvatarCatalogResolvedSearch) {
  let nextQuery = query;

  if (bucket.scope) {
    nextQuery = applyScope(nextQuery, bucket.scope);
  }

  if (filters.sale === "all") {
    if (bucket.price === "paid") nextQuery = nextQuery.gt("price_robux", 0);
    if (bucket.price === "free") nextQuery = nextQuery.eq("price_robux", 0);

    if (bucket.sale === "limited") nextQuery = nextQuery.or("is_limited.eq.true,is_limited_unique.eq.true");
    if (bucket.sale === "resale") nextQuery = nextQuery.or("has_resellers.eq.true,lowest_resale_price_robux.gt.0");
  }

  return nextQuery;
}

function featuredBucket(id: string, bucket: Omit<AvatarCatalogFeaturedBucket, "id">): AvatarCatalogFeaturedBucket {
  return { id, ...bucket };
}

function getFeaturedBuckets(config: AvatarCatalogConfig): AvatarCatalogFeaturedBucket[] {
  if (config.code === AVATAR_CATALOG_MASTER_CODE) {
    return [
      featuredBucket("paid-clothing", { scope: { kind: "category", category: "Clothing" }, price: "paid" }),
      featuredBucket("paid-accessories", { scope: { kind: "accessories" }, price: "paid" }),
      featuredBucket("makeup", { scope: { kind: "makeup" } }),
      featuredBucket("clothing", { scope: { kind: "category", category: "Clothing" } }),
      featuredBucket("accessories", { scope: { kind: "accessories" } }),
      featuredBucket("limiteds", { sale: "limited" })
    ];
  }

  if (config.code === AVATAR_CLOTHING_CODE) {
    return [
      featuredBucket("paid-shirts", { scope: { kind: "subcategory", category: "Clothing", subcategory: "ShirtAccessories" }, price: "paid" }),
      featuredBucket("paid-jackets", { scope: { kind: "subcategory", category: "Clothing", subcategory: "JacketAccessories" }, price: "paid" }),
      featuredBucket("paid-pants", { scope: { kind: "subcategory", category: "Clothing", subcategory: "PantsAccessories" }, price: "paid" }),
      featuredBucket("paid-shoes", { scope: { kind: "subcategory", category: "Clothing", subcategory: "ShoesBundles" }, price: "paid" }),
      featuredBucket("paid-classic", { scope: { kind: "subcategory", category: "Clothing", subcategory: "ClassicShirts" }, price: "paid" }),
      featuredBucket("paid-clothing", { price: "paid" }),
      featuredBucket("popular", {})
    ];
  }

  if (config.code === AVATAR_ACCESSORIES_CODE) {
    return [
      featuredBucket("paid-hair", { scope: { kind: "subcategory", category: "Body", subcategory: "HairAccessories" }, price: "paid" }),
      featuredBucket("paid-head", { scope: { kind: "subcategory", category: "Accessories", subcategory: "HeadAccessories" }, price: "paid" }),
      featuredBucket("paid-face", { scope: { kind: "subcategory", category: "Accessories", subcategory: "FaceAccessories" }, price: "paid" }),
      featuredBucket("paid-back", { scope: { kind: "subcategory", category: "Accessories", subcategory: "BackAccessories" }, price: "paid" }),
      featuredBucket("paid-shoulder", { scope: { kind: "subcategory", category: "Accessories", subcategory: "ShoulderAccessories" }, price: "paid" }),
      featuredBucket("paid-accessories", { price: "paid" }),
      featuredBucket("popular", {})
    ];
  }

  if (config.code === AVATAR_BODY_PARTS_CODE) {
    return [
      featuredBucket("paid-bodies", { scope: { kind: "subcategory", category: "Body", subcategory: "BodyPartsBundles" }, price: "paid" }),
      featuredBucket("paid-dynamic-heads", { scope: { kind: "subcategory", category: "Body", subcategory: "DynamicHeads" }, price: "paid" }),
      featuredBucket("paid-faces", { scope: { kind: "subcategory", category: "Body", subcategory: "Faces" }, price: "paid" }),
      featuredBucket("paid-body", { price: "paid" }),
      featuredBucket("popular", {})
    ];
  }

  if (config.code === AVATAR_MAKEUP_CODE) {
    return [
      featuredBucket("paid-makeup", { price: "paid" }),
      featuredBucket("makeup", {}),
      featuredBucket("popular", {})
    ];
  }

  return [
    featuredBucket("paid", { price: "paid" }),
    featuredBucket("limiteds", { sale: "limited" }),
    featuredBucket("popular", {})
  ];
}

function getFeaturedPattern(config: AvatarCatalogConfig): string[] {
  if (config.code === AVATAR_CATALOG_MASTER_CODE) {
    return [
      "paid-clothing",
      "paid-accessories",
      "makeup",
      "paid-clothing",
      "paid-accessories",
      "limiteds",
      "clothing",
      "accessories",
      "makeup",
      "paid-clothing",
      "paid-accessories",
      "clothing",
      "accessories",
      "limiteds",
      "paid-clothing",
      "paid-accessories",
      "makeup",
      "clothing",
      "accessories",
      "paid-clothing",
      "paid-accessories",
      "clothing",
      "accessories",
      "paid-clothing",
      "paid-accessories"
    ];
  }

  if (config.code === AVATAR_CLOTHING_CODE) {
    return [
      "paid-shirts",
      "paid-jackets",
      "paid-pants",
      "paid-shoes",
      "paid-classic",
      "paid-clothing",
      "paid-shirts",
      "paid-jackets",
      "paid-pants",
      "paid-clothing",
      "paid-shoes",
      "popular",
      "paid-shirts",
      "paid-jackets",
      "paid-classic",
      "paid-clothing",
      "paid-pants",
      "paid-shoes",
      "popular",
      "paid-clothing",
      "paid-shirts",
      "paid-jackets",
      "paid-pants",
      "popular"
    ];
  }

  if (config.code === AVATAR_ACCESSORIES_CODE) {
    return [
      "paid-hair",
      "paid-head",
      "paid-face",
      "paid-back",
      "paid-shoulder",
      "paid-accessories",
      "paid-hair",
      "paid-head",
      "paid-face",
      "popular",
      "paid-back",
      "paid-shoulder",
      "paid-accessories",
      "paid-hair",
      "paid-head",
      "paid-face",
      "paid-back",
      "popular",
      "paid-accessories",
      "paid-hair",
      "paid-head",
      "paid-face",
      "paid-back",
      "popular"
    ];
  }

  if (config.code === AVATAR_BODY_PARTS_CODE) {
    return [
      "paid-bodies",
      "paid-dynamic-heads",
      "paid-faces",
      "paid-body",
      "paid-bodies",
      "popular",
      "paid-dynamic-heads",
      "paid-faces",
      "paid-body",
      "paid-bodies",
      "popular",
      "paid-dynamic-heads",
      "paid-faces",
      "paid-body",
      "paid-bodies",
      "popular",
      "paid-dynamic-heads",
      "paid-body",
      "paid-faces",
      "popular",
      "paid-bodies",
      "paid-dynamic-heads",
      "paid-body",
      "popular"
    ];
  }

  if (config.code === AVATAR_MAKEUP_CODE) {
    return [
      "paid-makeup",
      "makeup",
      "paid-makeup",
      "popular",
      "paid-makeup",
      "makeup",
      "paid-makeup",
      "popular",
      "paid-makeup",
      "makeup",
      "paid-makeup",
      "popular",
      "paid-makeup",
      "makeup",
      "paid-makeup",
      "popular",
      "paid-makeup",
      "makeup",
      "paid-makeup",
      "popular",
      "paid-makeup",
      "makeup",
      "paid-makeup",
      "popular"
    ];
  }

  return [
    "paid",
    "limiteds",
    "paid",
    "popular",
    "paid",
    "limiteds",
    "paid",
    "popular",
    "paid",
    "limiteds",
    "paid",
    "popular",
    "paid",
    "limiteds",
    "paid",
    "popular",
    "paid",
    "limiteds",
    "paid",
    "popular",
    "paid",
    "limiteds",
    "paid",
    "popular"
  ];
}

function createAvatarCatalogBaseQuery(sb: ReturnType<typeof supabaseAdmin>, includeCount = false) {
  return includeCount
    ? sb
        .from("roblox_catalog_items")
        .select(AVATAR_CATALOG_SELECT_FIELDS, { count: "exact" })
        .eq("is_deleted", false)
        .not("name", "is", null)
        .not("category", "is", null)
        .not("subcategory", "is", null)
        .not("favorite_count", "is", null)
    : sb
        .from("roblox_catalog_items")
        .select(AVATAR_CATALOG_SELECT_FIELDS)
        .eq("is_deleted", false)
        .not("name", "is", null)
        .not("category", "is", null)
        .not("subcategory", "is", null)
        .not("favorite_count", "is", null);
}

function getThumbnailPriority(row: AvatarCatalogThumbnailRow): number {
  let score = 0;
  if (row.image_url) score += 100;
  if (row.state === "Completed") score += 40;
  if (row.size === THUMBNAIL_SIZE) score += 20;
  if (row.format === THUMBNAIL_FORMAT) score += 10;
  return score;
}

async function loadThumbnailUrls(assetIds: number[]): Promise<Map<number, string>> {
  const normalizedAssetIds = Array.from(
    new Set(
      assetIds
        .filter((assetId) => Number.isFinite(assetId))
        .filter((assetId) => assetId !== 0)
        .map((assetId) => Math.trunc(assetId))
    )
  );

  if (!normalizedAssetIds.length) return new Map();

  const sb = supabaseAdmin();
  const bestRows = new Map<number, AvatarCatalogThumbnailRow>();
  const { data, error } = await sb
    .from("roblox_catalog_item_images")
    .select("asset_id, size, format, state, image_url")
    .in("asset_id", normalizedAssetIds)
    .not("image_url", "is", null);

  if (error) {
    console.error("Failed to load avatar catalog thumbnails", error);
  } else {
    for (const row of (data ?? []) as AvatarCatalogThumbnailRow[]) {
      if (typeof row.asset_id !== "number" || typeof row.image_url !== "string" || row.image_url.length === 0) {
        continue;
      }
      const existing = bestRows.get(row.asset_id);
      if (!existing || getThumbnailPriority(row) > getThumbnailPriority(existing)) {
        bestRows.set(row.asset_id, row);
      }
    }
  }

  const thumbnailMap = new Map<number, string>();
  for (const [assetId, row] of bestRows.entries()) {
    if (row.image_url) thumbnailMap.set(assetId, row.image_url);
  }
  return thumbnailMap;
}

async function decorateAvatarCatalogRows(rows: AvatarCatalogRow[]): Promise<AvatarCatalogItem[]> {
  const thumbnailMap = await loadThumbnailUrls(rows.map((row) => row.asset_id));
  return rows.map(({ raw_catalog_json, ...item }) => ({
    ...item,
    roblox_url: extractRobloxUrl({ ...item, raw_catalog_json }),
    thumbnail_url: thumbnailMap.get(item.asset_id) ?? null
  }));
}

function extractRobloxUrl(row: { asset_id: number; item_type?: string | null; raw_catalog_json?: Record<string, unknown> | null }) {
  const explicitUrl = row.raw_catalog_json?.roblox_url;
  if (typeof explicitUrl === "string" && explicitUrl.length > 0) {
    return explicitUrl;
  }

  if (row.item_type === "Bundle" && Number.isFinite(row.asset_id)) {
    return `https://www.roblox.com/bundles/${Math.abs(Math.trunc(row.asset_id))}`;
  }

  return `https://www.roblox.com/catalog/${row.asset_id}`;
}

async function fetchAvatarCatalogCount(
  config: AvatarCatalogConfig,
  filters: AvatarCatalogResolvedSearch
): Promise<number> {
  const sb = supabaseAdmin();
  let query = createAvatarCatalogBaseQuery(sb, true);
  query = applyScope(query, config.scope);
  query = applyAvatarCatalogFilters(query, filters);
  const { count, error } = await query.range(0, 0);
  if (error) throw error;
  return count ?? 0;
}

async function fetchFeaturedBucketRows({
  config,
  bucket,
  filters,
  offset,
  limit
}: {
  config: AvatarCatalogConfig;
  bucket: AvatarCatalogFeaturedBucket;
  filters: AvatarCatalogResolvedSearch;
  offset: number;
  limit: number;
}): Promise<AvatarCatalogRow[]> {
  const safeOffset = Math.max(0, offset);
  const safeLimit = Math.max(1, Math.min(80, limit));
  const sb = supabaseAdmin();
  let query = createAvatarCatalogBaseQuery(sb);
  query = applyScope(query, config.scope);
  query = applyAvatarCatalogFilters(query, filters);
  query = applyFeaturedBucket(query, bucket, filters);
  query = query
    .order("favorite_count", { ascending: false, nullsFirst: false })
    .order("price_robux", { ascending: false, nullsFirst: false })
    .order("asset_id", { ascending: true })
    .range(safeOffset, safeOffset + safeLimit - 1);

  const { data, error } = await query;
  if (error) {
    console.error(`Failed to load avatar featured bucket ${bucket.id}`, error);
    return [];
  }
  return (data ?? []) as AvatarCatalogRow[];
}

function getPatternCounts(pattern: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const bucketId of pattern) {
    counts.set(bucketId, (counts.get(bucketId) ?? 0) + 1);
  }
  return counts;
}

function takeNextFeaturedRow(
  bucketId: string,
  rowsByBucket: Map<string, AvatarCatalogRow[]>,
  cursors: Map<string, number>,
  seen: Set<number>
): AvatarCatalogRow | null {
  const rows = rowsByBucket.get(bucketId) ?? [];
  let cursor = cursors.get(bucketId) ?? 0;

  while (cursor < rows.length) {
    const row = rows[cursor];
    cursor += 1;
    cursors.set(bucketId, cursor);
    if (!seen.has(row.asset_id)) {
      seen.add(row.asset_id);
      return row;
    }
  }

  cursors.set(bucketId, cursor);
  return null;
}

async function fetchFeaturedAvatarCatalogItems(
  config: AvatarCatalogConfig,
  page: number,
  limit: number,
  filters: AvatarCatalogResolvedSearch
): Promise<{ items: AvatarCatalogItem[]; total: number }> {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, Math.min(100, limit));
  const total = await fetchAvatarCatalogCount(config, filters);
  const buckets = getFeaturedBuckets(config);
  const bucketsById = new Map(buckets.map((bucket) => [bucket.id, bucket]));
  const pattern = getFeaturedPattern(config).filter((bucketId) => bucketsById.has(bucketId));
  const patternCounts = getPatternCounts(pattern);
  const rowsByBucket = new Map<string, AvatarCatalogRow[]>();

  await Promise.all(
    buckets.map(async (bucket) => {
      const slotsPerPage = patternCounts.get(bucket.id) ?? 1;
      const offset = (safePage - 1) * slotsPerPage;
      const bucketLimit = slotsPerPage + 10;
      const rows = await fetchFeaturedBucketRows({ config, bucket, filters, offset, limit: bucketLimit });
      rowsByBucket.set(bucket.id, rows);
    })
  );

  const selectedRows: AvatarCatalogRow[] = [];
  const seen = new Set<number>();
  const cursors = new Map<string, number>();

  for (const bucketId of pattern) {
    const row = takeNextFeaturedRow(bucketId, rowsByBucket, cursors, seen);
    if (row) selectedRows.push(row);
    if (selectedRows.length >= safeLimit) break;
  }

  if (selectedRows.length < safeLimit) {
    const pooledRows = Array.from(rowsByBucket.values())
      .flat()
      .sort((a, b) => {
        const favoriteDelta = (b.favorite_count ?? 0) - (a.favorite_count ?? 0);
        if (favoriteDelta !== 0) return favoriteDelta;
        const priceDelta = (b.price_robux ?? -1) - (a.price_robux ?? -1);
        if (priceDelta !== 0) return priceDelta;
        return a.asset_id - b.asset_id;
      });

    for (const row of pooledRows) {
      if (seen.has(row.asset_id)) continue;
      seen.add(row.asset_id);
      selectedRows.push(row);
      if (selectedRows.length >= safeLimit) break;
    }
  }

  if (selectedRows.length < safeLimit) {
    const fallbackRows = await fetchFeaturedBucketRows({
      config,
      bucket: featuredBucket("fallback", {}),
      filters,
      offset: (safePage - 1) * safeLimit,
      limit: safeLimit * 2
    });

    for (const row of fallbackRows) {
      if (seen.has(row.asset_id)) continue;
      seen.add(row.asset_id);
      selectedRows.push(row);
      if (selectedRows.length >= safeLimit) break;
    }
  }

  return {
    items: await decorateAvatarCatalogRows(selectedRows.slice(0, safeLimit)),
    total
  };
}

async function fetchAvatarCatalogItems(
  config: AvatarCatalogConfig,
  page: number,
  limit: number,
  filters: AvatarCatalogResolvedSearch
): Promise<{ items: AvatarCatalogItem[]; total: number }> {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, Math.min(100, limit));
  const offset = (safePage - 1) * safeLimit;
  const sb = supabaseAdmin();

  if (filters.sort === "featured") {
    return fetchFeaturedAvatarCatalogItems(config, safePage, safeLimit, filters);
  }

  let query = createAvatarCatalogBaseQuery(sb, true);
  query = applyScope(query, config.scope);
  query = applyAvatarCatalogFilters(query, filters);
  query = applyAvatarCatalogSort(query, filters.sort);
  query = query.range(offset, offset + safeLimit - 1);

  const { data, count, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as AvatarCatalogRow[];
  return {
    items: await decorateAvatarCatalogRows(rows),
    total: count ?? 0
  };
}

export async function listAvatarCatalogItems(
  config: AvatarCatalogConfig,
  page = 1,
  limit = AVATAR_CATALOG_PAGE_SIZE,
  filters: AvatarCatalogResolvedSearch
): Promise<{ items: AvatarCatalogItem[]; total: number }> {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, Math.min(100, limit));
  const cached = publicContentCache(
    () => fetchAvatarCatalogItems(config, safePage, safeLimit, filters),
    [`listAvatarCatalogItems:v3:${config.code}:${safePage}:${safeLimit}:${JSON.stringify(filters)}`],
    {
      revalidate: 3600,
      tags: ["avatar-catalog", `avatar-catalog:${config.code}`, `catalog:${config.code}`]
    }
  );
  return cached();
}

export async function getAvatarCatalogCount(
  config: Pick<AvatarCatalogConfig, "code" | "scope">,
  filters: AvatarCatalogResolvedSearch = { search: "", sort: "featured", sale: "all", creator: "all" }
): Promise<number> {
  const cached = publicContentCache(
    async () => {
      const sb = supabaseAdmin();
      let query = sb
        .from("roblox_catalog_items")
        .select("asset_id", { count: "exact", head: true })
        .eq("is_deleted", false)
        .not("name", "is", null)
        .not("category", "is", null)
        .not("subcategory", "is", null)
        .not("favorite_count", "is", null);
      query = applyScope(query, config.scope);
      query = applyAvatarCatalogFilters(query, filters);
      const { count, error } = await query;
      if (error) throw error;
      return count ?? 0;
    },
    [`getAvatarCatalogCount:v1:${config.code}:${JSON.stringify(filters)}`],
    {
      revalidate: 3600,
      tags: ["avatar-catalog", `avatar-catalog:${config.code}`, `catalog:${config.code}`]
    }
  );
  return cached();
}

export function prettyAvatarCatalogLabel(value: string | null | undefined): string {
  if (!value) return "Other";
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\bT Shirt\b/g, "T-Shirt")
    .replace(/\bDress Skirt\b/g, "Dresses & Skirts")
    .replace(/\bBody Parts Bundles\b/g, "Full Bodies")
    .replace(/\bAvatar Animations\b/g, "Avatar Animations")
    .trim();
}
