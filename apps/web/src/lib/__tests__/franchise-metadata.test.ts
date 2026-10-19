import { describe, expect, it, vi } from "vitest";
import { checklistMetadata } from "@/components/ChecklistPageTemplate";
import { gameCollectionMetadata } from "@/components/games/GameCollectionPage";
import { gameWikiMetadata } from "@/components/games/GameWikiPage";
import { gameRootWikiPage } from "../game-root-page";
import { ROBLOX_CHECKLISTS, GTA_CHECKLISTS } from "../engagement/config";
import type { SharedGameGame, SharedGameWikiPage, SharedGameWikiCollectionPage } from "../shared-game-reader";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/shared-game-reader", () => ({ createGameReader: () => ({ getPublishedSharedGameWikiCollectionRuntime: async () => ({ document: { items: [{ system: { image: null } }, { system: { image: "https://media.bloxodes.com/item.webp" } }] }, config: {} }) }) }));
vi.mock("@/app/(site)/wiki/collections/games/generic", () => ({ prepareGameCollectionDocument: () => ({ totalPages: 2 }), renderGameCollectionPage: vi.fn() }));
vi.mock("@/components/games/GameCollectibleCollectionPage", () => ({ renderGameCollectibleCollectionPage: vi.fn() }));
vi.mock("@/components/games/GameRelatedLinks", () => ({ GameRelatedLinks: vi.fn() }));
vi.mock("@/lib/game-registry", () => ({ getGameDirectoryPages: vi.fn() }));

describe("franchise social image adapters", () => {
  it("uses a collection item image, including paginated social previews", async () => {
    const page = { namespace: "example", code: "child-items", title: "Child Items", seo_title: "Child Items", canonical_path: "/example/wiki/child/items", page_type: "database", meta_description: "Every item.", thumb_url: "https://media.bloxodes.com/wrong.webp" } as SharedGameWikiCollectionPage;
    for (const current of [1, 2]) {
      const metadata = await gameCollectionMetadata(page, current);
      expect(metadata.openGraph).toMatchObject({ images: ["https://media.bloxodes.com/item.webp"], url: `https://bloxodes.com${page.canonical_path}${current === 1 ? "" : "/page/2"}` });
      expect(metadata.twitter).toMatchObject({ images: ["https://media.bloxodes.com/item.webp"] });
    }
  });
  it("uses the root's artwork and identity for a namespace landing page", () => {
    const game = { id: "root", namespace: "example", slug: "example", title: "Example", kind: "franchise", cover_image: "https://media.bloxodes.com/root-cover.webp", hero_image: "https://media.bloxodes.com/root-square.webp", description_md: "Example games.", updated_at: "2026-01-01" } as SharedGameGame;
    const page = gameRootWikiPage(game);
    expect(page).toMatchObject({ game_id: "root", canonical_path: "/example", game_kind: "franchise", game_hero_image: game.hero_image });
    expect(gameWikiMetadata(page).openGraph).toMatchObject({ images: [game.cover_image], url: "https://bloxodes.com/example" });
    const wiki = { ...page, id: "wiki", canonical_path: "/example/wiki", description_md: "Full wiki copy.", tips_md: "Gameplay tips." };
    expect(gameRootWikiPage(game, wiki)).toMatchObject({ id: "wiki", canonical_path: "/example", description_md: wiki.description_md, tips_md: wiki.tips_md });
    expect(gameRootWikiPage(game, { ...wiki, game_id: "sibling" } as SharedGameWikiPage).description_md).toBe(game.description_md);
  });
  it("adds franchise checklist social artwork while preserving the Roblox metadata contract", () => {
    const data = { page: { id: "checklist", slug: "child", title: "Child", created_at: "2026-01-01", updated_at: "2026-01-01", image: "https://media.bloxodes.com/child.webp" }, items: [] };
    expect(checklistMetadata(data, GTA_CHECKLISTS).openGraph).toMatchObject({ images: [data.page.image] });
    expect(checklistMetadata(data, ROBLOX_CHECKLISTS).openGraph).not.toHaveProperty("images");
    expect(checklistMetadata(data, ROBLOX_CHECKLISTS).twitter).toMatchObject({ card: "summary" });
  });
});
