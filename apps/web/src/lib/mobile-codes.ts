import { cleanRewardsText, isCodeNew, sortCodesByFirstSeenDesc } from "@/lib/code-utils";
import { getGameBySlug, listCodesForGame, listGamesWithActiveCountsPage, type Code, type GameWithCounts } from "@/lib/db";
import { SITE_URL } from "@/lib/seo";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export type MobileCodesIndexItem = {
  id: string;
  name: string;
  slug: string;
  coverImage: string | null;
  activeCount: number;
  latestCodeFirstSeenAt: string | null;
  contentUpdatedAt: string | null;
  genre: string | null;
  url: string;
};

export type MobileCodeItem = {
  id: string;
  code: string;
  status: Code["status"];
  rewardText: string | null;
  levelRequirement: number | null;
  isNew: boolean;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
};

export type MobileCodesIndexPayload = {
  ok: true;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  games: MobileCodesIndexItem[];
};

export type MobileCodeDetailPayload = {
  ok: true;
  game: {
    id: string;
    name: string;
    slug: string;
    coverImage: string | null;
    description: string | null;
    url: string;
    robloxUrl: string | null;
    contentUpdatedAt: string | null;
  };
  activeCodes: MobileCodeItem[];
  expiredCodes: MobileCodeItem[];
};

function normalizePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

function normalizePageSize(value: string | null): number {
  return Math.min(MAX_PAGE_SIZE, normalizePositiveInt(value, DEFAULT_PAGE_SIZE));
}

function absoluteAssetUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${SITE_URL.replace(/\/$/, "")}/${value.replace(/^\//, "")}`;
}

function mapIndexGame(game: GameWithCounts): MobileCodesIndexItem {
  return {
    id: game.id,
    name: game.name,
    slug: game.slug,
    coverImage: absoluteAssetUrl(game.cover_image),
    activeCount: game.active_count ?? 0,
    latestCodeFirstSeenAt: game.latest_code_first_seen_at ?? null,
    contentUpdatedAt: game.content_updated_at ?? game.updated_at ?? null,
    genre: game.genre_l2 ?? game.genre_l1 ?? null,
    url: `${SITE_URL}/codes/${game.slug}`
  };
}

function mapCode(code: Code, nowMs: number): MobileCodeItem {
  return {
    id: code.id,
    code: code.code,
    status: code.status,
    rewardText: cleanRewardsText(code.rewards_text),
    levelRequirement: code.level_requirement,
    isNew: isCodeNew(code, nowMs),
    firstSeenAt: code.first_seen_at ?? null,
    lastSeenAt: code.last_seen_at ?? null
  };
}

export async function getMobileCodesIndex(searchParams: URLSearchParams): Promise<MobileCodesIndexPayload> {
  const page = normalizePositiveInt(searchParams.get("page"), 1);
  const pageSize = normalizePageSize(searchParams.get("pageSize"));
  const { games, total } = await listGamesWithActiveCountsPage(page, pageSize);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    ok: true,
    page,
    pageSize,
    total,
    totalPages,
    games: games.map(mapIndexGame)
  };
}

export async function getMobileCodeDetail(slug: string): Promise<MobileCodeDetailPayload | null> {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) return null;

  const game = await getGameBySlug(normalizedSlug);
  if (!game || !game.is_published) return null;

  const nowMs = Date.now();
  const codes = await listCodesForGame(game.id);
  const activeCodes = sortCodesByFirstSeenDesc(codes.filter((code) => code.status === "active")).map((code) => mapCode(code, nowMs));
  const expiredCodes = sortCodesByFirstSeenDesc(codes.filter((code) => code.status === "expired")).map((code) => mapCode(code, nowMs));

  return {
    ok: true,
    game: {
      id: game.id,
      name: game.name,
      slug: game.slug,
      coverImage: absoluteAssetUrl(game.cover_image),
      description: game.seo_description ?? game.intro_md ?? null,
      url: `${SITE_URL}/codes/${game.slug}`,
      robloxUrl: game.roblox_link ?? null,
      contentUpdatedAt: game.re_rewritten_at ?? game.updated_at ?? null
    },
    activeCodes,
    expiredCodes
  };
}
