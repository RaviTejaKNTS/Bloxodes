import { beforeEach, describe, expect, it, vi } from "vitest";
import { getGameSidebarData } from "@/lib/game-sidebar";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ wiki: vi.fn(), stats: vi.fn() }));
vi.mock("@/lib/wiki", () => ({ getWikiByUniverseId: mocks.wiki }));
vi.mock("@/lib/stats", () => ({ getUniverseStatsSummary: mocks.stats }));
vi.mock("@/lib/db", () => ({
  getEventsPageByUniverseId: vi.fn().mockResolvedValue(null),
  listCodePagesWithActiveCountsByUniverseId: vi.fn().mockResolvedValue([]),
  listPublishedArticles: vi.fn().mockResolvedValue([]),
  listPublishedArticlesByUniverseId: vi.fn().mockResolvedValue([]),
  listPublishedChecklistsByUniverseId: vi.fn().mockResolvedValue([])
}));
vi.mock("@/lib/events-summary", () => ({ getUniverseEventSummary: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/quizzes", () => ({ getQuizByUniverseId: vi.fn().mockResolvedValue(null), loadQuizData: vi.fn() }));
vi.mock("@/lib/quiz-attempts", () => ({ buildServerQuizAttempt: vi.fn() }));
vi.mock("@/lib/tools", () => ({ listPublishedToolsByUniverseId: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/wiki-collections", () => ({
  buildWikiCollectionPath: vi.fn(),
  listPublishedWikiCollectionPagesByUniverseId: vi.fn().mockResolvedValue([])
}));
vi.mock("@/lib/catalog", () => ({ listPublishedTopLevelCatalogPages: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/catalog-card-meta", () => ({ resolveCatalogCardMeta: vi.fn() }));

const universeId = 4730278139;
const currentIcon = "https://tr.rbxcdn.com/180DAY-8e2390f763eca0caafe9b27e567bf0c5/512/512/Image/Png/noFilter";
const staleIcon = "https://tr.rbxcdn.com/180DAY-940d999a498d64db091dc1fbd8708f8f/512/512/Image/Png/noFilter";
const wiki = { slug: "untitled-boxing-game", title: "Untitled Boxing Game Wiki", iconUrl: currentIcon };
const stats = { rank: 123, playing: 456, slug: "untitled-boxing-game-4730278139", iconUrl: staleIcon };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.wiki.mockResolvedValue(wiki);
  mocks.stats.mockResolvedValue(stats);
});

describe("sidebar universe media", () => {
  it("uses refreshed wiki media when the stats index still contains an expired icon", async () => {
    const sidebar = await getGameSidebarData(universeId);

    expect(sidebar.universeIcon).toBe(currentIcon);
    expect(sidebar.wiki).toEqual(wiki);
    expect(sidebar.stats).toEqual(stats);
    expect(mocks.wiki).toHaveBeenCalledWith(universeId);
    expect(mocks.stats).toHaveBeenCalledWith(universeId);
  });

  it.each([null, { ...wiki, iconUrl: null }])("retains the stats icon fallback without wiki media (%j)", async value => {
    mocks.wiki.mockResolvedValue(value);

    expect((await getGameSidebarData(universeId)).universeIcon).toBe(staleIcon);
  });

  it("keeps refreshed wiki media available when the stats summary is unavailable", async () => {
    mocks.stats.mockResolvedValue(null);

    expect((await getGameSidebarData(universeId)).universeIcon).toBe(currentIcon);
  });
});
