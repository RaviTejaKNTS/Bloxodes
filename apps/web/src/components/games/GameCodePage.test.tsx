import { describe, expect, it, vi } from "vitest";
import { load } from "cheerio";
import { renderToStaticMarkup } from "react-dom/server";
import { GameCodePage } from "./GameCodePage";
import type { GameCodePage as CodePage } from "@/lib/game-registry";

vi.mock("@/lib/game-landing", () => ({ getGameLandingForLinks: async (namespace: string) => ({ path: `/${namespace}/wiki` }) }));
vi.mock("server-only", () => ({}));
vi.mock("./GameRelatedLinks", () => ({ GameRelatedLinks: () => <a href="/example/wiki/child">Child wiki</a> }));
vi.mock("@/components/comments/CommentsSection", () => ({ CommentsSection: () => null }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => ({ from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: [{ code: "ACTIVE", status: "active", rewards_text: "A reward" }, { code: "EXPIRED", status: "expired", rewards_text: null }], error: null }) }) }) }) }) }));

describe("franchise codes layout", () => {
  it.each([
    ["/example/codes", null],
    ["/example/codes/child", "/example/codes"],
    ["/codes/child", "/codes"]
  ])("keeps the correct Codes breadcrumb for %s", async (canonical_path, codesIndex) => {
    const page = { id: "codes", namespace: "example", game_id: "child", canonical_path, title: "Child Codes", faq_json: [] } as unknown as CodePage;
    const $ = load(renderToStaticMarkup(await GameCodePage({ page, namespaceTitle: "Example" })));
    const codesCrumb = $("nav[aria-label='Breadcrumb'] a").filter((_, link) => $(link).text() === "Codes");
    if (codesIndex) expect(codesCrumb.attr("href")).toBe(codesIndex);
    else expect(codesCrumb).toHaveLength(0);
  });

  it("omits schema images when the owning game has no artwork", async () => {
    const page = { id: "codes", namespace: "example", game_id: "child", canonical_path: "/example/codes/child", title: "Child Codes", image: null, faq_json: [] } as unknown as CodePage;
    const $ = load(renderToStaticMarkup(await GameCodePage({ page, namespaceTitle: "Example" })));
    expect(JSON.parse($("script[type='application/ld+json']").text())["@graph"][0]).not.toHaveProperty("image");
  });

  it("matches the Roblox section order with one sidebar, FAQ and real image schema", async () => {
    const page: CodePage = { id: "codes", namespace: "example", game_id: "child", canonical_path: "/example/codes/child", title: "Child Codes", image: "https://media.bloxodes.com/child-cover.webp", seo_title: null, meta_description: "Redeem Child rewards.", intro_md: "Redeem rewards in Child.", redeem_md: "Open the reward menu.", rewards_md: "Spend rewards on gear.", troubleshoot_md: "Check the spelling.", find_codes_md: "Watch the developer announcements.", faq_json: [{ q: "Can rewards expire?", a: "Yes." }], updated_at: null, published_at: null };
    const $ = load(renderToStaticMarkup(await GameCodePage({ page, namespaceTitle: "Example" })));
    expect($("#article-body")).toHaveLength(1);
    expect($(".content-sidebar-grid > aside#sidebar.space-y-4")).toHaveLength(1);
    expect($("#article-body h2").map((_, heading) => $(heading).text()).get()).toEqual(["Active codes", "How to redeem", "Expired codes", "Troubleshooting", "Rewards", "Where to find codes", "FAQ"]);
    const graph = JSON.parse($("script[type='application/ld+json']").text())["@graph"];
    expect(graph[0].image).toBe(page.image);
    expect(graph[1]["@type"]).toBe("FAQPage");
  });
});

