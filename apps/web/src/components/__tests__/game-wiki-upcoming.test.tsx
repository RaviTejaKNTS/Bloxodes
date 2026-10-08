import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SharedGameWikiCollectionPage, SharedGameWikiPage } from "@/lib/shared-game-reader";

const reader = vi.hoisted(() => ({
  listPublishedSharedGameWikiCollectionsByWikiSlug: vi.fn(),
  listPublishedSharedGameWikiCollectionImageUrls: vi.fn(async () => []),
  resolveSharedGameWikiCoverImage: () => "/cover.webp",
  resolveSharedGameWikiThumbnailImage: () => "/hero.webp"
}));
vi.mock("@/lib/shared-game-reader", () => ({ createGameReader: () => reader }));
vi.mock("@/lib/markdown", () => ({ markdownToPlainText: (value: string) => value, renderMarkdown: async (value: string) => value }));
vi.mock("@/lib/page-content", () => ({ renderPageContentNodes: (html: string) => html }));
vi.mock("@/components/comments/CommentsSection", () => ({ CommentsSection: () => null }));
vi.mock("@/components/UpdatedTimestamp", () => ({ UpdatedTimestamp: () => null }));
vi.mock("@/components/wiki/WikiCollectionCta", () => ({
  WikiCollectionCta: ({ href, title }: { href: string; title: string }) => <a href={href}>{title}</a>
}));
vi.mock("next/image", () => ({ default: () => null }));

import { gameWikiMetadata, renderGameWikiPage } from "@/components/games/GameWikiPage";

// These are renderer fixtures, not verified release or content data.
const page: SharedGameWikiPage = {
  id: "wiki", game_id: "game", namespace: "gta", canonical_path: "/gta/wiki/gta-6", slug: "gta-6",
  title: "GTA VI Wiki", seo_title: null, meta_description: "Announced game details.",
  description_md: "Official announcements.", cover_image: null, controls_json: [], tips_md: null,
  is_published: true, published_at: "2026-10-01T00:00:00Z", created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-02T00:00:00Z", content_updated_at: "2026-10-02T00:00:00Z",
  game_title: "Grand Theft Auto VI", game_short_title: "GTA VI", game_installment: null,
  game_content_kind: "game", game_parent_game_id: null, game_kind: "game", parent_id: "franchise",
  game_developer: "Developer", game_publisher: "Publisher", game_description_md: null,
  game_cover_image: "/cover.webp", game_hero_image: "/hero.webp", game_official_url: null,
  game_release_dates_json: { announced: "2030-11-19" }, game_platforms_json: ["Console"], game_status: "upcoming"
};

async function render(overrides: Partial<SharedGameWikiPage> = {}) {
  return renderToStaticMarkup(await renderGameWikiPage({ page: { ...page, ...overrides }, namespace: "gta", namespaceTitle: "GTA" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  reader.listPublishedSharedGameWikiCollectionsByWikiSlug.mockResolvedValue([]);
});

describe("upcoming game wiki rendering", () => {
  it("shows upcoming status and the stored announced release without empty gameplay sections", async () => {
    const html = await render();
    expect(html).toContain("Upcoming");
    expect(html).toContain("Announced release");
    expect(html).toContain("2030-11-19");
    for (const heading of ["Controls", "gameplay tips", "Game data", "Collectibles", "Pre-launch coverage"]) {
      expect(html).not.toContain(heading);
    }
  });

  it("renders published collections as pre-launch coverage with their stored canonical URLs", async () => {
    reader.listPublishedSharedGameWikiCollectionsByWikiSlug.mockResolvedValue([{
      id: "characters", code: "gta-6-characters", display_name: "Characters", title: "GTA VI characters",
      canonical_path: "/gta/wiki/gta-6/characters", page_type: "database", wiki_md: "Announced characters."
    } as SharedGameWikiCollectionPage]);
    const html = await render({ tips_md: "Check official announcements." });
    expect(html).toContain("Pre-launch coverage");
    expect(html).toContain('href="/gta/wiki/gta-6/characters"');
    expect(html).toContain("pre-launch notes");
    expect(html).not.toContain("gameplay tips");
  });

  it("keeps page publication dates separate from the game release in metadata and JSON-LD", async () => {
    const html = await render();
    const jsonLd = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)?.[1];
    expect(jsonLd).toBeDefined();
    const graph = JSON.parse(jsonLd!)["@graph"];
    expect(graph.find((entity: { "@type": string }) => entity["@type"] === "VideoGame")).toBeUndefined();
    expect(graph[0].datePublished).toBe(page.published_at);
    expect(gameWikiMetadata(page).alternates?.canonical).toBe("https://bloxodes.com/gta/wiki/gta-6");
  });

  it("preserves released game labels and renders announced games without inventing a release date", async () => {
    const released = await render({ game_status: "released", tips_md: "Verified gameplay tip." });
    expect(released).toContain("gameplay tips");
    expect(released).not.toContain("Upcoming");
    expect(released).not.toContain("Announced release");
    const announced = await render({ game_status: "announced", game_release_dates_json: null });
    expect(announced).toContain("Announced");
    expect(announced).not.toContain("Announced release");
    expect(announced).not.toContain("2030-11-19");
  });
});
