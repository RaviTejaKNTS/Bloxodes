import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DedicatedToolPage, buildDedicatedToolMetadata } from "../DedicatedToolPage";
import { GameToolPageLayout } from "../../games/GameToolPage";
import type { ToolContent } from "@/lib/tools";
const { readTool } = vi.hoisted(() => ({ readTool: vi.fn() }));
vi.mock("@/lib/tools", () => ({ getToolContentWithDevFallback: readTool }));
vi.mock("@/components/comments/CommentsSection", () => ({ CommentsSection: ({ entityType }: { entityType: string }) => <span data-comment-type={entityType}>Comments</span> }));
vi.mock("@/components/more-content", () => ({ MoreTools: () => <span>Roblox related tools</span> }));
vi.mock("@/components/ContentSlot", () => ({ ContentSlot: () => null }));
vi.mock("@/components/UpdatedTimestamp", () => ({ UpdatedTimestamp: () => null }));
vi.mock("@/components/tools/ToolFaq", () => ({ ToolFaq: () => <span>Tool questions</span> }));
vi.mock("@/lib/page-content", () => ({ buildPageContentHtml: async () => ({ introHtml: "Intro", howHtml: "How to use", descriptionHtml: [{ key: "1", html: "Explanation" }], faqHtml: [{ q: "Question", a: "Answer" }] }), renderPageContentNodes: (html: string) => [html] }));
const content: ToolContent = { id: "minecraft-tool", code: "xp-calculator", title: "Minecraft XP calculator", seo_title: "", meta_description: "Calculate experience.", intro_md: "Intro", how_it_works_md: "How", description_json: {}, faq_json: [{ q: "Question", a: "Answer" }], is_published: true };
beforeEach(() => { readTool.mockReset(); readTool.mockResolvedValue(content); });
describe("shared dedicated tool contract", () => {
 it("preserves the existing Roblox loading and canonical defaults", async () => {
  const metadata = await buildDedicatedToolMetadata({ toolCode: "xp-calculator", fallbackTitle: "Fallback", fallbackDescription: "Fallback" });
  expect(readTool).toHaveBeenCalledWith("xp-calculator");
  expect(metadata.alternates?.canonical).toContain("/tools/xp-calculator");
  const html = renderToStaticMarkup(await DedicatedToolPage({ toolCode: "xp-calculator", fallbackTitle: "Fallback", fallbackDescription: "Fallback", children: <div>Calculator</div> }));
  expect(html).toContain("Roblox related tools");
  expect(html).toContain('data-comment-type="tool"');
 });
 it("reuses content and presentation for a namespace without Roblox reads", async () => {
  const config = { toolCode: content.code, fallbackTitle: content.title, fallbackDescription: content.meta_description, content, canonicalPath: "/minecraft/tools/xp-calculator" };
  const metadata = await buildDedicatedToolMetadata(config);
  expect(metadata.alternates?.canonical).toContain("/minecraft/tools/xp-calculator");
  const html = renderToStaticMarkup(await DedicatedToolPage({ ...config, commentEntityType: "minecraft_tool", breadcrumbItems: [{ label: "Minecraft", href: "/minecraft" }, { label: "Tools", href: "/minecraft/tools" }, { label: content.title }], relatedContent: <span>Minecraft related tools</span>, children: <div>Calculator</div> }));
  expect(readTool).not.toHaveBeenCalled();
  expect(html).toContain('data-comment-type="minecraft_tool"');
  expect(html).toContain("Minecraft related tools");
  expect(html).not.toContain("Roblox related tools");
  expect(html.indexOf("Intro")).toBeLessThan(html.indexOf("Calculator</div>"));
  expect(html.indexOf("Calculator</div>")).toBeLessThan(html.indexOf("How to use"));
  expect(html).toContain("Tool questions");
  expect(html.match(/id="article-body"/g)).toHaveLength(1);
  expect(html.match(/<aside id="sidebar" class="space-y-4"/g)).toHaveLength(1);
  expect(html.indexOf('<aside id="sidebar"')).toBeGreaterThan(html.indexOf('</section>', html.indexOf('id="article-body"')));
  expect(html).toContain('<div class="ads-tools-widget"><div>Calculator</div></div>');

 });
 it("gives shared-game calculators the same sidebar and content contract", async () => {
  const sharedTool = { ...content, namespace: "example-game", canonical_path: "/example-game/tools/resource-cost", tool_key: "resource-cost", rules_json: { unitCost: 2, resourceLabel: "Iron" }, id: "shared-tool", game_id: "owner" };
  const page = GameToolPageLayout({ tool: sharedTool, namespaceTitle: "Example Game", children: <div>Resource calculator</div> });
  const html = renderToStaticMarkup(await DedicatedToolPage(page.props));
  expect(readTool).not.toHaveBeenCalled();
  expect(html).toContain('data-comment-type="game_tool"');
  expect(html.match(/id="article-body"/g)).toHaveLength(1);
  expect(html.match(/<aside id="sidebar" class="space-y-4"/g)).toHaveLength(1);
  expect(html).toContain("/example-game/tools/resource-cost");
  expect(html).not.toContain("Roblox related tools");
 });

 it("renders shared-game navigation supplied by its server route", async () => {
  const sharedTool = { ...content, namespace: "example-game", canonical_path: "/example-game/tools/resource-cost", tool_key: "resource-cost", rules_json: { unitCost: 2, resourceLabel: "Iron" }, id: "shared-tool", game_id: "owner" };
  const page = GameToolPageLayout({ tool: sharedTool, namespaceTitle: "Example Game", sidebarContent: <a href="/example-game/wiki/owner">Owner wiki</a>, children: <div>Resource calculator</div> });
  const html = renderToStaticMarkup(await DedicatedToolPage(page.props));
  expect(html).toContain('href="/example-game/wiki/owner"');
  expect(html).not.toContain("Roblox related tools");
  expect(readTool).not.toHaveBeenCalled();
 });

});
