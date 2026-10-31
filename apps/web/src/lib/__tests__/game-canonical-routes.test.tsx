import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SharedGameGame, SharedGameWikiPage } from "../shared-game-reader";

const state = vi.hoisted(() => ({ published: true, wikiPublished: true, wrongOwner: false, independentWiki: false, independentCode: false, rootWikiError: false, directory: false }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@/lib/game-registry", () => ({
  getGameRoot: async (namespace: string) => state.published ? root(namespace) : null,
  getGameWikiByPath: async (namespace: string, path: string) => {
    if (state.rootWikiError && path === `/${namespace}/wiki`) throw new Error("Root wiki unavailable");
    if (state.independentWiki && path === `/${namespace}`) return { ...wiki(namespace), id: "distinct-root", canonical_path: path };
    return state.wikiPublished && path === `/${namespace}/wiki` ? wiki(namespace) : null;
  },
  getGameCollectionByPath: async () => null,
  getGameToolByPath: async () => null,
  getGameCodeByPath: async (namespace: string, path: string) => state.independentCode && path === `/${namespace}` ? { id: "root-codes", namespace, title: "Independent codes", canonical_path: path } : null,
  getGameDirectoryPages: async () => state.directory ? [{ href: "/future-game/tools/example", title: "Example", image: null }] : []
}));
vi.mock("@/lib/game-landing", async () => {
  const { gameLandingPath } = await import("../game-root-page");
  const getGameLanding = async (namespace: string) => {
    if (state.rootWikiError) throw new Error("Root wiki unavailable");
    const game = state.published ? root(namespace) : null;
    const page = game && state.wikiPublished ? wiki(namespace) : null;
    const hasIndependentRoot = state.independentWiki || state.independentCode;
    return { root: game, wiki: page, hasIndependentRoot, path: game ? gameLandingPath(game, page, hasIndependentRoot) : `/${namespace}` };
  };
  return { getGameLanding, getGameLandingForLinks: async (namespace: string) => {
    try { return await getGameLanding(namespace); } catch { return { path: `/${namespace}` }; }
  } };
});
vi.mock("@/components/games/GameWikiPage.server", () => ({ renderGameWikiPage: async ({ page }: { page: SharedGameWikiPage }) => <div data-route-path={page.canonical_path} data-wiki-id={page.id} /> }));
vi.mock("@/components/games/GameCollectionPage", () => ({ gameCollectionMetadata: vi.fn(), renderSharedGameCollection: vi.fn() }));
vi.mock("@/components/games/GameCodePage", () => ({ GameCodePage: () => null }));
vi.mock("@/components/games/GameToolPage", () => ({ GameToolPage: () => null, gameToolMetadata: vi.fn() }));
vi.mock("@/components/games/GameContentPage", () => ({ GameContentPage: () => null, gameContentMetadata: vi.fn() }));
vi.mock("@/components/games/GameQuizPage", () => ({ GameQuizPage: () => null, gameQuizMetadata: vi.fn() }));
vi.mock("@/components/games/GameRelatedLinks", () => ({ GameRelatedLinks: () => null }));
vi.mock("@/components/games/GameMap", () => ({ GameMap: () => null }));
vi.mock("@/components/games/GameCatalog", () => ({ GameCatalog: () => null }));
vi.mock("@/components/ChecklistPageTemplate", () => ({ ChecklistPageTemplate: () => null, checklistMetadata: vi.fn() }));
vi.mock("@/lib/game-extra-pages", () => ({ getGameExtendedPage: async () => null, getGameChecklistByPath: async () => null }));
// These cases cover the by-path readers, so the route table read reports "unavailable".
vi.mock("@/lib/site-route-page", () => ({ getLiveSiteRoute: async () => undefined }));

import GtaRoot, { generateMetadata as gtaMetadata } from "@/app/(site)/gta/page";
import RedDeadRoot, { generateMetadata as redDeadMetadata } from "@/app/(site)/red-dead/page";
import MinecraftRoot, { generateMetadata as minecraftMetadata } from "@/app/(site)/minecraft/page";
import { generateMetadata as gtaWikiMetadata } from "@/app/(site)/gta/wiki/page";
import { generateMetadata as redDeadWikiMetadata } from "@/app/(site)/red-dead/wiki/page";
import { generateMetadata as minecraftWikiMetadata } from "@/app/(site)/minecraft/wiki/page";
import GenericRoot, { generateMetadata as genericMetadata } from "@/app/(site)/[slug]/[[...segments]]/page";

