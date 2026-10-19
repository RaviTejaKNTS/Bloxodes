import { describe, expect, it, vi } from "vitest";
import { load } from "cheerio";
import { renderToStaticMarkup } from "react-dom/server";
import { GameContentPage, gameContentMetadata } from "./GameContentPage";
import { GameCatalog } from "./GameCatalog";
import type { GameExtendedPage } from "@/lib/game-page-data";

vi.mock("server-only", () => ({}));
vi.mock("./GameRelatedLinks", () => ({ GameRelatedLinks: () => <a href="/example/wiki/child">Child wiki</a> }));
vi.mock("@/components/comments/CommentsSection", () => ({ CommentsSection: () => null }));

describe("franchise reference page structure", () => {
  it("keeps intro, catalog groups and FAQ in one flat stream alongside a single rail", async () => {
    const page = { id: "catalog", namespace: "example", game_id: "child", game_title: "Child", canonical_path: "/example/catalog/items", title: "Child Items", image: "https://media.bloxodes.com/child-cover.webp", intro_md: "Every item in Child.", description_md: "Craft the sturdy items first.", faq_json: [{ q: "Can you craft items?", a: "Yes, at the Workshop." }], sources_json: [{ title: "Internal evidence", url: "https://example.com/evidence" }] } as GameExtendedPage;
    const catalog = { columns: [{ key: "name", label: "Item" }], items: Array.from({ length: 25 }, (_, i) => ({ id: String(i), name: `Item ${i}` })) };
    const $ = load(renderToStaticMarkup(await GameContentPage({ page, children: <GameCatalog data={catalog} /> })));
    expect($("#article-body")).toHaveLength(1);
    expect($(".content-sidebar-grid > aside#sidebar.space-y-4")).toHaveLength(1);
    expect($("#article-body > div > table")).toHaveLength(3);
    expect($("#article-body tbody tr")).toHaveLength(25);
    expect($("#article-body").text()).toContain("Yes, at the Workshop.");
    expect($("#article-body").text()).not.toContain("Internal evidence");
    const graph = JSON.parse($("script[type='application/ld+json']").text())["@graph"];
    expect(graph.find((entry: { "@type": string }) => entry["@type"] === "WebPage").image).toBe(page.image);
    expect(graph.find((entry: { "@type": string }) => entry["@type"] === "FAQPage").mainEntity).toHaveLength(1);
    expect(gameContentMetadata(page).openGraph).toMatchObject({ images: [page.image] });
  });
});
