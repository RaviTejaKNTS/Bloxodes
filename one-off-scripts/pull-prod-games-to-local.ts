import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  createTargetClient,
  fetchAllRows,
  fetchRowsByValues,
  getTargetConfig,
  upsertRows
} from "./supabase-env";

type GameRow = Record<string, unknown> & {
  id: string;
  author_id?: string | null;
  universe_id?: number | null;
};

const AUTHOR_COLUMNS = [
  "id",
  "name",
  "slug",
  "gravatar_email",
  "avatar_url",
  "bio_md",
  "twitter",
  "youtube",
  "website",
  "created_at",
  "updated_at",
  "facebook",
  "linkedin",
  "instagram",
  "roblox",
  "discord"
];

const UNIVERSE_COLUMNS = [
  "universe_id",
  "root_place_id",
  "name",
  "display_name",
  "slug",
  "description",
  "description_source",
  "creator_id",
  "creator_name",
  "creator_type",
  "creator_has_verified_badge",
  "group_id",
  "group_name",
  "group_has_verified_badge",
  "visibility",
  "privacy_type",
  "is_active",
  "is_archived",
  "is_sponsored",
  "genre",
  "genre_l1",
  "genre_l2",
  "is_all_genre",
  "age_rating",
  "universe_avatar_type",
  "desktop_enabled",
  "mobile_enabled",
  "tablet_enabled",
  "console_enabled",
  "vr_enabled",
  "voice_chat_enabled",
  "price",
  "private_server_price_robux",
  "create_vip_servers_allowed",
  "studio_access_allowed",
  "max_players",
  "server_size",
  "playing",
  "visits",
  "favorites",
  "likes",
  "dislikes",
  "icon_url",
  "thumbnail_urls",
  "social_links",
  "raw_metadata",
  "raw_details",
  "first_seen_at",
  "last_seen_in_sort",
  "last_seen_in_search",
  "created_at",
  "updated_at",
  "game_description_md",
  "created_at_api",
  "updated_at_api"
];

const GAME_COLUMNS = [
  "id",
  "name",
  "slug",
  "source_url",
  "cover_image",
  "seo_title",
  "seo_description",
  "description_md",
  "is_published",
  "created_at",
  "updated_at",
  "intro_md",
  "redeem_md",
  "author_id",
  "expired_codes",
  "source_url_2",
  "source_url_3",
  "roblox_link",
  "twitter_link",
  "discord_link",
  "community_link",
  "youtube_link",
  "internal_links",
  "universe_id",
  "rewards_md",
  "troubleshoot_md",
  "about_game_md",
  "old_slugs",
  "re_rewritten_at",
  "interlinking_ai",
  "interlinking_ai_copy_md",
  "published_at",
  "find_codes_md"
];

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function pickColumns<T extends Record<string, unknown>>(row: T, columns: string[]): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const column of columns) {
    if (Object.prototype.hasOwnProperty.call(row, column)) {
      next[column] = row[column];
    }
  }
  return next;
}

async function writeBackup(games: GameRow[]) {
  const outputDir = path.resolve(process.cwd(), "one-off-scripts/.tmp");
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `prod-games-${timestamp()}.json`);
  await writeFile(outputPath, JSON.stringify(games, null, 2));
  return outputPath;
}

async function main() {
  const prodConfig = getTargetConfig("prod");
  const localConfig = getTargetConfig("local");
  const prod = createTargetClient("prod");
  const local = createTargetClient("local");

  console.log(`Using prod env: ${prodConfig.envPath}`);
  console.log(`Using local env: ${localConfig.envPath}`);

  const games = await fetchAllRows<GameRow>(prod, "games", "*", "id");
  if (!games.length) {
    throw new Error("Production games table returned no rows; refusing to write local data.");
  }

  const backupPath = await writeBackup(games);
  console.log(`Backed up ${games.length} production games to ${backupPath}`);

  const authorIds = games.map((game) => game.author_id).filter((id): id is string => typeof id === "string" && id.length > 0);
  const universeIds = games
    .map((game) => game.universe_id)
    .filter((id): id is number => typeof id === "number" && Number.isFinite(id));

  if (authorIds.length) {
    const authors = await fetchRowsByValues<Record<string, unknown>>(prod, "authors", "id", authorIds, AUTHOR_COLUMNS.join(","));
    await upsertRows(local, "authors", authors, "id");
    console.log(`Upserted ${authors.length} referenced authors into local.`);
  }

  if (universeIds.length) {
    const universes = await fetchRowsByValues<Record<string, unknown>>(
      prod,
      "roblox_universes",
      "universe_id",
      universeIds,
      UNIVERSE_COLUMNS.join(",")
    );
    await upsertRows(local, "roblox_universes", universes, "universe_id");
    console.log(`Upserted ${universes.length} referenced Roblox universes into local.`);
  }

  await upsertRows(local, "games", games.map((game) => pickColumns(game, GAME_COLUMNS)), "id", 50);
  console.log(`Upserted ${games.length} production games into local.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