function root(namespace: string): SharedGameGame {
  return { id: "root", namespace, kind: ["gta", "future-franchise"].includes(namespace) ? "franchise" : "game", slug: namespace, title: namespace, is_published: true, parent_id: null } as SharedGameGame;
}
function wiki(namespace: string): SharedGameWikiPage {
  return { id: "wiki", game_id: state.wrongOwner ? "child" : "root", namespace, canonical_path: `/${namespace}/wiki`, slug: namespace, title: `${namespace} wiki`, game_title: namespace, game_kind: root(namespace).kind, is_published: true } as SharedGameWikiPage;
}
const genericProps = (slug: string, segments?: string[]) => ({ params: Promise.resolve({ slug, segments }) });
const routes = [
  { namespace: "gta", metadata: gtaMetadata, render: GtaRoot },
  { namespace: "red-dead", metadata: redDeadMetadata, render: RedDeadRoot },
  { namespace: "minecraft", metadata: minecraftMetadata, render: MinecraftRoot },
  { namespace: "future-game", metadata: () => genericMetadata(genericProps("future-game")), render: () => GenericRoot(genericProps("future-game")) },
  { namespace: "future-franchise", metadata: () => genericMetadata(genericProps("future-franchise")), render: () => GenericRoot(genericProps("future-franchise")) }
];

beforeEach(() => { state.published = true; state.wikiPublished = true; state.wrongOwner = false; state.independentWiki = false; state.independentCode = false; state.rootWikiError = false; state.directory = false; });

describe.each(routes)("$namespace bare root", ({ namespace, metadata, render }) => {
  it("renders the existing alias and uses the owned wiki canonical and OG URL", async () => {
    const result = await metadata();
    expect(result.alternates?.canonical).toBe(`https://bloxodes.com/${namespace}/wiki`);
    expect(result.openGraph).toMatchObject({ url: `https://bloxodes.com/${namespace}/wiki` });
    const body = await render();
    expect(body.props).toMatchObject({ "data-route-path": `/${namespace}`, "data-wiki-id": "wiki" });
  });
  it.each(["missing wiki", "wrong owner"])("keeps a self-canonical root for %s", async reason => {
    state.wikiPublished = reason !== "missing wiki";
    state.wrongOwner = reason === "wrong owner";
    const result = await metadata();
    expect(result.alternates?.canonical).toBe(`https://bloxodes.com/${namespace}`);
    expect((await render()).props).toMatchObject({ "data-route-path": `/${namespace}`, "data-wiki-id": "root" });
  });
  it("retains 404 behavior for an unpublished or unknown registry root", async () => {
    state.published = false;
    await expect(render()).rejects.toThrow("NOT_FOUND");
    await expect(metadata()).rejects.toThrow("NOT_FOUND");
  });
});

describe("generic exact content precedence", () => {
  it("keeps separately stored root wiki content and its self-canonical", async () => {
    state.independentWiki = true;
    const props = genericProps("future-game");
    expect((await genericMetadata(props)).alternates?.canonical).toBe("https://bloxodes.com/future-game");
    expect((await GenericRoot(props)).props).toMatchObject({ "data-wiki-id": "distinct-root", "data-route-path": "/future-game" });
  });
  it("keeps separately stored root codes content and metadata", async () => {
    state.independentCode = true;
    const props = genericProps("future-game");
    const metadata = await genericMetadata(props);
    expect(metadata.alternates?.canonical).toBe("https://bloxodes.com/future-game");
    expect(metadata.title).toBe("Independent codes");
    expect((await GenericRoot(props)).props.page.id).toBe("root-codes");
  });
  it("keeps the published wiki target self-canonical", async () => {
    const props = genericProps("future-game", ["wiki"]);
    expect((await genericMetadata(props)).alternates?.canonical).toBe("https://bloxodes.com/future-game/wiki");
    expect((await GenericRoot(props)).props).toMatchObject({ "data-route-path": "/future-game/wiki", "data-wiki-id": "wiki" });
  });
});

it.each([
  { namespace: "gta", metadata: gtaWikiMetadata },
  { namespace: "red-dead", metadata: redDeadWikiMetadata },
  { namespace: "minecraft", metadata: minecraftWikiMetadata }
])("keeps the explicit $namespace wiki target self-canonical", async ({ namespace, metadata }) => {
  const result = await metadata();
  expect(result.alternates?.canonical).toBe(`https://bloxodes.com/${namespace}/wiki`);
  expect(result.openGraph).toMatchObject({ url: `https://bloxodes.com/${namespace}/wiki` });
});


describe("generic directory optional landing lookup", () => {
  it("keeps a valid section directory when only the root wiki lookup fails", async () => {
    state.rootWikiError = true;
    state.directory = true;
    const body = await GenericRoot(genericProps("future-game", ["tools"]));
    const breadcrumb = body.props.children[0].props.children[0];
    expect(breadcrumb.props.items).toContainEqual({ label: "future-game", href: "/future-game" });
  });
});
