import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import type { GameToolPage as ToolPage } from "@/lib/game-registry";

const state = vi.hoisted(() => ({ failedRead: "", listTools: vi.fn(), probes: [] as string[] }));
vi.mock("server-only", () => ({}));
vi.mock("react", async importOriginal => ({ ...await importOriginal<typeof import("react")>(), cache: (loader: unknown) => loader }));
vi.mock("@/lib/game-registry", () => ({
  getGameRoot: async (namespace: string) => {
    if (state.failedRead === "root") throw new Error("Root unavailable");
    return { id: namespace, namespace, parent_id: null, is_published: true };
  },
  getGameWikiByPath: async (namespace: string) => {
    if (state.failedRead === "wiki") throw new Error("Wiki unavailable");
    return { game_id: namespace, namespace, canonical_path: `/${namespace}/wiki`, is_published: true };
  }
}));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => ({ from: (table: string) => {
  const query = { select: () => query, eq: () => query, limit: () => query, maybeSingle: async () => {
    state.probes.push(table);
    if (table === "game_catalog_pages_view" && state.failedRead === "rejected probe") throw new Error("View unavailable");
    return { data: null, error: state.failedRead === table ? { message: "View unavailable" } : null };
  } };
  return query;
} }) }));
vi.mock("@/lib/minecraft", () => ({ listMinecraftTools: state.listTools }));
vi.mock("@/components/tools/ToolPageLayout", () => ({ ToolPageLayout: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/IndexPageStats", () => ({ IndexPageStats: () => null }));
vi.mock("@/components/UpdatedTimestamp", () => ({ UpdatedTimestamp: () => null }));
vi.mock("@/app/(site)/minecraft/tools/page-data", () => ({ MinecraftToolCards: () => <div>Published tool cards</div> }));
vi.mock("@/components/tools/DedicatedToolPage", () => ({ DedicatedToolPage: ({ children, breadcrumbItems }: { children: ReactNode; breadcrumbItems: Array<{ label: string; href?: string }> }) => <main>{breadcrumbItems.map(item => <a key={item.label} href={item.href}>{item.label}</a>)}{children}</main> }));

import MinecraftToolsPage from "@/app/(site)/minecraft/tools/page";
import { GameToolPage } from "@/components/games/GameToolPage";

const tool: ToolPage = {
  id: "tool",
  namespace: "minecraft",
  game_id: "minecraft",
  code: "resource-cost",
  slug: "resource-cost",
  title: "Resource cost",
  seo_title: "Resource cost",
  meta_description: "Calculate resource costs.",
  intro_md: "",
  how_it_works_md: "",
  description_json: {},
  faq_json: [],
  is_published: true,
  canonical_path: "/minecraft/tools/resource-cost",
  tool_key: "resource-cost",
  rules_json: { unitCost: 2, resourceLabel: "Iron" }
};

beforeEach(() => {
  state.failedRead = "";
  state.probes.length = 0;
  state.listTools.mockReset().mockResolvedValue([{ slug: "xp-calculator", title: "Minecraft XP calculator" }]);
});

describe("optional landing failures on valid tools", () => {
  it.each(["game_catalog_pages_view", "rejected probe", "root", "wiki"])("renders the tool index and a valid calculator when %s fails", async failedRead => {
    state.failedRead = failedRead;
    const indexHtml = renderToStaticMarkup(await MinecraftToolsPage());
    expect(indexHtml).toContain('href="/minecraft"');
    expect(indexHtml).toContain("Published tool cards");
    expect(indexHtml).toContain("https://bloxodes.com/minecraft/tools/xp-calculator");
    const toolHtml = renderToStaticMarkup(await GameToolPage({ tool, namespaceTitle: "Minecraft" }));
    expect(toolHtml).toContain('href="/minecraft"');
    expect(toolHtml).toContain('id="resource-quantity"');
    expect(toolHtml).toContain("2 Iron");
    if (failedRead.includes("probe") || failedRead.endsWith("_view")) {
      expect(new Set(state.probes).size).toBe(8);
    }
  });

  it("keeps required tool data and calculator validation errors", async () => {
    state.listTools.mockRejectedValue(new Error("Tools unavailable"));
    await expect(MinecraftToolsPage()).rejects.toThrow("Tools unavailable");
    await expect(GameToolPage({ tool: { ...tool, rules_json: {} }, namespaceTitle: "Minecraft" })).rejects.toThrow("needs a registered calculator and verified rules");
  });
});
