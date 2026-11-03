import { Children, isValidElement, type ReactElement } from "react";
import { expect, it, vi, beforeEach } from "vitest";
const state = vi.hoisted(() => ({ menu: vi.fn(), kind: "code", wiki: vi.fn(), collection: vi.fn(), specialized: vi.fn() }));
vi.mock("@/lib/game-site-data", () => ({ getGameMenuForPath: state.menu }));
vi.mock("@/lib/site-route-page", () => ({ getLiveSiteRoute: async () => ({ source: "game", page_type: state.kind, page_id: "page" }) }));
vi.mock("@/lib/game-registry", () => ({
 getGameRoot: async () => ({ id: "root", namespace: "test", title: "Test" }),
 getGameWikiById: async () => ({ id: "page", game_id: "root" }),
 getGameCollectionById: async () => ({ id: "page", game_id: "root" }),
 getGameCodeById: async () => ({ id: "page", game_id: "root" }),
 getGameToolById: async () => ({ id: "page", game_id: "root", slug: "test-tool" }),
}));
vi.mock("@/lib/game-root-page", () => ({ gameRootWikiPage: (_root: unknown, page: unknown) => page }));
vi.mock("@/lib/specialized-game-route", () => ({ specializedMinecraftToolRoute: state.specialized, specializedGtaMapRoute: state.specialized }));
vi.mock("@/lib/game-extra-pages", () => ({}));
vi.mock("@/lib/engagement/config", () => ({}));
vi.mock("@/lib/game-page-data", () => ({}));
vi.mock("@/lib/seo", () => ({}));
vi.mock("@/components/games/GameWikiPage", () => ({}));
vi.mock("@/components/games/GameWikiPage.server", () => ({ renderGameWikiPage: state.wiki }));
vi.mock("@/components/games/GameCollectionPage", () => ({ renderSharedGameCollection: state.collection }));
vi.mock("@/components/games/GameCodePage", () => ({ GameCodePage: () => null }));
vi.mock("@/components/games/GameToolPage", () => ({ GameToolPage: () => null }));
vi.mock("@/components/games/GameContentPage", () => ({}));
vi.mock("@/components/games/GameMap", () => ({}));
vi.mock("@/components/games/GameCatalog", () => ({}));
vi.mock("@/components/games/GameQuizPage", () => ({}));
vi.mock("@/components/ChecklistPageTemplate", () => ({}));
vi.mock("@/components/games/GameRelatedLinks", () => ({}));
import SharedGamePage from "../games/GameRoutePage";
import { GameMenuBridge } from "../games/GameMenuBridge";
const menu = { namespace: "test", title: "Test", href: "/wiki/test", image: "", pages: [] };
beforeEach(() => {
 state.kind = "code";
 state.menu.mockReset().mockResolvedValue(menu);
 state.wiki.mockReset().mockResolvedValue("Wiki body");
 state.collection.mockReset().mockResolvedValue("Collection body");
 state.specialized.mockReset().mockResolvedValue({ render: async () => "Specialized body" });
});
async function render(path = "/codes/test") {
 const page = await SharedGamePage({ params: Promise.resolve({ slug: "test", sitePath: path }) });
 const children = Children.toArray(page.props.children);
 const bridge = children[0];
 expect(isValidElement(bridge) && bridge.type).toBe(GameMenuBridge);
 return { bridge: bridge as ReactElement<{ path: string; menu: typeof menu | null }>, body: children[1] };
}
it("includes the server-built menu with a game page", async () => {
 const { bridge, body } = await render();
 expect(state.menu).toHaveBeenCalledExactlyOnceWith("/codes/test");
 expect(bridge.props).toEqual({ path: "/codes/test", menu });
 expect(isValidElement(body)).toBe(true);
});
it.each(["wiki", "collection", "tool"])("also bridges %s early-return renderers", async kind => {
 state.kind = kind;
 const { bridge, body } = await render("/wiki/test");
 expect(bridge.props.menu).toEqual(menu);
 expect(body).toBe(kind === "wiki" ? "Wiki body" : kind === "collection" ? "Collection body" : "Specialized body");
});
it("resolves paginated collections by base path and publishes the actual URL", async () => {
 state.kind = "collection";
 const { bridge } = await render("/wiki/test/items/page/2");
 expect(state.menu).toHaveBeenCalledExactlyOnceWith("/wiki/test/items");
 expect(bridge.props.path).toBe("/wiki/test/items/page/2");
});
it("keeps rendering the page when the menu builder rejects", async () => {
 state.menu.mockRejectedValue(new Error("Menu unavailable"));
 const { bridge, body } = await render();
 expect(bridge.props.menu).toBeNull();
 expect(isValidElement(body)).toBe(true);
});
it("keeps rendering when the menu builder returns no menu", async () => {
 state.menu.mockResolvedValue(null);
 const { bridge, body } = await render();
 expect(bridge.props.menu).toBeNull();
 expect(isValidElement(body)).toBe(true);
});
