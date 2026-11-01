import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ path: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-bloxodes-game-path": state.path }) }));
vi.mock("@/lib/game-site-data", () => ({ getGameMenuForPath: async () => ({ pages: [
 { kind: "tool", gameId: "owner", title: "Current", href: state.path },
 { kind: "tool", gameId: "owner", title: "Related", href: state.path.replace("current", "related") },
 { kind: "tool", gameId: "other", title: "Other game", href: "/tools/other" }
] }) }));
import { RelatedToolLinks } from "../ToolPageLayout";
it.each(["gta", "red-dead", "minecraft", "arc-raiders"])("builds related tools for %s from the owning game", async namespace => {
  state.path = `/tools/${namespace}-current`;
  const result = await RelatedToolLinks({ canonicalPath: `/tools/${namespace}-current` });
  expect(result.props.links).toEqual([{ href: `/tools/${namespace}-related`, title: "Related" }]);
});
it("retains the existing Roblox tools list", async () => {
  state.path = "";
  const result = await RelatedToolLinks({ canonicalPath: "/tools/robux-to-usd-calculator", toolCode: "robux-to-usd-calculator" });
  expect(result.props.links).toHaveLength(6);
  expect(result.props.links[0].href).toBe("/tools/roblox-devex-calculator");
});
