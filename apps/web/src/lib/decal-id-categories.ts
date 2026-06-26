export type DecalCategoryDefinition = {
  slug: string;
  label: string;
  description: string;
  keywords: string[];
};

export const DECAL_CATEGORY_DEFINITIONS: DecalCategoryDefinition[] = [
  {
    slug: "memes",
    label: "Memes",
    description: "Reaction images, jokes, internet memes, and funny Roblox decals.",
    keywords: ["meme", "funny", "troll", "rickroll", "doge", "shrek", "rock", "poop", "clown", "cheems"]
  },
  {
    slug: "anime",
    label: "Anime",
    description: "Anime character images, manga art, and anime-inspired decals.",
    keywords: ["anime", "naruto", "goku", "vegeta", "luffy", "one piece", "dragon ball", "kawaii", "haki"]
  },
  {
    slug: "aesthetic",
    label: "Aesthetic",
    description: "Soft, cute, room, vibe, and decorative aesthetic image IDs.",
    keywords: ["aesthetic", "soft", "pink", "purple", "cute", "kawaii", "wallpaper", "vibe"]
  },
  {
    slug: "cute",
    label: "Cute",
    description: "Cute characters, pets, plush-style images, and friendly decals.",
    keywords: ["cute", "cat", "kitty", "dog", "pet", "hello kitty", "otter", "bunny", "kawaii"]
  },
  {
    slug: "scary",
    label: "Scary",
    description: "Horror, cursed, spooky, and scary image decals.",
    keywords: ["scary", "horror", "cursed", "creepy", "doors", "void", "dark", "scream"]
  },
  {
    slug: "faces",
    label: "Faces",
    description: "Face decals, eyes, expressions, and character heads.",
    keywords: ["face", "eyes", "head", "smile", "expression", "noob", "girl", "boy"]
  },
  {
    slug: "logos",
    label: "Logos",
    description: "Brand, group, game, icon, and logo-style decals.",
    keywords: ["logo", "icon", "robux", "roblox", "group", "brand", "badge"]
  },
  {
    slug: "posters",
    label: "Posters",
    description: "Poster-style images for walls, signs, rooms, and builds.",
    keywords: ["poster", "wall", "room", "sign", "billboard", "decor"]
  },
  {
    slug: "textures",
    label: "Textures",
    description: "Patterns, transparent images, material decals, and build textures.",
    keywords: ["texture", "transparent", "pattern", "pixel", "graffiti", "material", "wallpaper"]
  },
  {
    slug: "characters",
    label: "Characters",
    description: "Roblox, game, streamer, movie, and pop-culture character decals.",
    keywords: ["character", "sonic", "minecraft", "among us", "squid game", "superman", "mrbeast", "speed", "kai"]
  },
  {
    slug: "fashion",
    label: "Fashion",
    description: "Hair, clothing, hoodie, outfit, accessory, and avatar-style images.",
    keywords: ["hair", "shirt", "hoodie", "clothing", "outfit", "accessory", "headphones"]
  },
  {
    slug: "music",
    label: "Music",
    description: "Music, band, album, artist, and audio-themed decal images.",
    keywords: ["music", "song", "band", "album", "artist", "fnf", "friday night funkin"]
  }
];

const CATEGORY_BY_SLUG = new Map(DECAL_CATEGORY_DEFINITIONS.map((category) => [category.slug, category]));
const SHORT_KEYWORDS = new Set(["cat", "dog", "boy"]);

const SOURCE_CATEGORY_ALIASES: Record<string, string> = {
  meme: "memes",
  funny: "memes",
  anime: "anime",
  aesthetic: "aesthetic",
  cute: "cute",
  cat: "cute",
  scary: "scary",
  horror: "scary",
  cursed: "scary",
  face: "faces",
  eyes: "faces",
  logo: "logos",
  icon: "logos",
  poster: "posters",
  sign: "posters",
  wallpaper: "textures",
  texture: "textures",
  transparent: "textures",
  pixel: "textures",
  graffiti: "textures",
  cartoon: "characters",
  crosshair: "logos",
  flag: "logos",
  cool: "aesthetic",
  girl: "faces",
  boy: "faces",
  hair: "fashion",
  shirt: "fashion",
  hoodie: "fashion",
  music: "music"
};

export function normalizeCategorySlug(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!normalized) return null;
  return CATEGORY_BY_SLUG.has(normalized) ? normalized : SOURCE_CATEGORY_ALIASES[normalized] ?? null;
}

export function getDecalCategoryLabel(slug: string): string {
  return CATEGORY_BY_SLUG.get(slug)?.label ?? slug.replace(/-/g, " ");
}

export function getDecalCategoryDescription(slug: string): string {
  return CATEGORY_BY_SLUG.get(slug)?.description ?? "Browse Roblox decal IDs in this category.";
}

export function normalizeDecalCategorySlugs(values: Array<string | null | undefined>): string[] {
  const slugs = new Set<string>();
  for (const value of values) {
    const slug = normalizeCategorySlug(value);
    if (slug) slugs.add(slug);
  }
  return Array.from(slugs);
}

export function inferDecalCategorySlugs(values: Array<string | null | undefined>): string[] {
  const text = values
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" ")
    .toLowerCase();
  const slugs = new Set<string>();

  for (const value of values) {
    const direct = normalizeCategorySlug(value);
    if (direct) slugs.add(direct);
  }

  for (const category of DECAL_CATEGORY_DEFINITIONS) {
    if (category.keywords.some((keyword) => keywordMatches(text, keyword))) {
      slugs.add(category.slug);
    }
  }

  return Array.from(slugs).slice(0, 4);
}

function keywordMatches(text: string, keyword: string): boolean {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return false;
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const needsBoundary = normalized.includes(" ") || normalized.length <= 4 || SHORT_KEYWORDS.has(normalized);
  if (!needsBoundary) return text.includes(normalized);
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
}
