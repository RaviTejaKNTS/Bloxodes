import { load } from "cheerio";
import React, { type ReactNode, type FunctionComponent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { Metadata } from "next";
import type { GameCollectionView } from "@/components/game-collections/GameCollectionView";
import type { GameCollectibleChecklist } from "@/components/games/GameCollectibleChecklist";
import type { CommentsSection } from "@/components/comments/CommentsSection";
import type { ChecklistBoard } from "@/components/ChecklistBoard";
import type { MinecraftToolClient } from "@/components/games/specialized/minecraft/MinecraftToolClient";
import type { Gta5InteractiveMap } from "@/components/gta/Gta5InteractiveMap";
import type { GtaInteractiveMap } from "@/components/gta/GtaInteractiveMap";
import type { GtaMapGuide } from "@/components/gta/GtaMapGuide";
import type { GameMap } from "@/components/games/GameMap";

// Keep the page-type routing, specialist renderers and metadata real. Stub IO
// and interactive boundaries to inspect saved identities and calculator inputs.
const state = vi.hoisted(() => ({ namespace: "gta", kind: "wiki", moved: false, page: {} as ReturnType<typeof savedPage> }));
vi.mock("@/lib/game-site-data", () => ({ listGameMenus: async () => [] }));
vi.mock("server-only", () => ({}));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), cache: (fn: unknown) => fn }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@/lib/wiki", () => ({ getWikiPageBySlug: async () => null, listPublishedWikiSlugs: async () => [] }));
vi.mock("@/app/(site)/wiki/page-data", () => ({ loadWikiDetailPageData: async () => null, renderWikiDetailPage: () => null }));
vi.mock("@/lib/wiki-collections", () => ({ getWikiCollectionPageByPath: async () => null, buildWikiCollectionPath: (slug: string, collection: string) => `/wiki/${slug}/${collection}` }));
vi.mock("@/lib/tools", () => ({ getToolContentWithDevFallback: async () => null }));
vi.mock("@/lib/db", () => ({ getChecklistPageBySlug: async () => null }));
vi.mock("@/lib/site-route-page", () => ({ getLiveSiteRoute: async () => ({ source: "game", page_type: state.kind, page_id: "page-id", game_id: "owner" }) }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => ({ from: () => {
  const query = { select: () => query, eq: () => query, single: async () => ({ data: { canonical_path: `/wiki/${state.page.wiki_slug}` }, error: null }), maybeSingle: async () => ({ data: { namespace: state.namespace, url_style: "page_type" }, error: null }) };
  return query;
} }) }));
function root() { return { id: "root", namespace: state.namespace, slug: state.namespace, title: state.namespace, kind: "franchise", parent_id: null, is_published: true, url_style: state.moved ? "page_type" : "namespace", cover_image: "https://media.bloxodes.com/cover.webp", description_md: "Root fallback copy." }; }
vi.mock("@/lib/game-registry", () => ({
  getGameRoot: async () => root(), getGameDirectoryPages: async () => [],
  getGameWikiById: async () => state.page, getGameWikiByPath: async () => state.page,
  getGameCollectionById: async () => state.page, getGameToolById: async () => state.page,
  getGameCollectionByPath: async () => null, getGameCodeByPath: async () => null, getGameToolByPath: async () => null,
  getGameCodeById: async () => null,
}));
vi.mock("@/lib/game-landing", () => ({ getGameLanding: async () => ({ root: root(), wiki: state.page, hasIndependentRoot: false }), getGameLandingForLinks: async () => ({ path: state.moved ? `/games/${state.namespace}` : `/${state.namespace}/wiki` }) }));
vi.mock("@/lib/game-extra-pages", () => ({
  getGameMapBySlug: async () => state.page, listGameMapPages: async () => [],
  getGameExtendedPageById: async () => state.page, getGameChecklistById: async () => checklist(),
  getGameExtendedPage: async () => null, getGameChecklistByPath: async () => null,
}));
function checklist() { return { ...state.page, page: state.page, items: [{ id: "task-id", section_code: "1", title: "Finish the mission", description: null, is_required: true }] }; }
const item = { item: { name: "Saved item" }, system: { slug: "item-id", name: "Saved item", image: "https://media.bloxodes.com/item.webp" } };
function runtime() { return { config: { code: "saved-code", gameSlug: state.page.wiki_slug, slug: "items", label: "Items", sortOrder: 0, gameName: "Saved game" }, document: { meta: { schemaVersion: 2, itemFields: ["name"], display: { cardFields: [] } }, items: [item] } }; }
function reader() { return {
  getPublishedSharedGameWikiCollectionRuntime: async () => runtime(),
  listPublishedSharedGameWikiPages: async () => [], listPublishedSharedGameWikiCollectionsByWikiSlug: async () => [],
  listPublishedSharedGameWikiCollectionImageUrls: async () => [],
  resolveSharedGameWikiCoverImage: () => "https://media.bloxodes.com/cover.webp", resolveSharedGameWikiThumbnailImage: () => "https://media.bloxodes.com/cover.webp",
}; }
vi.mock("@/lib/shared-game-reader", () => ({ createGameReader: reader }));
vi.mock("@/lib/page-content", () => ({ renderPageContentNodes: (html: string) => [<p key="copy" dangerouslySetInnerHTML={{ __html: html }} />], buildPageContentHtml: async (page: Record<string, unknown>) => ({ id: page.id, title: page.title, descriptionHtml: [{ key: "description", html: "<p>Saved description.</p>" }], introHtml: "", howHtml: "", faq: [], wikiHtml: "", tipsHtml: "" }) }));
vi.mock("@/components/game-collections/GameCollectionView", () => ({ GameCollectionView: (props: Parameters<typeof GameCollectionView>[0]) => <section data-code={props.config.slug}>{props.sections.flatMap((section) => section.items.map((item) => <div key={item.id} data-item-id={item.id}>{item.name}</div>))}</section> }));
vi.mock("@/components/games/GameCollectibleChecklist", () => ({ GameCollectibleChecklist: (props: Parameters<typeof GameCollectibleChecklist>[0]) => <section data-code={props.code}>{props.sections.flatMap((section) => section.items.map((item) => <div key={item.id} data-item-id={item.id}>{item.name}</div>))}</section> }));
vi.mock("@/components/games/GameCollectionSidebarLayout", () => ({ GameCollectionSidebarLayout: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/games/GameRelatedLinks", () => ({ GameRelatedLinks: () => null }));
vi.mock("@/components/comments/CommentsSection", () => ({ CommentsSection: ({ entityId, entityType }: Parameters<typeof CommentsSection>[0]) => <span data-comments-id={entityId} data-entity={entityType} /> }));
vi.mock("@/components/ChecklistBoard", () => ({ ChecklistBoard: (props: Parameters<typeof ChecklistBoard>[0]) => <div data-board={JSON.stringify(props)} /> }));
vi.mock("@/components/ChecklistProgressHeader", () => ({ ChecklistProgressHeader: () => null }));
vi.mock("@/components/maps/MapViewport", () => ({ MapViewport: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/UpdatedTimestamp", () => ({ UpdatedTimestamp: () => null }));
vi.mock("@/components/SocialShare", () => ({ SocialShare: () => null }));
vi.mock("@/components/tools/ToolPageLayout", () => ({ RelatedToolLinks: async () => null, ToolPageLayout: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/games/specialized/minecraft/MinecraftToolClient", () => ({ MinecraftToolClient: (props: Parameters<typeof MinecraftToolClient>[0]) => <div data-calculator={JSON.stringify(props)} /> }));
vi.mock("@/lib/gta-map", () => ({ getGta5MapMarkers: async () => [{ id: "pin-id", collectionCode: "saved-code" }] }));
vi.mock("@/components/gta/Gta5InteractiveMap", () => ({ Gta5InteractiveMap: (props: Parameters<typeof Gta5InteractiveMap>[0]) => <div data-engine="gta5" data-pins={JSON.stringify(props.markers)} /> }));
vi.mock("@/components/gta/GtaInteractiveMap", () => ({ GtaInteractiveMap: (props: Parameters<typeof GtaInteractiveMap>[0]) => <div data-engine="layered" data-layer={props.map.layers[0].slug} /> }));
vi.mock("@/components/gta/GtaMapGuide", () => ({ GtaMapGuide: ({ map, children, title }: Parameters<typeof GtaMapGuide>[0]) => <><h1>{title}</h1>{map}<article>{children}</article></> }));
vi.mock("@/components/games/GameMap", () => ({ GameMap: ({ data }: Parameters<typeof GameMap>[0]) => <div data-engine="image-pins" data-pin={data.markers[0].id} /> }));
vi.mock("@/lib/gta-interactive-maps", () => ({ getGtaInteractiveMapPageData: async () => state.page.renderer_key !== "gta-layered" ? null : ({ config: { route: state.page.canonical_path, title: "Saved map", mapTitle: state.page.title, description: "Saved description.", mappedPointCount: 1, about: [], views: [] }, layers: [{ slug: "layer-id", label: "Saved layer", sourceUrl: "https://example.com/map", sourceTitle: "Map", pointCount: 1 }], guides: [], hubTitle: "Saved wiki", hubPath: "/wiki/gta-3" }) }));

import GameEntry, { generateMetadata as gameEntryMetadata } from "@/app/(site)/games/[slug]/page";
import WikiEntry, { generateMetadata as wikiEntryMetadata } from "@/app/(site)/wiki/[slug]/page";
import CollectionEntry, { generateMetadata as collectionEntryMetadata } from "@/app/(site)/wiki/[slug]/[collection]/page";
import MapEntry, { generateMetadata as mapEntryMetadata } from "@/app/(site)/maps/[slug]/page";
import ToolEntry, { generateMetadata as toolEntryMetadata } from "@/app/(site)/tools/[...slug]/page";
import ChecklistEntry, { generateMetadata as checklistEntryMetadata } from "@/app/(site)/checklists/[slug]/page";
type RouteAdapter<Params> = [
  (props: { params: Params }) => Promise<ReactNode>,
  (props: { params: Params }) => Promise<Metadata>
];

// Resolve server components without an RSC server; client boundaries above are
// inert probes of the exact props handed to the interactive component.
// Typed as unknown: walking the full ReactNode union is too deep for TypeScript.
async function resolveTree(node: unknown): Promise<unknown> {
  const resolved: unknown = await node;
  if (resolved == null || typeof resolved !== "object") return resolved;
  if (Array.isArray(resolved)) return Promise.all(resolved.map((child: unknown) => resolveTree(child)));
  if (!React.isValidElement<{ children?: ReactNode }>(resolved)) return resolved;
  if (typeof resolved.type === "function") {
    const render = resolved.type as FunctionComponent<{ children?: ReactNode }>;
    return resolveTree(await render(resolved.props));
  }
  return React.cloneElement(resolved, {}, (await resolveTree(resolved.props.children)) as ReactNode);
}
async function html(node: ReactNode) { return renderToStaticMarkup(<>{(await resolveTree(node)) as ReactNode}</>); }
const fixtures = [
  ["gta", "wiki", "gta-hub", "/gta/wiki", "/games/gta", "root"],
  ["gta", "wiki", "gta-5", "/gta/wiki/gta-5", "/wiki/gta-5", "child"],
  ["red-dead", "wiki", "red-dead-hub", "/red-dead/wiki", "/games/red-dead", "root"],
  ["red-dead", "wiki", "red-dead-redemption-2", "/red-dead/wiki/red-dead-redemption-2", "/wiki/red-dead-redemption-2", "child"],
  ["minecraft", "wiki", "minecraft-hub", "/minecraft/wiki", "/games/minecraft", "root"],
  ...["java", "bedrock"].map(edition => ["minecraft", "wiki", `minecraft-${edition}`, `/minecraft/${edition}/wiki`, `/wiki/minecraft-${edition}`, edition]),
  ...["gta", "red-dead"].flatMap(namespace => ["database", "collectible"].map(type => [namespace, "collection", `${namespace}-child`, `/${namespace}/wiki/${namespace}-child/items`, `/wiki/${namespace}-child/items`, type])),
  ...["java", "bedrock"].flatMap(edition => ["database", "collectible"].map(type => ["minecraft", "collection", `minecraft-${edition}`, `/minecraft/${edition}/wiki/items`, `/wiki/minecraft-${edition}/items`, type])),
  ["minecraft", "tool", "xp-calculator", "/minecraft/tools/xp-calculator", "/tools/minecraft-xp-calculator", "tool"],
  ["gta", "checklist", "gta-5", "/gta/checklists/gta-5", "/checklists/gta-5", "checklist"],
  ["gta", "map", "gta5", "/gta/maps/gta5", "/maps/gta5", "gta5"],
  ["gta", "map", "gta-3", "/gta/maps/gta-3", "/maps/gta-3", "gta-layered"],
  ["gta", "map", "image-map", "/gta/maps/image-map", "/maps/image-map", "image-pins"],
];

function savedPage(namespace: string, slug: string, oldPath: string, variant: string) {
  return {
    id: "page-id",
    namespace,
    game_id: variant === "root" ? "root" : "owner",
    slug,
    wiki_slug: slug,
    collection_slug: "items",
    canonical_path: oldPath,
    title: "Saved title",
    seo_title: "Saved title",
    meta_description: "Saved description.",
    description_md: "Saved description.",
    game_title: "Saved game",
    game_kind: variant === "root" ? "franchise" : "game",
    is_published: true,
    code: "saved-code",
    display_name: "Items",
    page_type: variant,
    renderer_key: variant,
    image: "https://media.bloxodes.com/cover.webp",
    cover_image: "https://media.bloxodes.com/cover.webp" as string | null,
    tool_key: slug,
    rules_json: { revision: "saved-revision", editions: ["java", "bedrock"] },
    map_data: {
      image: "https://media.bloxodes.com/map.webp", width: 100, height: 100,
      attribution: "Map", markers: [{ id: "pin-id", title: "Saved pin", x: 20, y: 30 }]
    },
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    controls_json: []
  };
}

describe("specialized page-type resolver contracts", () => {
  it.each(fixtures)("%s %s %s (%s → %s, %s)", async (namespace, kind, slug, oldPath, newPath, variant) => {
    Object.assign(state, { namespace, kind, moved: false });
    state.page = savedPage(namespace, slug, oldPath, variant);
    if (variant === "root") state.page.cover_image = null; // artwork falls back to the root game
    state.moved = true;
    state.page = { ...state.page, canonical_path: newPath };
    const parts = newPath.split("/").slice(1);
    const entryProps = { params: Promise.resolve({ slug: parts[1], collection: parts[2] }) };
    const entry: RouteAdapter<typeof entryProps.params> = parts[0] === "games" ? [GameEntry, gameEntryMetadata] : kind === "wiki" ? [WikiEntry, wikiEntryMetadata] : kind === "collection" ? [CollectionEntry, collectionEntryMetadata] : kind === "map" ? [MapEntry, mapEntryMetadata] : [ChecklistEntry, checklistEntryMetadata];
    const toolEntryProps = { params: Promise.resolve({ slug: [parts[1]], collection: parts[2] }) };
    const metadata = kind === "tool" ? await toolEntryMetadata(toolEntryProps) : await entry[1](entryProps);
    const after = await html(kind === "tool" ? await ToolEntry(toolEntryProps) : await entry[0](entryProps));
    expect(metadata.alternates?.canonical).toBe(`https://bloxodes.com${newPath}`);
    expect(metadata.openGraph).toMatchObject({ url: `https://bloxodes.com${newPath}` });
    for (const rendered of [after]) {
      expect(rendered).toContain(variant === "gta5" ? "GTA 5 Interactive Map" : "Saved title");
      if (kind === "wiki" || kind === "tool") expect(rendered).toContain("page-id");
      if (kind === "wiki") expect(rendered).toContain("game_wiki");
      if (kind === "collection") {
        for (const value of ["Saved item", "item-id", "saved-code", "page-id"]) expect(rendered).toContain(value);
        expect(rendered).toContain("game_collection");
      }
      if (kind === "checklist") { expect(rendered).toContain("gta:gta-5"); expect(rendered).toContain("task-id"); }
      if (kind === "map") expect(rendered).toContain(variant === "gta-layered" ? "layer-id" : "pin-id");
      if (kind === "tool") {
        const calculator = JSON.parse(load(rendered)("[data-calculator]").attr("data-calculator")!);
        expect(calculator).toEqual({ slug: "xp-calculator", rules: state.page.rules_json });
        expect(rendered).toContain("game_tool");
      }
    }
    expect(state.page.id).toBe("page-id");
    expect(state.page.tool_key).toBe(slug);
  });
});

vi.mock("@/lib/minecraft-tools/page-reader", () => ({ getMinecraftTool: async () => state.page, listMinecraftTools: async () => [] }));
