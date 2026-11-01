import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { GameMenu } from "@/lib/game-site-navigation";
const state = vi.hoisted(() => ({ menus: [] as GameMenu[] }));
vi.mock("@/lib/game-menu-store", () => ({ useGameMenus: () => state.menus }));
vi.mock("@/components/RailLinkList", () => ({ RailLinkList: ({ links }: { links: Array<{ href: string; title: string }> }) => <>{links.map(link => <a key={link.href} href={link.href}>{link.title}</a>)}</> }));
vi.mock("@/components/PageSidebar", () => ({ PageSidebar: () => null }));
vi.mock("@/components/SocialShare", () => ({ SocialShare: () => null }));
import { RelatedToolLinks } from "../ToolPageLayout";
it.each(["gta", "red-dead", "minecraft", "arc-raiders"])("uses the published page menu for %s related tools", namespace => {
  const path = `/tools/${namespace}-current`;
  state.menus = [{ namespace, href: `/wiki/${namespace}`, title: namespace, image: "", pages: [
    { kind: "tool", gameId: "owner", title: "Current", href: path },
    { kind: "tool", gameId: "owner", title: "Related", href: path.replace("current", "related") },
    { kind: "tool", gameId: "other", title: "Other game", href: "/tools/other" }
  ] }];
  const html = renderToStaticMarkup(<RelatedToolLinks canonicalPath={path} />);
  expect(html).toBe(`<a href="/tools/${namespace}-related">Related</a>`);
});
it("retains the existing Roblox tools list", () => {
  state.menus = [];
  const html = renderToStaticMarkup(<RelatedToolLinks canonicalPath="/tools/robux-to-usd-calculator" toolCode="robux-to-usd-calculator" />);
  expect(html.match(/<a /g)).toHaveLength(6);
  expect(html).toContain('href="/tools/roblox-devex-calculator"');
  expect(html).not.toContain('href="/tools/robux-to-usd-calculator"');
});
